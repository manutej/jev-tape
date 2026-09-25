/**
 * Gmail / GitHub qualify packs and the gate over their answers.
 * Jev answers factual questions only. The verdict is computed here, in code, by jev-core `gate()` (R2, D4).
 * θ is smoke-only: uncalibrated, so nothing this produces ever applies a write (D5).
 */
import {
  gate,
  isMidBand,
  type Answer,
  type GateResult,
  type Question,
  type Theta,
} from "../.jev/jev-core.ts";

/** No calibration file exists for these packs yet. The value is a placeholder; `smoke-only` means it never applies. */
export const SURFACE_THETA: Theta = { value: 0.8, source: "smoke-only" };

type ChoiceQ = Extract<Question, { type: "choice" }>;

const GITHUB = {
  effect: {
    type: "choice",
    instructions: "What write is this?",
    criteria: {
      none: "Read or local commit only",
      push_branch: "Push a non-default branch",
      merge_default: "Merge or push the default branch",
    },
  },
  agent_authored: {
    type: "noul",
    instructions: "Was this primarily authored by an agent?",
  },
} satisfies Record<string, Question>;

const GMAIL = {
  audience: {
    type: "choice",
    instructions: "Who is the real audience?",
    criteria: {
      self: "Note to self",
      reviewer: "Known teammate or coordinator",
      client: "Buyer, student cohort, or external client",
      vendor: "Vendor or billing",
      unknown: "Cannot tell",
    },
  },
  money_or_rate: {
    type: "noul",
    instructions: "Does the body discuss rates, invoices, or payment?",
  },
  next_write: {
    type: "choice",
    instructions: "What is the next write?",
    criteria: { none: "No write", draft: "Save a draft", send: "Send mail now" },
  },
} satisfies Record<string, Question>;

/** The choice that names the write, and the action name each answer maps to (C10 names: send, merge-to-default). */
const ACTION: Record<"github" | "gmail", { question: string; map: Record<string, string | undefined> }> = {
  github: { question: "effect", map: { none: undefined, push_branch: "push-branch", merge_default: "merge-to-default" } },
  gmail: { question: "next_write", map: { none: undefined, draft: "draft", send: "send" } },
};

export function surfaceOf(raw: { surface?: unknown }): "github" | "gmail" {
  return raw.surface === "github" ? "github" : "gmail";
}

export function questionsFor(surface: "github" | "gmail"): Record<string, Question> {
  return surface === "github" ? GITHUB : GMAIL;
}

export type SurfaceVerdict = GateResult & { action: string | undefined; aggregate: number };

/**
 * Code rules, no model choice:
 * - veto: a choice answer outside the criteria that were asked;
 * - demotion: a noul in the 0.4–0.6 mid band (a coin flip is never GREEN on its own);
 * - aggregate: the confidence of the choice that names the write (one number, not a conjunction);
 * - C10: `gate()` calls `requiresHuman(action)`, which parks send and merge-to-default even on GREEN.
 */
export function surfaceGate(surface: "github" | "gmail", answers: Record<string, Answer>): SurfaceVerdict {
  const questions = questionsFor(surface);
  const vetoes: string[] = [];
  const demotions: string[] = [];
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id];
    if (!a || a.type !== q.type) {
      vetoes.push(`${id}: expected a ${q.type} answer, got ${a ? a.type : "none"}`);
    } else if (a.type === "choice" && !(a.choice in (q as ChoiceQ).criteria)) {
      vetoes.push(`${id}: "${a.choice}" is not one of the asked criteria`);
    } else if (a.type === "noul" && isMidBand(a)) {
      demotions.push(`${id} noul ${a.noul} is in the mid band`);
    }
  }
  const spec = ACTION[surface];
  const pick = answers[spec.question];
  const action = pick?.type === "choice" ? spec.map[pick.choice] : undefined;
  const aggregate = pick?.type === "choice" ? pick.confidence : Number.NaN;
  const result = gate({ aggregate, theta: SURFACE_THETA, vetoes, demotions, action });
  return { ...result, action, aggregate };
}
