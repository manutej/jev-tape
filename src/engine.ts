/**
 * In-process twin. This is what runs when there is no Temporal server: same loop, same branches,
 * plain async ports, an in-memory or file tape. `npm run live` is one Capture through startEngine.
 */
import type { Command } from "./domain.ts";
import type { Judge } from "./judge.ts";
import { PACK_VERSION, composeAnswers, localGate, outputRequest, taskRequest, type HumanVerdict, type ItemOutcome, type Proposal, type Verdict } from "./loop.ts";
import { runItem, type Ports } from "./item.ts";

export interface TapeEntry {
  key: string;
  command: string;
  event: string;
  payload: Record<string, unknown>;
  at: string;
}

export interface Tape {
  append(entry: TapeEntry): Promise<{ applied: boolean; duplicate: boolean }>;
  entries(): Promise<TapeEntry[]>;
  /** Optional fast path for ingest dedupe; falls back to a scan of entries(). */
  seenThreadIds?(ids: string[]): Promise<string[]>;
}

export function memoryTape(): Tape {
  const rows = new Map<string, TapeEntry>();
  return {
    async append(entry) {
      if (rows.has(entry.key)) return { applied: false, duplicate: true };
      rows.set(entry.key, entry);
      return { applied: true, duplicate: false };
    },
    async entries() {
      return [...rows.values()];
    },
  };
}

export interface EngineDeps {
  judge: Judge;
  tape: Tape;
  /** How the twin answers a C10 park. Default: escalate (fail closed). */
  human?: (cmd: Command, proposal: Proposal, verdict: Verdict) => Promise<HumanVerdict>;
  now?: () => string;
}

export async function qualifyTaskWith(judge: Judge, cmd: Command): Promise<Verdict> {
  const local = localGate(cmd);
  const t0 = performance.now();
  const res = await judge.ask(taskRequest(cmd));
  const ms = Math.round(performance.now() - t0);
  const composed = composeAnswers("task", res.answers, local);
  return { gate: "task", ...composed, source: res.source, model: res.model, answers: res.answers, usage: res.usage, ms, pack: PACK_VERSION };
}

export async function qualifyOutputWith(judge: Judge, cmd: Command, proposal: Proposal): Promise<Verdict> {
  const local = localGate(cmd);
  const t0 = performance.now();
  const res = await judge.ask(outputRequest(cmd, proposal));
  const ms = Math.round(performance.now() - t0);
  const composed = composeAnswers("output", res.answers, local);
  return { gate: "output", ...composed, source: res.source, model: res.model, answers: res.answers, usage: res.usage, ms, pack: PACK_VERSION };
}

export function enginePorts(deps: EngineDeps): Ports {
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    qualifyTask: (cmd) => qualifyTaskWith(deps.judge, cmd),
    qualifyOutput: (cmd, proposal) => qualifyOutputWith(deps.judge, cmd, proposal),
    applyCommand: (cmd, proposal) =>
      deps.tape.append({ key: proposal.idempotencyKey, command: cmd.name, event: proposal.event.name, payload: proposal.event.payload, at: now() }),
    awaitHumanVerdict: deps.human ?? (async () => "escalate"),
  };
}

export interface Worklist {
  applied: ItemOutcome[];
  residual: ItemOutcome[];
  outcomes: ItemOutcome[];
}

/** Fold a worklist through the loop. RED → residual. Items are keyed by position so retries are idempotent. */
export async function startEngine(commands: Command[], deps: EngineDeps, keyPrefix = "twin"): Promise<Worklist> {
  const ports = enginePorts(deps);
  const outcomes: ItemOutcome[] = [];
  for (let i = 0; i < commands.length; i++) {
    outcomes.push(await runItem(commands[i]!, `${keyPrefix}:${i}`, ports));
  }
  return {
    outcomes,
    applied: outcomes.filter((o) => o.status === "applied"),
    residual: outcomes.filter((o) => o.status === "residual"),
  };
}
