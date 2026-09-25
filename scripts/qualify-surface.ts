#!/usr/bin/env node
/**
 * Qualify a Gmail or GitHub fixture. Never send. Never push.
 *   npm run qualify -- fixtures/example-availability.json
 * Jev answers factual questions; the gate verdict is computed in code (src/surface-gate.ts).
 */
import { readFileSync } from "node:fs";
import { systemOne, TypesafeError } from "../src/typesafe/client.ts";
import { TYPESAFE_PINNED_MODEL } from "../src/typesafe/contract.ts";
import { questionsFor, surfaceGate, surfaceOf, SURFACE_THETA } from "../src/surface-gate.ts";

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
const surface = surfaceOf(raw);

let json;
try {
  json = await systemOne({
    model: TYPESAFE_PINNED_MODEL,
    state: JSON.stringify(raw),
    questions: questionsFor(surface),
  });
} catch (e) {
  const err = e as TypesafeError;
  console.error(`TypeSafe ${err.status}: ${err.message.slice(0, 300)}`);
  process.exit(err.status === 401 ? 1 : 2);
}
console.log(`model=${json.model}`);
console.log(JSON.stringify(json.answers, null, 2));
if (json.usage) console.log(`usage in=${json.usage.input_tokens} out=${json.usage.output_tokens}`);

const verdict = surfaceGate(surface, json.answers);
console.log(`gate=${verdict.state} action=${verdict.action ?? "none"} human=${verdict.human} apply=${verdict.apply} θ=${SURFACE_THETA.value} (${SURFACE_THETA.source})`);
for (const r of verdict.reasons) console.log(`  - ${r}`);
console.log("qualify: ok (no send, no push)");
