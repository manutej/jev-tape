#!/usr/bin/env node
/** Prove TYPESAFE_API_KEY works. Pin jev-1.13.0. No Gmail send. No GitHub push. */
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
const post = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "jev-1.13.0",
    state: "I can make Oct 2 from 9:00-10:00 CT.",
    questions: { avail: { type: "noul", instructions: "Is this only availability?" } },
  }),
});
const json = JSON.parse(await post.text());
console.log("model=" + json.model);
if (json.model && json.model !== "jev-1.13.0") process.exit(3);
console.log("smoke: ok (no send, no push)");
