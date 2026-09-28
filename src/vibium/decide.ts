/**
 * Answers → verdict, from JSON rules. A port of JEV-works `kit/gate/decide.ts` onto the TypeSafe
 * wire shapes in ../typesafe/contract.ts, so a pack written for the JEV-works kit runs here unchanged.
 *
 * Semantics the lab measured (NETER P4–P6): a noul acts only at its confident ends (`is: yes|no|unsure`),
 * a choice by its selected option, a score by level, and any distribution by its normalised entropy.
 * A missing answer makes its leaf UNKNOWN, which propagates, so a rule never fires on an answer that
 * was not given (the NaN-reads-as-pass bug, LESSONS L22). First rule that definitely holds wins.
 * Pure: no I/O, no model calls.
 */
import type { TypesafeAnswer } from "../typesafe/contract.ts";

export type Verdict = true | false | "escalate";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { q: string; is: "yes" | "no" | "unsure" }
  | { q: string; choice: string }
  | { q: string; choiceIn: string[] }
  | { q: string; scoreAtLeast: number }
  | { q: string; entropyAbove: number };

export interface Decision {
  positive: string;
  thresholds?: { yes: number; no: number };
  rules: Array<{ when: Cond; then: Verdict }>;
  default: Verdict;
}

/** NETER P4: ends 0.70 apart, far outside the ±0.11 per-answer jitter band. */
export const DEFAULT_THRESHOLDS = { yes: 0.85, no: 0.15 } as const;
/** NETER P4 / rule 8: two thresholds closer than this are not two thresholds. */
export const NOISE_FLOOR = 0.11;

export function normEntropy(p: Record<string, number>): number {
  const keys = Object.keys(p);
  if (keys.length < 2) return 0;
  let h = 0;
  for (const k of keys) {
    const v = p[k]!;
    if (v > 0) h -= v * Math.log(v);
  }
  return h / Math.log(keys.length);
}

function distributionOf(a: TypesafeAnswer): Record<string, number> | undefined {
  if (a.type === "noul") return { true: a.noul, false: 1 - a.noul };
  return a.probabilities;
}

export function holds(
  c: Cond,
  answers: Record<string, TypesafeAnswer>,
  t: { yes: number; no: number } = DEFAULT_THRESHOLDS,
): boolean | undefined {
  if ("all" in c) {
    const vs = c.all.map((x) => holds(x, answers, t));
    return vs.includes(false) ? false : vs.includes(undefined) ? undefined : true;
  }
  if ("any" in c) {
    const vs = c.any.map((x) => holds(x, answers, t));
    return vs.includes(true) ? true : vs.includes(undefined) ? undefined : false;
  }
  if ("not" in c) {
    const v = holds(c.not, answers, t);
    return v === undefined ? undefined : !v;
  }
  const a = answers[c.q];
  if (!a) return undefined;
  if ("is" in c) {
    if (a.type !== "noul") return undefined;
    const end = a.noul >= t.yes ? "yes" : a.noul <= t.no ? "no" : "unsure";
    return end === c.is;
  }
  if ("choice" in c) return a.type === "choice" ? a.choice === c.choice : undefined;
  if ("choiceIn" in c) return a.type === "choice" ? c.choiceIn.includes(a.choice) : undefined;
  if ("scoreAtLeast" in c) return a.type === "score" ? a.score >= c.scoreAtLeast : undefined;
  if ("entropyAbove" in c) {
    const d = distributionOf(a);
    return d ? normEntropy(d) > c.entropyAbove : undefined;
  }
  return undefined;
}

export interface Decided {
  verdict: Verdict;
  rule: number | "default";
}

export function decide(answers: Record<string, TypesafeAnswer>, d: Decision): Decided {
  const t = d.thresholds ?? DEFAULT_THRESHOLDS;
  for (let i = 0; i < d.rules.length; i++) {
    if (holds(d.rules[i]!.when, answers, t) === true) return { verdict: d.rules[i]!.then, rule: i };
  }
  return { verdict: d.default, rule: "default" };
}

function condQuestions(c: Cond, out: Set<string>): void {
  if ("all" in c) c.all.forEach((x) => condQuestions(x, out));
  else if ("any" in c) c.any.forEach((x) => condQuestions(x, out));
  else if ("not" in c) condQuestions(c.not, out);
  else out.add(c.q);
}

/** Static checks on a Decision against the question ids it may reference. All problems at once. */
export function checkDecision(d: Decision, ids: Set<string>): string[] {
  const errs: string[] = [];
  if (!d || typeof d.positive !== "string" || !d.positive) errs.push("compose.positive: required");
  if (!Array.isArray(d?.rules)) errs.push("compose.rules: required array");
  if (d?.default !== true && d?.default !== false && d?.default !== "escalate") errs.push("compose.default: true | false | escalate");
  if (d?.thresholds) {
    const { yes, no } = d.thresholds;
    if (!(yes > no)) errs.push("compose.thresholds: yes must exceed no");
    else if (yes - no < NOISE_FLOOR) errs.push(`compose.thresholds: yes and no are within the ${NOISE_FLOOR} noise floor (NETER P4)`);
  }
  const used = new Set<string>();
  for (const [i, r] of (d?.rules ?? []).entries()) {
    if (r.then !== true && r.then !== false && r.then !== "escalate") errs.push(`compose.rules[${i}].then: true | false | escalate`);
    condQuestions(r.when, used);
  }
  for (const q of used) if (!ids.has(q)) errs.push(`compose references unknown question "${q}"`);
  return errs;
}
