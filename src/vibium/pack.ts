/**
 * A pack is a JEV-works `kit/modules` Context: the ONE place a question is written.
 *
 *   Context = { name, description, artifact {type, stateFields}, modules[] }
 *   Module  = { name, purpose, questions {id: Atom}, compose: Decision, notForJev[] }
 *   Atom    = TypeSafe docs question (noul | choice | score + criteria) + polarity + reads + escapeOption?
 *
 * The canonical copies live in JEV-works `kit/modules/contexts/browser.*.json` and pass its meta-type
 * lint (M1–M7). The copies under jev-tape/packs/ are vendored for the runtime; loadPack() re-checks the
 * shape rules that matter at run time so a drifted copy fails closed instead of asking a bad question.
 */
import { readFileSync } from "node:fs";
import {
  TYPESAFE_PINNED_MODEL,
  validateRequest,
  type JsonText,
  type SystemOneRequest,
  type TypesafeQuestion,
} from "../typesafe/contract.ts";
import { checkDecision, type Decision } from "./decide.ts";

export type Polarity = "good-when-yes" | "bad-when-yes" | "higher-is-better" | "lower-is-better" | "neutral";

export type Atom = TypesafeQuestion & {
  polarity: Polarity;
  reads: string[];
  escapeOption?: string;
  note?: string;
};

export interface Module {
  name: string;
  purpose: string;
  questions: Record<string, Atom>;
  compose: Decision;
  notForJev?: Array<{ judgement: string; instead: string }>;
}

export interface Pack {
  name: string;
  description: string;
  artifact: { type: string; stateFields: string[] };
  modules: Module[];
}

export class PackError extends Error {
  problems: string[];
  constructor(name: string, problems: string[]) {
    super(`pack ${name}: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}`);
    this.name = "PackError";
    this.problems = problems;
  }
}

/** Shape rules that must hold before a question is sent. Mirrors JEV-works meta-type M1–M7 at run time. */
export function packProblems(p: Pack): string[] {
  const errs: string[] = [];
  if (!p?.name || !/^[a-z0-9][a-z0-9:.-]*$/.test(p.name)) errs.push("name: lowercase, digits, ':', '.', '-'");
  const fields = p?.artifact?.stateFields;
  if (!p?.artifact?.type || !Array.isArray(fields) || !fields.length) errs.push("artifact: type and non-empty stateFields");
  if (!Array.isArray(p?.modules) || !p.modules.length) return [...errs, "modules: at least one"];
  const seen = new Set<string>();
  for (const m of p.modules) {
    const at = `modules[${m.name}]`;
    if (!m.purpose) errs.push(`${at}.purpose: required`);
    const ids = Object.keys(m.questions ?? {});
    if (!ids.length) errs.push(`${at}.questions: at least one`);
    for (const id of ids) {
      const a = m.questions[id]!;
      if (seen.has(id)) errs.push(`${at}.${id}: id also used in another module`);
      seen.add(id);
      if (!["noul", "choice", "score"].includes(a.type)) errs.push(`${at}.${id}.type: noul | choice | score`);
      const text = typeof a.instructions === "string" ? a.instructions : JSON.stringify(a.instructions ?? "");
      if (!text) errs.push(`${at}.${id}.instructions: required`);
      if ((text.match(/\?/g) ?? []).length !== 1) errs.push(`${at}.${id}: exactly one question mark (M3)`);
      if (!Array.isArray(a.reads) || !a.reads.length) errs.push(`${at}.${id}.reads: declare the fields it reads (M5)`);
      else for (const r of a.reads) if (!fields?.includes(r)) errs.push(`${at}.${id}.reads "${r}" is not a stateField (M5)`);
      if (a.type === "noul") {
        if (!["good-when-yes", "bad-when-yes", "neutral"].includes(a.polarity)) errs.push(`${at}.${id}.polarity: noul polarity (M4)`);
        const c = a.criteria as { true?: JsonText; false?: JsonText } | undefined;
        if (!c || c.true === undefined || c.false === undefined) errs.push(`${at}.${id}: say what yes and no mean (M6)`);
      }
      if (a.type === "choice") {
        if (a.polarity !== "neutral") errs.push(`${at}.${id}.polarity: choice is neutral (M4)`);
        const keys = Object.keys(a.criteria ?? {});
        if (keys.length < 2) errs.push(`${at}.${id}.criteria: ≥ 2 options`);
        if (!a.escapeOption) errs.push(`${at}.${id}: choice needs an escapeOption (M7, NETER P5)`);
        else if (!keys.includes(a.escapeOption)) errs.push(`${at}.${id}.escapeOption "${a.escapeOption}" is not an option`);
      }
      if (a.type === "score") {
        if (!["higher-is-better", "lower-is-better", "neutral"].includes(a.polarity)) errs.push(`${at}.${id}.polarity: score polarity (M4)`);
        if (!Array.isArray(a.criteria) || a.criteria.length < 2 || a.criteria.length > 10) errs.push(`${at}.${id}.criteria: 2–10 ordered levels`);
      }
    }
    errs.push(...checkDecision(m.compose, new Set(ids)).map((e) => `${at}.${e}`));
  }
  return errs;
}

export function parsePack(json: string, label = "pack"): Pack {
  let p: Pack;
  try {
    p = JSON.parse(json) as Pack;
  } catch (e) {
    throw new PackError(label, [`not JSON: ${(e as Error).message}`]);
  }
  const problems = packProblems(p);
  if (problems.length) throw new PackError(p?.name ?? label, problems);
  return p;
}

export function loadPack(path: string): Pack {
  return parsePack(readFileSync(path, "utf8"), path);
}

export function moduleOf(p: Pack, name: string): Module {
  const m = p.modules.find((x) => x.name === name);
  if (!m) throw new PackError(p.name, [`no module "${name}" (have ${p.modules.map((x) => x.name).join(", ")})`]);
  return m;
}

/** The API receives exactly the documented question shape; the meta-type annotations stay here. */
export function toQuestion(a: Atom): TypesafeQuestion {
  const { polarity: _p, reads: _r, escapeOption: _e, note: _n, ...q } = a;
  return q as TypesafeQuestion;
}

/** Only declared fields reach TypeSafe. An undeclared field is a bug, not a bonus. */
export function trimState(p: Pack, state: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(p.artifact.stateFields);
  const extra = Object.keys(state).filter((k) => !allowed.has(k));
  if (extra.length) throw new PackError(p.name, [`state has undeclared fields: ${extra.join(", ")}`]);
  const out: Record<string, unknown> = {};
  for (const k of p.artifact.stateFields) if (state[k] !== undefined) out[k] = state[k];
  return out;
}

/** One POST per module: every question of the module over one shared state (SPEC-v1-SPEED path 1). */
export function buildRequest(p: Pack, moduleName: string, state: Record<string, unknown>): SystemOneRequest {
  const m = moduleOf(p, moduleName);
  const req: SystemOneRequest = {
    model: TYPESAFE_PINNED_MODEL,
    state: trimState(p, state) as JsonText,
    questions: Object.fromEntries(Object.entries(m.questions).map(([id, a]) => [id, toQuestion(a)])),
  };
  const bad = validateRequest(req);
  if (bad) throw new PackError(p.name, [`${bad.kind}: ${bad.message}`]);
  return req;
}
