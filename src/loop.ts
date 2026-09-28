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
  /** Which question pack answered. Verdicts from different packs are not comparable. */
  pack?: string;
  oc?: OC;
}

export interface Proposal {
  event: DomainEvent;
  /** Deterministic id: the applier uses it to make the write idempotent across retries. */
  idempotencyKey: string;
}

// ---------------------------------------------------------------- questions

import { OUTPUT_TREE, PACK_VERSION, TASK_TREE, outputQuestions, taskQuestions } from "./typesafe/pack.ts";
export { PACK_VERSION };

/** qualifyTask pack: the v2 tree plus its collapsed root, one POST. spec/QUESTIONS-TASK-v2.md is the source. */
export function taskRequest(cmd: Command): SystemOneRequest {
  return { model: TYPESAFE_PINNED_MODEL, state: JSON.stringify({ gate: "task", pack: PACK_VERSION, command: cmd }), questions: taskQuestions() };
}

/** qualifyOutput pack. The proposal exists only in memory here. Nothing has been written. */
export function outputRequest(cmd: Command, proposal: Proposal): SystemOneRequest {
  return {
    model: TYPESAFE_PINNED_MODEL,
    state: JSON.stringify({ gate: "output", pack: PACK_VERSION, command: cmd, proposal: proposal.event }),
    questions: outputQuestions(),
  };
}

// ---------------------------------------------------------------- compose

const LIGHTS: Light[] = ["GREEN", "AMBER", "RED"];
const worse = (a: Light, b: Light): Light => (LIGHTS.indexOf(a) >= LIGHTS.indexOf(b) ? a : b);

function noul(answers: Record<string, TypesafeAnswer>, id: string): number | undefined {
  const a = answers[id];
  return a && a.type === "noul" ? (a as NoulAnswer).noul : undefined;
}
function choice(answers: Record<string, TypesafeAnswer>, id: string): ChoiceAnswer | undefined {
  const a = answers[id];
  return a && a.type === "choice" ? (a as ChoiceAnswer) : undefined;
}
const maxOf = (...xs: (number | undefined)[]) => Math.max(0, ...xs.filter((x): x is number => x !== undefined));
const has = (...xs: (number | undefined)[]) => xs.some((x) => x !== undefined);

/** Local, code-only gate. Runs before any judge and cannot be overridden by one. */
export function localGate(cmd: Command): { light: Light; reasons: string[] } {
  const illegal = assertLegalCommand(cmd);
  if (illegal) return { light: "RED", reasons: [`local: ${illegal}`] };
  if (HUMAN_GATED_COMMANDS.has(cmd.name)) return { light: "AMBER", reasons: [`local: ${cmd.name} is C10 human-gated`] };
  return { light: "GREEN", reasons: [] };
}

/** Operadic-consistency record: the collapsed root vs the light composed from the tree. */
export interface OC {
  consistent: boolean;
  collapsed: Light | "none";
  composed: Light;
  /** Children that drove the composed light. Empty when composed GREEN. */
  kernel: string[];
  /** Per-parent composed values (Q1..Q6 / Q7..Q9) for the projection and the harness layers. */
  values: Record<string, number | string>;
}

/** Dual axes on a collapsed Light choice. θ gates P(GREEN); top_prob_floor gates peakedness. */
function collapsedLight(judged: ChoiceAnswer | undefined, reasons: string[]): Light | "none" {
  if (!judged) return "none";
  let light: Light = LIGHTS.includes(judged.choice as Light) ? (judged.choice as Light) : "RED";
  reasons.push(`collapsed: judge said ${judged.choice} (conf ${judged.confidence.toFixed(2)})`);
  const pGreen = judged.probabilities?.GREEN ?? 0;
  const top = Math.max(...Object.values(judged.probabilities ?? { x: 0 }));
  if (light === "GREEN" && pGreen < THETA) { light = "AMBER"; reasons.push(`θ: P(GREEN)=${pGreen.toFixed(2)} < ${THETA}`); }
  if (light === "GREEN" && top < TOP_PROB_FLOOR) { light = "AMBER"; reasons.push(`top_prob_floor: peak ${top.toFixed(2)} < ${TOP_PROB_FLOOR}`); }
  return light;
}

/** Task tree compose, exactly as spec/QUESTIONS-TASK-v2.md states it. Returns the composed light and the kernel. */
export function composeTaskTree(a: Record<string, TypesafeAnswer>): { light: Light; kernel: string[]; values: OC["values"]; reasons: string[] } {
  const reasons: string[] = [];
  const kernel: string[] = [];
  const values: OC["values"] = {};
  let light: Light = "GREEN";
  const amber = (why: string, ...ids: string[]) => { light = worse(light, "AMBER"); kernel.push(...ids); reasons.push(why); };
  const red = (why: string, ...ids: string[]) => { light = "RED"; kernel.push(...ids); reasons.push(why); };

  // Q1 single intent = min(1 − Q1.1, 1 − Q1.2); Q1.3 does not lower it.
  const q1 = has(noul(a, "Q1_1"), noul(a, "Q1_2")) ? Math.min(1 - (noul(a, "Q1_1") ?? 0), 1 - (noul(a, "Q1_2") ?? 0)) : noul(a, "Q1");
  if (q1 !== undefined) { values.Q1 = q1; if (q1 < 0.5) amber(`Q1 single_intent ${q1.toFixed(2)} < 0.5`, "Q1"); }

  // Q2 can_branch = 1 − max(Q2.1, Q2.2, Q2.3); mid-band demotes.
  const q2 = has(noul(a, "Q2_1"), noul(a, "Q2_2"), noul(a, "Q2_3")) ? 1 - maxOf(noul(a, "Q2_1"), noul(a, "Q2_2"), noul(a, "Q2_3")) : noul(a, "Q2");
  if (q2 !== undefined) {
    values.Q2 = q2;
    if (isMidBandNoul(q2)) amber(`Q2 harness_can_branch mid-band ${q2.toFixed(2)}`, "Q2");
    else if (q2 < 0.5) amber(`Q2 harness_can_branch ${q2.toFixed(2)} < 0.5`, "Q2");
  }

  // Q3 reversibility: irreversible if any leaf ≥ 0.5, else free; compared with the collapsed Q3 key.
  const q3leaf = has(noul(a, "Q3_1"), noul(a, "Q3_2"), noul(a, "Q3_3")) ? (maxOf(noul(a, "Q3_1"), noul(a, "Q3_2"), noul(a, "Q3_3")) >= 0.5 ? "irreversible" : "free") : undefined;
  const q3 = q3leaf ?? choice(a, "Q3")?.choice;
  if (q3 !== undefined) {
    values.Q3 = q3;
    const c = choice(a, "Q3")?.choice;
    if (q3leaf && c && c !== q3leaf) reasons.push(`Q3 leaves say ${q3leaf}, collapsed says ${c}`);
    if (q3 === "irreversible" || c === "irreversible") amber("Q3 irreversible", "Q3");
  }

  // Q4 outside = max of leaves; ≥ 0.6 means a person must see it.
  const q4 = has(noul(a, "Q4_1"), noul(a, "Q4_2"), noul(a, "Q4_3"), noul(a, "Q4_4")) ? maxOf(noul(a, "Q4_1"), noul(a, "Q4_2"), noul(a, "Q4_3"), noul(a, "Q4_4")) : noul(a, "Q4");
  if (q4 !== undefined) { values.Q4 = q4; if (q4 >= 0.6) amber(`Q4 asks for an outside action ${q4.toFixed(2)}`, "Q4"); }

  // Q5 risk: RED on phishing; AMBER on urgency or money/legal/employment/health; known person doubles urgency pull.
  const q51 = noul(a, "Q5_1"), q52 = noul(a, "Q5_2"), q53 = noul(a, "Q5_3"), q54 = noul(a, "Q5_4");
  const urgency = q51 !== undefined ? Math.min(1, q51 * ((q54 ?? 0) >= 0.5 ? 2 : 1)) : undefined;
  let q5: Light | undefined;
  if (has(q51, q52, q53)) {
    q5 = (q52 ?? 0) >= 0.6 ? "RED" : (urgency ?? 0) >= 0.6 || (q53 ?? 0) >= 0.6 ? "AMBER" : "GREEN";
  } else {
    const c = choice(a, "Q5")?.choice;
    q5 = c && LIGHTS.includes(c as Light) ? (c as Light) : undefined;
  }
  if (q5) {
    values.Q5 = q5;
    if (q5 === "RED") red(`Q5 phishing/scam ${(q52 ?? 0).toFixed(2)}`, "Q5_2");
    else if (q5 === "AMBER") amber(`Q5 ${(urgency ?? 0) >= 0.6 ? "urgent" : "money/legal/employment/health"}`, (urgency ?? 0) >= 0.6 ? "Q5_1" : "Q5_3");
  }
  const q6 = choice(a, "Q6")?.choice;
  if (q6) values.Q6 = q6;
  return { light, kernel, values, reasons };
}

/** Output tree compose, as spec/QUESTIONS-OUTPUT-v2.md states it. */
export function composeOutputTree(a: Record<string, TypesafeAnswer>): { light: Light; kernel: string[]; values: OC["values"]; reasons: string[] } {
  const reasons: string[] = [];
  const kernel: string[] = [];
  const values: OC["values"] = {};
  let light: Light = "GREEN";
  const q7 = noul(a, "Q7"), q8 = noul(a, "Q8"), q9 = noul(a, "Q9");
  if (q7 !== undefined) { values.Q7 = q7; if (q7 < 0.5) { light = "RED"; kernel.push("Q7"); reasons.push(`Q7 matches_intent ${q7.toFixed(2)} < 0.5`); } }
  if (q8 !== undefined) { values.Q8 = q8; if (q8 >= 0.5) { light = worse(light, "AMBER"); kernel.push("Q8"); reasons.push(`Q8 invented field ${q8.toFixed(2)}`); } }
  if (q9 !== undefined) { values.Q9 = q9; if (q9 < 0.5) { light = worse(light, "AMBER"); kernel.push("Q9"); reasons.push(`Q9 side effect ${(1 - q9).toFixed(2)}`); } }
  return { light, kernel, values, reasons };
}

/**
 * composeAnswers is code. The tree composes to a light; the collapsed root gives a second light from the same POST.
 * Agreement is recorded. Disagreement is a FINDING on the verdict (never silent) and the verdict takes the more
 * conservative light. Judge Choice cannot override a local RED; a local AMBER (C10) is a floor.
 */
export function composeAnswers(
  gate: Gate,
  answers: Record<string, TypesafeAnswer>,
  local: { light: Light; reasons: string[] },
): { light: Light; reasons: string[]; oc: OC } {
  const reasons = [...local.reasons];
  const tree = gate === "task" ? composeTaskTree(answers) : composeOutputTree(answers);
  const collapsed = collapsedLight(choice(answers, gate === "task" ? "allow_now" : "allow_apply"), reasons);
  reasons.push(...tree.reasons);
  const oc: OC = { consistent: collapsed === "none" ? false : collapsed === tree.light, collapsed, composed: tree.light, kernel: tree.kernel, values: tree.values };

  if (local.light === "RED") return { light: "RED", reasons, oc };
  if (collapsed === "none" && Object.keys(answers).length === 0) return { light: "RED", reasons: [...reasons, "judge gave no answers"], oc };

  let light: Light = collapsed === "none" ? tree.light : worse(collapsed, tree.light);
  if (collapsed !== "none") {
    reasons.push(oc.consistent ? `oc: consistent (${tree.light})` : `oc: FINDING collapsed ${collapsed} vs composed ${tree.light} → ${light}${tree.kernel.length ? ` (kernel ${[...new Set(tree.kernel)].join(", ")})` : ""}`);
  }
  if (local.light === "AMBER" && light === "GREEN") light = "AMBER";
  return { light, reasons, oc };
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
