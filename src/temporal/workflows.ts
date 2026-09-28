/**
 * One workflow per process. Never per Inbox row. No fetch, no key, no clock of its own.
 *
 *   JevCorrectnessWorkflow  worklist fold, C10 park on Signal humanVerdict, ContinueAsNew every 8
 *   WaitingWorkflow         StartWaiting → timer nudges → resolve Signal → ResolveWaiting (C10)
 *   HabitWorkflow           mints Instances on an interval. CreateHabit is illegal here.
 *   SomedayReviewWorkflow   review timer; snooze or trash on Signal
 */
import {
  condition,
  continueAsNew,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from "@temporalio/workflow";
import type { Command } from "../domain.ts";
import { runItem, type Ports } from "../item.ts";
import type { HumanVerdict, ItemOutcome } from "../loop.ts";
import type { Activities } from "./activities.ts";
import { NON_RETRYABLE } from "../loop.ts";

export const TASK_QUEUE = "jev-tape";
export const CONTINUE_AS_NEW_EVERY = 8;

const acts = proxyActivities<Activities>({
  startToCloseTimeout: "60 seconds",
  heartbeatTimeout: "30 seconds",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumInterval: "30 seconds",
    maximumAttempts: 6,
    nonRetryableErrorTypes: [...NON_RETRYABLE],
  },
});

// ---------------------------------------------------------------- signals & queries

export const humanVerdictSignal = defineSignal<[{ key: string; verdict: HumanVerdict }]>("humanVerdict");
export const resolveSignal = defineSignal<[{ note?: string }]>("resolve");
export const reviewSignal = defineSignal<[{ decision: "keep" | "snooze" | "trash" }]>("review");
export const statusQuery = defineQuery<WorklistStatus>("status");

export interface WorklistStatus {
  cursor: number;
  total: number;
  applied: string[];
  residual: string[];
  parked: string[];
  run: number;
}

// ---------------------------------------------------------------- shared ports

function makePorts(verdicts: Map<string, HumanVerdict>, parked: Set<string>, parkTimeoutMs?: number): Ports {
  return {
    qualifyTask: (cmd, key) => acts.qualifyTask(cmd, key),
    qualifyOutput: (cmd, proposal) => acts.qualifyOutput(cmd, proposal),
    applyCommand: (cmd, proposal) => acts.applyCommand(cmd, proposal),
    async awaitHumanVerdict(_cmd, proposal) {
      const key = proposal.idempotencyKey;
      parked.add(key);
      const answered = parkTimeoutMs
        ? await condition(() => verdicts.has(key), parkTimeoutMs)
        : (await condition(() => verdicts.has(key)), true);
      parked.delete(key);
      if (!answered) return "escalate";
      return verdicts.get(key)!;
    },
  };
}

// ---------------------------------------------------------------- JevCorrectnessWorkflow

export interface WorklistInput {
  commands: Command[];
  /** Position of the next unprocessed command. Carried across ContinueAsNew. */
  cursor?: number;
  applied?: string[];
  residual?: string[];
  /** Human verdicts already received, carried across ContinueAsNew so a signal is never lost. */
  verdicts?: Record<string, HumanVerdict>;
  /** Outcomes of earlier runs, carried so the final result holds every item's steps. */
  outcomes?: ItemOutcome[];
  /** How long a C10 park waits before escalating. Omit for a durable, unbounded wait. */
  parkTimeoutMs?: number;
  run?: number;
}

export interface WorklistResult {
  applied: string[];
  residual: string[];
  outcomes: ItemOutcome[];
  runs: number;
}

export async function JevCorrectnessWorkflow(input: WorklistInput): Promise<WorklistResult> {
  const { workflowId } = workflowInfo();
  const verdicts = new Map<string, HumanVerdict>(Object.entries(input.verdicts ?? {}));
  const parked = new Set<string>();
  const applied = [...(input.applied ?? [])];
  const residual = [...(input.residual ?? [])];
  const outcomes: ItemOutcome[] = [...(input.outcomes ?? [])];
  let cursor = input.cursor ?? 0;
  const run = input.run ?? 1;

  setHandler(humanVerdictSignal, ({ key, verdict }) => {
    verdicts.set(key, verdict);
  });
  setHandler(statusQuery, () => ({ cursor, total: input.commands.length, applied, residual, parked: [...parked], run }));

  const ports = makePorts(verdicts, parked, input.parkTimeoutMs);
  const end = Math.min(input.commands.length, cursor + CONTINUE_AS_NEW_EVERY);

  for (; cursor < end; cursor++) {
    const key = `${workflowId}:${cursor}`;
    const outcome = await runItem(input.commands[cursor]!, key, ports);
    outcomes.push(outcome);
    (outcome.status === "applied" ? applied : residual).push(key);
  }

  if (cursor < input.commands.length) {
    await continueAsNew<typeof JevCorrectnessWorkflow>({
      ...input,
      cursor,
      applied,
      residual,
      verdicts: Object.fromEntries(verdicts),
      outcomes,
      run: run + 1,
    });
  }
  return { applied, residual, outcomes, runs: run };
}

// ---------------------------------------------------------------- WaitingWorkflow

export interface WaitingInput {
  display_name: string;
  what: string;
  nudgeEveryMs: number;
  maxNudges?: number;
  parkTimeoutMs?: number;
}

export interface WaitingResult {
  started: ItemOutcome;
  nudges: number;
  resolved?: ItemOutcome;
}

export async function WaitingWorkflow(input: WaitingInput): Promise<WaitingResult> {
  const { workflowId } = workflowInfo();
  const verdicts = new Map<string, HumanVerdict>();
  const parked = new Set<string>();
  let resolveNote: string | undefined;
  let resolved = false;
  setHandler(humanVerdictSignal, ({ key, verdict }) => void verdicts.set(key, verdict));
  setHandler(resolveSignal, ({ note }) => {
    resolveNote = note;
    resolved = true;
  });
  const ports = makePorts(verdicts, parked, input.parkTimeoutMs);

  const started = await runItem(
    { name: "StartWaiting", payload: { display_name: input.display_name, what: input.what } },
    `${workflowId}:start`,
    ports,
  );
  if (started.status !== "applied") return { started, nudges: 0 };

  let nudges = 0;
  const max = input.maxNudges ?? 3;
  while (!resolved && nudges < max) {
    const came = await condition(() => resolved, input.nudgeEveryMs);
    if (came) break;
    nudges += 1;
    await acts.recordEvent(`${workflowId}:nudge:${nudges}`, "WaitingNudged", { display_name: input.display_name, nudge: nudges });
  }
  if (!resolved) await condition(() => resolved);

  const resolvedOutcome = await runItem(
    { name: "ResolveWaiting", payload: { display_name: input.display_name, what: input.what, note: resolveNote ?? "" } },
    `${workflowId}:resolve`,
    ports,
  );
  return { started, nudges, resolved: resolvedOutcome };
}

// ---------------------------------------------------------------- HabitWorkflow

export interface HabitInput {
  habitId: string;
  everyMs: number;
  /** Stop after this many instances (demo/test). Omit for a habit that never ends. */
  maxInstances?: number;
  minted?: number;
  run?: number;
}

export async function HabitWorkflow(input: HabitInput): Promise<{ minted: number; runs: number }> {
  const { workflowId } = workflowInfo();
  const ports = makePorts(new Map(), new Set());
  let minted = input.minted ?? 0;
  const run = input.run ?? 1;
  let inThisRun = 0;
  while (input.maxInstances === undefined || minted < input.maxInstances) {
    await sleep(input.everyMs);
    await runItem({ name: "MintInstance", payload: { habitId: input.habitId, n: minted + 1 } }, `${workflowId}:mint:${minted + 1}`, ports);
    minted += 1;
    inThisRun += 1;
    if (inThisRun >= CONTINUE_AS_NEW_EVERY && (input.maxInstances === undefined || minted < input.maxInstances)) {
      await continueAsNew<typeof HabitWorkflow>({ ...input, minted, run: run + 1 });
    }
  }
  return { minted, runs: run };
}

// ---------------------------------------------------------------- SomedayReviewWorkflow

export interface SomedayInput {
  itemKey: string;
  reviewEveryMs: number;
  reviews?: number;
  run?: number;
  parkTimeoutMs?: number;
}

export async function SomedayReviewWorkflow(input: SomedayInput): Promise<{ reviews: number; final: string; runs: number }> {
  const { workflowId } = workflowInfo();
  const verdicts = new Map<string, HumanVerdict>();
  const parked = new Set<string>();
  let decision: "keep" | "snooze" | "trash" | undefined;
  setHandler(humanVerdictSignal, ({ key, verdict }) => void verdicts.set(key, verdict));
  setHandler(reviewSignal, (d) => void (decision = d.decision));
  const ports = makePorts(verdicts, parked, input.parkTimeoutMs);
  let reviews = input.reviews ?? 0;
  const run = input.run ?? 1;
  let inThisRun = 0;

  for (;;) {
    await sleep(input.reviewEveryMs);
    decision = undefined;
    await condition(() => decision !== undefined);
    reviews += 1;
    inThisRun += 1;
    if (decision === "trash") {
      const out = await runItem({ name: "Trash", payload: { itemKey: input.itemKey, itemKind: "Someday" } }, `${workflowId}:trash:${reviews}`, ports);
      return { reviews, final: out.status === "applied" ? "trashed" : `trash ${out.status}`, runs: run };
    }
    if (decision === "snooze") {
      await runItem({ name: "SnoozeSomeday", payload: { itemKey: input.itemKey, review: reviews } }, `${workflowId}:snooze:${reviews}`, ports);
    }
    if (inThisRun >= CONTINUE_AS_NEW_EVERY) {
      await continueAsNew<typeof SomedayReviewWorkflow>({ ...input, reviews, run: run + 1 });
    }
  }
}
