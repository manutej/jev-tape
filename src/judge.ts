/**
 * Which judge answers a gate. Selected once per process from env, never per call.
 *
 *   TYPESAFE_API_KEY set     → live   jev-1.13.0 over POST /v1/systemone. The only real verdict.
 *   JEV_JUDGE=stub           → stub   rule-based answers for showing the tape without a key.
 *   neither                  → fail closed. The activity throws non-retryable; the item is residual.
 *
 * A stub verdict is stamped source="stub" on every step so it can never be mistaken for a judgment.
 */
import { systemOne, TypesafeError } from "./typesafe/client.ts";
import {
  TYPESAFE_PINNED_MODEL,
  type ChoiceAnswer,
  type NoulAnswer,
  type SystemOneRequest,
  type SystemOneResponse,
  type TypesafeAnswer,
  validateRequest,
} from "./typesafe/contract.ts";

export type JudgeSource = "live" | "stub";

export interface JudgeResponse extends SystemOneResponse {
  source: JudgeSource;
}

export interface Judge {
  source: JudgeSource;
  ask(req: SystemOneRequest): Promise<JudgeResponse>;
}

export function liveJudge(apiKey?: string): Judge {
  return {
    source: "live",
    async ask(req) {
      const res = await systemOne(req, { apiKey });
      return { ...res, source: "live" };
    },
  };
}

const choice = (c: string, options: string[], top = 0.9): ChoiceAnswer => {
  const rest = (1 - top) / Math.max(1, options.length - 1);
  const probabilities: Record<string, number> = {};
  for (const o of options) probabilities[o] = o === c ? top : Number(rest.toFixed(2));
  return { type: "choice", choice: c, probabilities, confidence: top };
};
const noul = (p: number): NoulAnswer => ({ type: "noul", noul: p });

/**
 * Deterministic rules so the tape's branches can be exercised without a key.
 * Cues in a Capture text steer it: "?" → mid-band harness_can_branch (AMBER), "[red]" → RED.
 * This does not classify anything. It is a fixture, and it says so on every answer.
 */
export function stubJudge(): Judge {
  return {
    source: "stub",
    async ask(req) {
      const bad = validateRequest(req);
      if (bad) throw new TypesafeError(bad.message, 422, true);
      const state = JSON.parse(String(req.state)) as { gate: string; command: { name: string; payload: Record<string, unknown> } };
      const text = String(state.command.payload.text ?? state.command.payload.note ?? "").toLowerCase();
      const irreversible = ["Complete", "Trash", "ResolveWaiting"].includes(state.command.name);
      const answers: Record<string, TypesafeAnswer> = {};
      const LIGHTS = ["GREEN", "AMBER", "RED"];
      for (const [id, q] of Object.entries(req.questions)) {
        if (q.type === "noul") {
          if (id === "single_intent") answers[id] = noul(text.includes(" and then ") ? 0.2 : 0.93);
          else if (id === "harness_can_branch") answers[id] = noul(text.includes("?") ? 0.5 : 0.9);
          else if (id === "matches_intent") answers[id] = noul(0.95);
          else if (id === "no_side_effect") answers[id] = noul(text.includes("send ") ? 0.2 : 0.96);
          else answers[id] = noul(0.5);
        } else if (q.type === "choice") {
          const opts = Object.keys(q.criteria);
          if (id === "reversibility") answers[id] = choice(irreversible ? "irreversible" : "free", opts);
          else if (id === "allow_now" || id === "allow_apply") {
            const light = text.includes("[red]") ? "RED" : irreversible ? "AMBER" : "GREEN";
            answers[id] = choice(light, LIGHTS, light === "GREEN" ? 0.9 : 0.8);
          } else answers[id] = choice(opts[0]!, opts);
        } else {
          answers[id] = { type: "score", score: 1, legend: {}, probabilities: {}, confidence: 0.5 };
        }
      }
      return { model: TYPESAFE_PINNED_MODEL, answers, usage: { input_tokens: 0, output_tokens: 0 }, source: "stub" };
    },
  };
}

/** Wrap a judge and count its calls. Tests and the replay proof use this. */
export function countingJudge(inner: Judge): Judge & { calls: number } {
  const j = {
    source: inner.source,
    calls: 0,
    async ask(req: SystemOneRequest) {
      j.calls += 1;
      return inner.ask(req);
    },
  };
  return j;
}

export function selectJudge(env: NodeJS.ProcessEnv = process.env): Judge {
  const mode = env.JEV_JUDGE ?? (env.TYPESAFE_API_KEY ? "live" : "closed");
  if (mode === "live") {
    if (!env.TYPESAFE_API_KEY) throw new TypesafeError("JEV_JUDGE=live but TYPESAFE_API_KEY is not set. Fail closed.", 401, true);
    return liveJudge(env.TYPESAFE_API_KEY);
  }
  if (mode === "stub") return stubJudge();
  throw new TypesafeError(
    "TYPESAFE_API_KEY is not set and JEV_JUDGE is not 'stub'. Fail closed: no verdict is invented.",
    401,
    true,
  );
}
