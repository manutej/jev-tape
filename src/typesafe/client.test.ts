import { test } from "node:test";
import assert from "node:assert/strict";
import { systemOne, TypesafeError } from "./client.ts";
import { TYPESAFE_ENDPOINT, TYPESAFE_PINNED_MODEL, type SystemOneRequest } from "./contract.ts";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const req: SystemOneRequest = {
  model: TYPESAFE_PINNED_MODEL,
  state: "I can make Oct 2 from 9:00-10:00 CT.",
  questions: { avail: { type: "noul", instructions: "Is this only availability?" } },
};
const ok = { model: TYPESAFE_PINNED_MODEL, answers: { avail: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 1, output_tokens: 1 } };

test("posts the pinned model to the System One endpoint with the key in the header only", async () => {
  const f = fakeFetch(200, ok);
  const res = await systemOne(req, { apiKey: "k-test", fetch: f.fn });
  assert.equal(res.model, "jev-1.13.0");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]!.url, TYPESAFE_ENDPOINT);
  const sent = JSON.parse(String(f.calls[0]!.init.body));
  assert.equal(sent.model, "jev-1.13.0");
  assert.equal((f.calls[0]!.init.headers as Record<string, string>).authorization, "Bearer k-test");
  assert.ok(!String(f.calls[0]!.init.body).includes("k-test"));
});

test("an unpinned request model is refused before any fetch", async () => {
  const f = fakeFetch(200, ok);
  await assert.rejects(
    systemOne({ ...req, model: "jev-latest" as never }, { apiKey: "k-test", fetch: f.fn }),
    (e: unknown) => e instanceof TypesafeError && e.nonRetryable && e.status === 422 && e.code === "unpinned",
  );
  assert.equal(f.calls.length, 0);
});

test("missing key fails closed: 401, non-retryable, no fetch, no verdict", async () => {
  const saved = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    const f = fakeFetch(200, ok);
    await assert.rejects(
      systemOne(req, { fetch: f.fn }),
      (e: unknown) => e instanceof TypesafeError && e.status === 401 && e.nonRetryable && e.code === "no-key",
    );
    assert.equal(f.calls.length, 0);
  } finally {
    if (saved !== undefined) process.env.TYPESAFE_API_KEY = saved;
  }
});

test("a response from another model is rejected, non-retryable", async () => {
  const f = fakeFetch(200, { ...ok, model: "jev-1.14.0" });
  await assert.rejects(
    systemOne(req, { apiKey: "k-test", fetch: f.fn }),
    (e: unknown) => e instanceof TypesafeError && e.nonRetryable && e.code === "wrong-model" && /jev-1\.14\.0/.test(e.message),
  );
});

test("HTTP errors keep status; 5xx is retryable, 401 is not", async () => {
  await assert.rejects(
    systemOne(req, { apiKey: "k-test", fetch: fakeFetch(503, "busy").fn }),
    (e: unknown) => e instanceof TypesafeError && e.status === 503 && !e.nonRetryable,
  );
  await assert.rejects(
    systemOne(req, { apiKey: "k-test", fetch: fakeFetch(401, "bad key").fn }),
    (e: unknown) => e instanceof TypesafeError && e.status === 401 && e.nonRetryable,
  );
});

test("a response missing an asked answer is rejected", async () => {
  await assert.rejects(
    systemOne(req, { apiKey: "k-test", fetch: fakeFetch(200, { model: TYPESAFE_PINNED_MODEL, answers: {} }).fn }),
    (e: unknown) => e instanceof TypesafeError && e.code === "bad-response",
  );
});
