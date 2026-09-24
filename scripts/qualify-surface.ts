#!/usr/bin/env node
/**
 * Qualify a Gmail or GitHub fixture. Never send. Never push.
 *   npm run qualify -- fixtures/example-availability.json
 */
import { readFileSync } from "node:fs";

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
  body: JSON.stringify({ model: "jev-1.13.0", state: JSON.stringify(raw), questions }),
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
console.log("qualify: ok (no send, no push)");
