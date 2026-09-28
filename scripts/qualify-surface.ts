#!/usr/bin/env node
/**
 * Qualify a Gmail, GitHub, or wiring fixture. Never send. Never push. Never write the rung.
 *   npm run qualify -- fixtures/example-availability.json
 *   npm run qualify -- fixtures/wiring-e5-claim.json
 */
import { readFileSync } from "node:fs";
import { composeWiring, frozenRule, WIRING_SCOPE_LEVELS, type RuleResult } from "../src/wiring-compose.ts";

const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.error("TYPESAFE_API_KEY is not set. Copy .env.example → .env on this machine.");
  process.exit(1);
}

const path = process.argv[2];
if (!path) {
  console.error("usage: npm run qualify -- fixtures/example-availability.json");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const surface = String(raw.surface ?? "unknown");

// ---- wiring surface: path 0 first (code, never Jev) ----------------------
// The frozen rule is arithmetic. It is computed here and placed into state.
// A failed rule is a local RED that the judge cannot override.
let ruleResult: RuleResult | null = null;
if (surface === "wiring") {
  const gap = Number(raw.measured?.pooled_overall?.B_minus_A_pts);
  const thr = Number(raw.claim?.threshold_pts);
  if (!Number.isFinite(gap) || !Number.isFinite(thr)) {
    console.error("wiring fixture needs measured.pooled_overall.B_minus_A_pts and claim.threshold_pts");
    process.exit(1);
  }
  ruleResult = frozenRule(gap, thr);
  console.log(`path0 rule: B-A=${gap}pts threshold=${thr}pts -> ${ruleResult.passes ? "pass" : "FAIL (local RED)"}`);
}

const state = surface === "wiring" ? { ...raw, rule_result: ruleResult } : raw;


const questions =
  surface === "github"
    ? {
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
        allow_now: {
          type: "choice",
          instructions: "May a harness execute this write now?",
          criteria: { GREEN: "Safe to apply after compose", AMBER: "Park for a human", RED: "Refuse" },
        },
      }
    : surface === "wiring"
      ? {
          legend_readable: {
            type: "noul",
            instructions:
              "Does the pack legend define every sentinel and convention the pack body uses, so a reader with no access to the builder's expansion code can expand it? The run's own lesson: information-equivalent must mean spec-equivalent for the reader.",
          },
          evidence_sufficiency: {
            type: "choice",
            instructions:
              "Given rule_result, measured, and deviations, what does the evidence support about the factored form?",
            criteria: {
              parity: "Within the frozen rule and the residual is localized and arm-independent",
              tax: "A real comprehension tax attributable to the factored form",
              insufficient_n: "Deviations or cell sizes too small to support either reading",
            },
          },
          promote_rung: {
            type: "choice",
            instructions: "May claim.rung be written into the MAY list now, as worded, with its recorded limits?",
            criteria: {
              GREEN: "Write the rung as worded after compose; a human still performs the write",
              AMBER: "Park for a human; the rung needs rewording or a rerun first",
              RED: "Refuse; the claim is not supported by the recorded run",
            },
          },
          scope: {
            type: "score",
            instructions: "How far does claim.rung reach beyond what measured records? Check it against claim.may_not.",
            criteria: [...WIRING_SCOPE_LEVELS],
          },
        }
      : {
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
        };

const res = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({ model: "jev-1.13.0", state: JSON.stringify(state), questions }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`TypeSafe ${res.status}: ${text.slice(0, 300)}`);
  process.exit(res.status === 401 ? 1 : 2);
}
const json = JSON.parse(text);
console.log(`model=${json.model}`);
console.log(JSON.stringify(json.answers, null, 2));
if (json.usage) console.log(`usage in=${json.usage.input_tokens} out=${json.usage.output_tokens}`);

// ---- composeAnswers is code (wiring surface only) --------------------------
if (surface === "wiring" && ruleResult) {
  const { verdict, reasons } = composeWiring(ruleResult, json.answers ?? {});
  console.log(`verdict=${verdict}`);
  for (const r of reasons) console.log(`  ${r}`);
  console.log("apply: parked (C10). Writing the rung is a human write in manutej/wiring-and-the-whole.");
}

console.log("qualify: ok (no send, no push, no rung written)");
