#!/usr/bin/env node
const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.error("TYPESAFE_API_KEY is not set.");
  console.error("Create at https://console.typesafe.ai/keys");
  process.exit(1);
}

const headers = {
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
};

const modelsRes = await fetch("https://api.typesafe.ai/v1/models", { headers });
const modelsText = await modelsRes.text();
if (!modelsRes.ok) {
  console.error(`GET /v1/models ${modelsRes.status}: ${modelsText.slice(0, 200)}`);
  process.exit(modelsRes.status === 401 ? 1 : 2);
}
console.log("models: ok");

const body = {
  model: "jev-1.13.0",
  state: "I can make Oct 2 from 9:00-10:00 CT for the dry run. Please include me on the invite.",
  questions: {
    external_client: {
      type: "noul",
      instructions: "Is this message addressed to an external client or buyer?",
    },
    is_availability: {
      type: "noul",
      instructions: "Is this only stating the sender's availability for a meeting?",
    },
    next_write: {
      type: "choice",
      instructions: "What is the next write, if any?",
      criteria: {
        none: "No irreversible write",
        draft: "Save a draft",
        send: "Send mail now",
        push: "Push or merge code",
      },
    },
  },
};

const post = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});
const postText = await post.text();
if (!post.ok) {
  console.error(`POST /v1/systemone ${post.status}: ${postText.slice(0, 300)}`);
  process.exit(post.status === 401 ? 1 : 2);
}
const json = JSON.parse(postText);
console.log(`model=${json.model}`);
if (json.model && json.model !== "jev-1.13.0") {
  console.error(`pin miss: wanted jev-1.13.0 got ${json.model}`);
  process.exit(3);
}
console.log("smoke: ok (no send, no push)");
