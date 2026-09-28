/** TypeSafe System One wire contract. Pure codec. No fetch, no keys, no IO. */
export const TYPESAFE_PINNED_MODEL = "jev-1.13.0" as const;
export type TypesafePinnedModel = typeof TYPESAFE_PINNED_MODEL;
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone" as const;

export type JsonText = string | Record<string, unknown> | unknown[];
export type Primitive = "noul" | "choice" | "score";

export interface NoulQuestion {
  type: "noul";
  instructions: JsonText;
  criteria?: { true?: JsonText; false?: JsonText } | JsonText;
}
export interface ChoiceQuestion {
  type: "choice";
  instructions: JsonText;
  criteria: Record<string, JsonText | null>;
}
export interface ScoreQuestion {
  type: "score";
  instructions: JsonText;
  criteria: JsonText[];
}
export type TypesafeQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface SystemOneRequest {
  state: JsonText;
  model: TypesafePinnedModel;
  questions: Record<string, TypesafeQuestion>;
}

export interface NoulAnswer { type: "noul"; noul: number }
export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}
export interface ScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}
export type TypesafeAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface SystemOneResponse {
  model: string;
  answers: Record<string, TypesafeAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export const NOUL_MID_LOW = 0.4;
export const NOUL_MID_HIGH = 0.6;
export const SCORE_LEVEL_MIN = 2;
export const SCORE_LEVEL_MAX = 10;

export function isMidBandNoul(n: number): boolean {
  return n > NOUL_MID_LOW && n < NOUL_MID_HIGH;
}

export type ContractError = { kind: string; id?: string; message: string };

export function validateRequest(req: SystemOneRequest): ContractError | null {
  const ids = Object.keys(req.questions ?? {});
  if (ids.length === 0) return { kind: "empty-questions", message: "questions map is empty" };
  if (req.model !== TYPESAFE_PINNED_MODEL) {
    return { kind: "wrong-model", message: `model must be ${TYPESAFE_PINNED_MODEL}, got ${req.model}` };
  }
  for (const id of ids) {
    const q = req.questions[id]!;
    if (q.type === "score") {
      const n = q.criteria?.length ?? 0;
      if (n < SCORE_LEVEL_MIN || n > SCORE_LEVEL_MAX) {
        return { kind: "score-level-count", id, message: `${id}: Score needs ${SCORE_LEVEL_MIN}-${SCORE_LEVEL_MAX} labeled levels` };
      }
    }
    if (q.type === "choice") {
      const keys = Object.keys(q.criteria ?? {});
      if (keys.length < 2) return { kind: "choice-criteria", id, message: `${id}: Choice needs ≥2 criteria` };
    }
  }
  return null;
}

/**
 * Validate a response at the network boundary before any code composes on it.
 * Probabilities must sum to ~1, confidence must be a finite number in [0, 1], noul in [0, 1].
 */
export function validateResponse(res: SystemOneResponse, expectedIds: string[]): ContractError | null {
  if (!res || typeof res !== "object" || !res.answers) return { kind: "malformed", message: "response has no answers map" };
  for (const id of expectedIds) {
    const a = res.answers[id];
    if (!a) return { kind: "missing-answer", id, message: `${id}: no answer` };
    if (a.type === "noul") {
      if (!(Number.isFinite(a.noul) && a.noul >= 0 && a.noul <= 1)) return { kind: "bad-noul", id, message: `${id}: noul ${a.noul} not in [0,1]` };
    } else if (a.type === "choice" || a.type === "score") {
      if (!(Number.isFinite(a.confidence) && a.confidence >= 0 && a.confidence <= 1)) return { kind: "bad-confidence", id, message: `${id}: confidence ${a.confidence} not in [0,1]` };
      const sum = Object.values(a.probabilities ?? {}).reduce((x, y) => x + y, 0);
      if (Math.abs(sum - 1) > 0.05) return { kind: "bad-distribution", id, message: `${id}: probabilities sum to ${sum.toFixed(2)}` };
      if (a.type === "choice" && !(a.choice in (a.probabilities ?? {}))) return { kind: "bad-choice", id, message: `${id}: choice ${a.choice} not among probabilities` };
    } else {
      return { kind: "bad-type", id, message: `${id}: unknown answer type` };
    }
  }
  return null;
}

