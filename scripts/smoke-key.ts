#!/usr/bin/env node
/** Prove TYPESAFE_API_KEY works. Pin jev-1.13.0. No Gmail send. No GitHub push. */
import { systemOne, TypesafeError } from "../src/typesafe/client.ts";
import { TYPESAFE_PINNED_MODEL } from "../src/typesafe/contract.ts";

const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.error("TYPESAFE_API_KEY is not set.");
  console.error("Create at https://console.typesafe.ai/keys");
  process.exit(1);
}
const headers = { authorization: "Bearer " + key, "content-type": "application/json" };
const modelsRes = await fetch("https://api.typesafe.ai/v1/models", { headers });
if (!modelsRes.ok) {
  console.error("GET /v1/models", modelsRes.status);
  process.exit(modelsRes.status === 401 ? 1 : 2);
}
console.log("models: ok");

// Through the one client: pinned request, fail closed, response.model checked.
let res;
try {
  res = await systemOne({
    model: TYPESAFE_PINNED_MODEL,
    state: "I can make Oct 2 from 9:00-10:00 CT.",
    questions: { avail: { type: "noul", instructions: "Is this only availability?" } },
  });
} catch (e) {
  const err = e as TypesafeError;
  console.error(`POST /v1/systemone failed: ${err.message}`);
  process.exit(err.code === "wrong-model" ? 3 : err.status === 401 ? 1 : 2);
}
console.log("model=" + res.model);
if (res.model !== TYPESAFE_PINNED_MODEL) process.exit(3);
console.log("smoke: ok (no send, no push)");
