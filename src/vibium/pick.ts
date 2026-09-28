/**
 * pickRef — the Run-side fork: which element on this page is the one the step needs?
 *
 * One Choice over the map lines (rank wide, read narrow). Each option is a map line keyed by its @ref;
 * `none` is the escape (NETER P5: without it, a page with no fitting element gets a confident wrong
 * pick). The answer is a ref plus its probability and the distribution's entropy, and the caller
 * decides in code whether that is peaked enough to act on. Status: drafted, not measured (SURFACES-VIBIUM §9).
 */
import { TYPESAFE_PINNED_MODEL, validateRequest, type ChoiceQuestion, type SystemOneRequest } from "../typesafe/contract.ts";
import { parseMap, type MapLine } from "./cli.ts";
import { normEntropy } from "./decide.ts";
import type { Judge } from "./tape.ts";

/** TypeSafe caps a choice at 255 options (NETER P16); keep well under it so the questions stay small. */
export const MAX_OPTIONS = 120;

export interface Pick {
  ref: string | null;
  line: MapLine | null;
  p: number;
  entropy: number;
  probabilities: Record<string, number>;
  ms: number;
  options: number;
}

export function pickRequest(goal: string, map: string, page: { url: string; title: string }, opts: { onlyTags?: RegExp } = {}): SystemOneRequest {
  let lines = parseMap(map);
  if (opts.onlyTags) lines = lines.filter((l) => opts.onlyTags!.test(l.tag));
  lines = lines.slice(0, MAX_OPTIONS);
  if (!lines.length) throw new Error("pickRef: no candidate elements in the map");
  const criteria: Record<string, string> = {};
  for (const l of lines) criteria[l.ref] = `[${l.tag}] ${l.label}`.trim();
  criteria.none = "No listed element fits this purpose.";
  const question: ChoiceQuestion = {
    type: "choice",
    instructions: `Which one element on this page is the one to use to ${goal}?`,
    criteria,
  };
  const req: SystemOneRequest = {
    model: TYPESAFE_PINNED_MODEL,
    state: { url: page.url, title: page.title, goal },
    questions: { pick: question },
  };
  const bad = validateRequest(req);
  if (bad) throw new Error(`pickRef: ${bad.message}`);
  return req;
}

export async function pickRef(goal: string, map: string, page: { url: string; title: string }, judge: Judge, opts: { onlyTags?: RegExp; minP?: number } = {}): Promise<Pick> {
  const req = pickRequest(goal, map, page, opts);
  const t0 = performance.now();
  const res = await judge(req);
  const ms = Math.round(performance.now() - t0);
  const a = res.answers.pick;
  if (!a || a.type !== "choice") throw new Error("pickRef: judge returned no choice");
  const probabilities = a.probabilities ?? {};
  const p = probabilities[a.choice] ?? 0;
  const minP = opts.minP ?? 0.85;
  const chosen = a.choice !== "none" && p >= minP ? a.choice : null;
  const line = chosen ? parseMap(map).find((l) => l.ref === chosen) ?? null : null;
  return { ref: chosen, line, p, entropy: normEntropy(probabilities), probabilities, ms, options: Object.keys(req.questions.pick!.type === "choice" ? (req.questions.pick as ChoiceQuestion).criteria : {}).length };
}
