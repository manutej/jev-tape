import { test } from "node:test";
import assert from "node:assert/strict";
import { composeAnswers, localGate, propose, taskRequest, outputRequest, THETA, TOP_PROB_FLOOR } from "./loop.ts";
import type { TypesafeAnswer } from "./typesafe/contract.ts";
import { validateRequest, validateResponse } from "./typesafe/contract.ts";

const choice = (c: string, p: Record<string, number>, confidence = 0.9): TypesafeAnswer => ({ type: "choice", choice: c, probabilities: p, confidence });
const noul = (n: number): TypesafeAnswer => ({ type: "noul", noul: n });
const green = { GREEN: 0.9, AMBER: 0.05, RED: 0.05 };

test("θ and top_prob_floor are different numbers (dual axes)", () => {
  assert.notEqual(THETA, TOP_PROB_FLOOR);
});

test("local RED wins over judge GREEN", () => {
  const r = composeAnswers("task", { allow_now: choice("GREEN", green) }, { light: "RED", reasons: ["local: illegal"] });
  assert.equal(r.light, "RED");
});

test("judge GREEN with peaked pack → GREEN", () => {
  const r = composeAnswers("task", { allow_now: choice("GREEN", green), harness_can_branch: noul(0.9), single_intent: noul(0.9) }, { light: "GREEN", reasons: [] });
  assert.equal(r.light, "GREEN");
});

test("mid-band harness_can_branch demotes GREEN to AMBER", () => {
  const r = composeAnswers("task", { allow_now: choice("GREEN", green), harness_can_branch: noul(0.5) }, { light: "GREEN", reasons: [] });
  assert.equal(r.light, "AMBER");
  assert.ok(r.reasons.some((x) => x.startsWith("harness_can_branch")));
});

test("P(GREEN) below θ demotes to AMBER", () => {
  const r = composeAnswers("task", { allow_now: choice("GREEN", { GREEN: 0.6, AMBER: 0.3, RED: 0.1 }) }, { light: "GREEN", reasons: [] });
  assert.equal(r.light, "AMBER");
});

test("C10 local AMBER is a floor: judge GREEN cannot raise it", () => {
  const local = localGate({ name: "Complete", payload: { itemKind: "NextAction" } });
  assert.equal(local.light, "AMBER");
  const r = composeAnswers("output", { allow_apply: choice("GREEN", green), matches_intent: noul(0.9) }, local);
  assert.equal(r.light, "AMBER");
});

test("judge RED → RED; missing light answer → RED", () => {
  assert.equal(composeAnswers("task", { allow_now: choice("RED", { GREEN: 0.1, AMBER: 0.1, RED: 0.8 }) }, { light: "GREEN", reasons: [] }).light, "RED");
  assert.equal(composeAnswers("task", {}, { light: "GREEN", reasons: [] }).light, "RED");
});

test("output gate: matches_intent < 0.5 is RED", () => {
  const r = composeAnswers("output", { allow_apply: choice("GREEN", green), matches_intent: noul(0.2) }, { light: "GREEN", reasons: [] });
  assert.equal(r.light, "RED");
});

test("CreateHabit is local RED; Complete on Project is local RED", () => {
  assert.equal(localGate({ name: "CreateHabit", payload: {} }).light, "RED");
  assert.equal(localGate({ name: "Complete", payload: { itemKind: "Project" } }).light, "RED");
});

test("packs validate against the wire contract and pin jev-1.13.0", () => {
  const cmd = { name: "Capture" as const, payload: { text: "x" } };
  const t = taskRequest(cmd);
  assert.equal(validateRequest(t), null);
  assert.equal(t.model, "jev-1.13.0");
  assert.equal(Object.keys(t.questions).length, 4);
  const o = outputRequest(cmd, propose(cmd, "k"));
  assert.equal(validateRequest(o), null);
});

test("propose is deterministic and writes nothing", () => {
  const cmd = { name: "Capture" as const, payload: { text: "x" } };
  assert.deepEqual(propose(cmd, "k1"), propose(cmd, "k1"));
  assert.equal(propose(cmd, "k1").event.name, "Captured");
});

test("validateResponse rejects a distribution that does not sum to 1 and accepts the stub shape", () => {
  const ok = { model: "jev-1.13.0", answers: { a: noul(0.3), b: choice("GREEN", green) }, usage: { input_tokens: 1, output_tokens: 1 } };
  assert.equal(validateResponse(ok, ["a", "b"]), null);
  const bad = { ...ok, answers: { a: noul(0.3), b: choice("GREEN", { GREEN: 0.9, AMBER: 0.9, RED: 0.9 }) } };
  assert.equal(validateResponse(bad, ["a", "b"])?.kind, "bad-distribution");
  assert.equal(validateResponse(ok, ["a", "zzz"])?.kind, "missing-answer");
});

