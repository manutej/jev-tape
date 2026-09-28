/**
 * The apply-last loop as pure code. No IO, no fetch, no keys, no clock.
 *
 * Both the in-process twin (src/engine.ts) and the Temporal workflows
 * (src/temporal/workflows.ts) import this file. That is the whole point:
 * the workflow isolate and the unit twin share branches, not a brain.
 *
 *   assertLegalCommand → qualifyTask → gate → propose → qualifyOutput → gate → applyCommand
 */
import {
  TYPESAFE_PINNED_MODEL,
  isMidBandNoul,
  type ChoiceAnswer,
  type NoulAnswer,
  type SystemOneRequest,
  type TypesafeAnswer,
} from "./typesafe/contract.ts";
import { HUMAN_GATED_COMMANDS, assertLegalCommand, type Command, type DomainEvent, type DomainEventName } from "./domain.ts";

export type Light = "GREEN" | "AMBER" | "RED";

/** Activity error types that must not be retried. Retry is for 5xx / 429 / 529 only. */
export const NON_RETRYABLE = ["TypesafeNonRetryable", "ContractViolation", "QualifyRed"] as const;
export type Gate = "task" | "output";

/** Dual axes. θ is P(fail-closed gate is GREEN). top_prob_floor is pack peakedness. Never the same number. */
export const THETA = 0.7;
export const TOP_PROB_FLOOR = 0.55;

export interface Verdict {
  gate: Gate;
  light: Light;
  reasons: string[];
  /** Which judge answered: "live" is jev-1.13.0 over the wire. Anything else is not a real verdict. */
  source: string;
  model: string;
  answers: Record<string, TypesafeAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
  /** Wall time of the judge call, ms. This is the number to watch. */
  ms?: number;
}

export interface Proposal {
  event: DomainEvent;
  /** Deterministic id: the applier uses it to make the write idempotent across retries. */
  idempotencyKey: string;
}

// ---------------------------------------------------------------- questions

const LIGHT_CRITERIA = {
  GREEN: "Safe to apply after compose",
  AMBER: "Park for a human",
  RED: "Refuse",
} as const;

/** qualifyTask pack. One POST, several questions. The operad names them; nothing here rewrites prompts. */
export function taskRequest(cmd: Command): SystemOneRequest {
  return {
    model: TYPESAFE_PINNED_MODEL,
    state: JSON.stringify({ gate: "task", command: cmd }),
    questions: {
      single_intent: {
        type: "noul",
        instructions: "Does this command express exactly one intent for exactly one item?",
        criteria: {
          true: "One command, one item, one thing to do with it.",
          false: "Several items, several intents, or a request that is really a project.",
        },
      },
      harness_can_branch: {
        type: "noul",
        instructions: "Can a harness decide this without a human, from the payload alone?",
        criteria: {
          true: "The payload carries what the command needs; no judgment about people, money, or deadlines is required.",
          false: "Deciding needs context that is not in the payload, or a human's preference.",
        },
      },
      reversibility: {
        type: "choice",
        instructions: "If this command is applied and turns out to be wrong, what does undoing it cost?",
        criteria: {
          free: "A later command fully undoes it at no cost.",
          cheap: "Undo is possible but someone will notice.",
          irreversible: "Cannot be undone: a message went out, a record was destroyed, or a person was told.",
        },
      },
      allow_now: {
        type: "choice",
        instructions: "May a harness run this command now?",
        criteria: LIGHT_CRITERIA,
      },
    },
  };
}

/** qualifyOutput pack. The proposal exists only in memory here. Nothing has been written yet. */
export function outputRequest(cmd: Command, proposal: Proposal): SystemOneRequest {
  return {
    model: TYPESAFE_PINNED_MODEL,
    state: JSON.stringify({ gate: "output", command: cmd, proposal: proposal.event }),
    questions: {
      matches_intent: {
        type: "noul",
        instructions: "Does the proposed event do what the command asked, and nothing more?",
        criteria: {
          true: "Same item, same intent, no extra fields invented.",
          false: "Drifts from the command, adds fields, or touches another item.",
        },
      },
      no_side_effect: {
        type: "noul",
        instructions: "Is the proposed event free of side effects outside the JEV domain?",
        criteria: {
          true: "It changes JEV state only.",
          false: "It would send mail, push code, charge money, or notify a person.",
        },
      },
      allow_apply: {
        type: "choice",
        instructions: "May the harness apply this event now?",
        criteria: LIGHT_CRITERIA,
      },
    },
  };
}

// ---------------------------------------------------------------- compose

function noul(answers: Record<string, TypesafeAnswer>, id: string): number | undefined {
  const a = answers[id];
  return a && a.type === "noul" ? (a as NoulAnswer).noul : undefined;
}
function choice(answers: Record<string, TypesafeAnswer>, id: string): ChoiceAnswer | undefined {
  const a = answers[id];
  return a && a.type === "choice" ? (a as ChoiceAnswer) : undefined;
}

/** Local, code-only gate. Runs before any judge and cannot be overridden by one. */
export function localGate(cmd: Command): { light: Light; reasons: string[] } {
  const illegal = assertLegalCommand(cmd);
  if (illegal) return { light: "RED", reasons: [`local: ${illegal}`] };
  if (HUMAN_GATED_COMMANDS.has(cmd.name)) return { light: "AMBER", reasons: [`local: ${cmd.name} is C10 human-gated`] };
  return { light: "GREEN", reasons: [] };
}

/**
 * composeAnswers is code. TypeSafe returns an answer map; this turns it into a light.
 * Judge Choice cannot override a local RED. Mid-band noul on harness_can_branch demotes GREEN to AMBER.
 */
export function composeAnswers(
  gate: Gate,
  answers: Record<string, TypesafeAnswer>,
  local: { light: Light; reasons: string[] },
): { light: Light; reasons: string[] } {
  const reasons = [...local.reasons];
  if (local.light === "RED") return { light: "RED", reasons };

  const lightId = gate === "task" ? "allow_now" : "allow_apply";
  const judged = choice(answers, lightId);
  if (!judged) return { light: "RED", reasons: [...reasons, `${lightId}: judge gave no answer`] };

  let light: Light = judged.choice === "GREEN" || judged.choice === "AMBER" || judged.choice === "RED" ? judged.choice : "RED";
  reasons.push(`${lightId}: judge said ${judged.choice} (conf ${judged.confidence.toFixed(2)})`);

  // Dual axes. θ gates P(GREEN); top_prob_floor gates how peaked the pack is.
  const pGreen = judged.probabilities?.GREEN ?? 0;
  const top = Math.max(...Object.values(judged.probabilities ?? { x: 0 }));
  if (light === "GREEN" && pGreen < THETA) {
    light = "AMBER";
    reasons.push(`θ: P(GREEN)=${pGreen.toFixed(2)} < ${THETA}`);
  }
  if (light === "GREEN" && top < TOP_PROB_FLOOR) {
    light = "AMBER";
    reasons.push(`top_prob_floor: peak ${top.toFixed(2)} < ${TOP_PROB_FLOOR}`);
  }

  if (gate === "task") {
    const branch = noul(answers, "harness_can_branch");
    if (branch !== undefined && isMidBandNoul(branch) && light === "GREEN") {
      light = "AMBER";
      reasons.push(`harness_can_branch: mid-band ${branch.toFixed(2)}`);
    }
    const single = noul(answers, "single_intent");
    if (single !== undefined && single < 0.5) {
      light = light === "RED" ? "RED" : "AMBER";
      reasons.push(`single_intent: ${single.toFixed(2)} < 0.5`);
    }
    const rev = choice(answers, "reversibility");
    if (rev?.choice === "irreversible" && light === "GREEN") {
      light = "AMBER";
      reasons.push("reversibility: irreversible needs a human");
    }
  } else {
    const match = noul(answers, "matches_intent");
    if (match !== undefined && match < 0.5) {
      light = "RED";
      reasons.push(`matches_intent: ${match.toFixed(2)} < 0.5`);
    }
    const clean = noul(answers, "no_side_effect");
    if (clean !== undefined && clean < 0.5 && light !== "RED") {
      light = "AMBER";
      reasons.push(`no_side_effect: ${clean.toFixed(2)} < 0.5`);
    }
  }

  // A local AMBER (C10) is a floor: the judge can lower it to RED, never raise it to GREEN.
  if (local.light === "AMBER" && light === "GREEN") light = "AMBER";
  return { light, reasons };
}

// ---------------------------------------------------------------- propose

const EVENT_OF: Record<Command["name"], DomainEventName> = {
  Capture: "Captured",
  Clarify: "Clarified",
  Complete: "Completed",
  StallProject: "ProjectStalled",
  SetNext: "ProjectNextSet",
  StartWaiting: "WaitingStarted",
  ResolveWaiting: "WaitingResolved",
  SnoozeSomeday: "SomedaySnoozed",
  MintInstance: "InstanceMinted",
  Trash: "Trashed",
  CreateHabit: "HabitCreated",
};

/** Propose in memory. Pure: the same command and key always give the same event. Nothing is written. */
export function propose(cmd: Command, idempotencyKey: string): Proposal {
  return {
    idempotencyKey,
    event: { name: EVENT_OF[cmd.name], payload: { ...cmd.payload, command: cmd.name } },
  };
}

// ---------------------------------------------------------------- tape

export type StepKind =
  | "assertLegalCommand"
  | "qualifyTask"
  | "propose"
  | "qualifyOutput"
  | "humanVerdict"
  | "applyCommand"
  | "residual";

export interface Step {
  seq: number;
  kind: StepKind;
  light?: Light;
  reasons?: string[];
  source?: string;
  ms?: number;
  detail?: Record<string, unknown>;
}

export type HumanVerdict = "compose" | "escalate" | "refuse";

export interface ItemOutcome {
  idempotencyKey: string;
  command: Command;
  status: "applied" | "residual" | "parked";
  light: Light;
  steps: Step[];
  event?: DomainEvent;
}

/** RED after either gate → residual. AMBER → park for C10. GREEN → apply. */
export function decide(light: Light): "apply" | "park" | "residual" {
  if (light === "GREEN") return "apply";
  if (light === "AMBER") return "park";
  return "residual";
}

/** A human verdict on a parked item. compose = apply as proposed. escalate/refuse = residual. */
export function applyHumanVerdict(v: HumanVerdict): "apply" | "residual" {
  return v === "compose" ? "apply" : "residual";
}
