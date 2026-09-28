import { test } from "node:test";
import assert from "node:assert/strict";
import { composeAnswers, composeTaskTree, localGate, propose, taskRequest, outputRequest, THETA, TOP_PROB_FLOOR } from "./loop.ts";
import type { TypesafeAnswer } from "./typesafe/contract.ts";
import { validateRequest, validateResponse } from "./typesafe/contract.ts";
import { OUTPUT_QUESTION_COUNT, TASK_QUESTION_COUNT } from "./typesafe/pack.ts";

const choice = (c: string, p: Record<string, number>, confidence = 0.9): TypesafeAnswer => ({ type: "choice", choice: c, probabilities: p, confidence });
const noul = (n: number): TypesafeAnswer => ({ type: "noul", noul: n });
const green = { GREEN: 0.9, AMBER: 0.05, RED: 0.05 };
const ok = { light: "GREEN" as const, reasons: [] };

/** A fully benign task-tree answer set: every leaf says "no", collapsed root GREEN. */
function benign(over: Record<string, TypesafeAnswer> = {}): Record<string, TypesafeAnswer> {
  const a: Record<string, TypesafeAnswer> = { allow_now: choice("GREEN", green), Q1: noul(0.9), Q2: noul(0.9), Q3: choice("free", { free: 0.9, cheap: 0.05, irreversible: 0.05 }), Q4: noul(0.1), Q5: choice("GREEN", green), Q6: choice("action", { action: 0.9, waiting: 0.03, reference: 0.03, someday: 0.02, noise: 0.02 }) };
  for (const id of ["Q1_1", "Q1_2", "Q1_3", "Q2_1", "Q2_2", "Q2_3", "Q3_1", "Q3_2", "Q3_3", "Q4_1", "Q4_2", "Q4_3", "Q4_4", "Q5_1", "Q5_2", "Q5_3", "Q5_4"]) a[id] = noul(0.05);
  return { ...a, ...over };
}

test("pack: 24 task questions + 4 output questions = 28, in the 20–30 sweet spot, both valid on the wire", () => {
  assert.equal(TASK_QUESTION_COUNT, 24);
  assert.equal(OUTPUT_QUESTION_COUNT, 4);
  const cmd = { name: "Capture" as const, payload: { text: "x" } };
  assert.equal(validateRequest(taskRequest(cmd)), null);
  assert.equal(validateRequest(outputRequest(cmd, propose(cmd, "k"))), null);
  assert.equal(taskRequest(cmd).model, "jev-1.13.0");
});

test("θ and top_prob_floor are different numbers (dual axes)", () => {
  assert.notEqual(THETA, TOP_PROB_FLOOR);
});

test("benign tree + collapsed GREEN → GREEN, oc consistent", () => {
  const r = composeAnswers("task", benign(), ok);
  assert.equal(r.light, "GREEN");
  assert.equal(r.oc.consistent, true);
  assert.deepEqual(r.oc.kernel, []);
  assert.equal(r.oc.values.Q6, "action");
});

test("local RED wins over everything", () => {
  const r = composeAnswers("task", benign(), { light: "RED", reasons: ["local: illegal"] });
  assert.equal(r.light, "RED");
});

test("Q2.3 judgment call mid-band composes AMBER; collapsed GREEN → OC FINDING, verdict AMBER, kernel Q2", () => {
  const r = composeAnswers("task", benign({ Q2_3: noul(0.5) }), ok);
  assert.equal(r.light, "AMBER");
  assert.equal(r.oc.consistent, false);
  assert.equal(r.oc.collapsed, "GREEN");
  assert.equal(r.oc.composed, "AMBER");
  assert.ok(r.oc.kernel.includes("Q2"));
  assert.ok(r.reasons.some((x) => x.startsWith("oc: FINDING")));
});

test("Q5.2 phishing composes RED even when the collapsed root says GREEN", () => {
  const r = composeAnswers("task", benign({ Q5_2: noul(0.9) }), ok);
  assert.equal(r.light, "RED");
  assert.deepEqual(r.oc.kernel, ["Q5_2"]);
});

test("Q3 leaves say irreversible → AMBER; a known sender doubles the urgency pull (Q5.1 × Q5.4)", () => {
  assert.equal(composeAnswers("task", benign({ Q3_3: noul(0.8) }), ok).light, "AMBER");
  assert.equal(composeTaskTree(benign({ Q5_1: noul(0.35), Q5_4: noul(0.1) })).light, "GREEN");
  assert.equal(composeTaskTree(benign({ Q5_1: noul(0.35), Q5_4: noul(0.9) })).light, "AMBER");
});

test("collapsed AMBER with a benign tree → OC FINDING, verdict takes the more conservative AMBER", () => {
  const r = composeAnswers("task", benign({ allow_now: choice("AMBER", { GREEN: 0.1, AMBER: 0.8, RED: 0.1 }) }), ok);
  assert.equal(r.light, "AMBER");
  assert.equal(r.oc.consistent, false);
});

test("P(GREEN) below θ demotes the collapsed root to AMBER", () => {
  const r = composeAnswers("task", benign({ allow_now: choice("GREEN", { GREEN: 0.6, AMBER: 0.3, RED: 0.1 }) }), ok);
  assert.equal(r.light, "AMBER");
});

test("C10 local AMBER is a floor: a fully GREEN pack cannot raise it", () => {
  const local = localGate({ name: "Complete", payload: { itemKind: "NextAction" } });
  assert.equal(local.light, "AMBER");
  const r = composeAnswers("output", { allow_apply: choice("GREEN", green), Q7: noul(0.95), Q8: noul(0.05), Q9: noul(0.95) }, local);
  assert.equal(r.light, "AMBER");
});

test("output gate: Q7 < 0.5 is RED; Q8 invented field is AMBER; missing root with no answers is RED", () => {
  assert.equal(composeAnswers("output", { allow_apply: choice("GREEN", green), Q7: noul(0.2) }, ok).light, "RED");
  assert.equal(composeAnswers("output", { allow_apply: choice("GREEN", green), Q7: noul(0.9), Q8: noul(0.7), Q9: noul(0.9) }, ok).light, "AMBER");
  assert.equal(composeAnswers("task", {}, ok).light, "RED");
});

test("CreateHabit is local RED; Complete on Project is local RED", () => {
  assert.equal(localGate({ name: "CreateHabit", payload: {} }).light, "RED");
  assert.equal(localGate({ name: "Complete", payload: { itemKind: "Project" } }).light, "RED");
});

test("propose is deterministic and writes nothing", () => {
  const cmd = { name: "Capture" as const, payload: { text: "x" } };
  assert.deepEqual(propose(cmd, "k1"), propose(cmd, "k1"));
  assert.equal(propose(cmd, "k1").event.name, "Captured");
});

test("validateResponse rejects a distribution that does not sum to 1 and accepts the pack shape", () => {
  const okRes = { model: "jev-1.13.0", answers: { a: noul(0.3), b: choice("GREEN", green) }, usage: { input_tokens: 1, output_tokens: 1 } };
  assert.equal(validateResponse(okRes, ["a", "b"]), null);
  const bad = { ...okRes, answers: { a: noul(0.3), b: choice("GREEN", { GREEN: 0.9, AMBER: 0.9, RED: 0.9 }) } };
  assert.equal(validateResponse(bad, ["a", "b"])?.kind, "bad-distribution");
  assert.equal(validateResponse(okRes, ["a", "zzz"])?.kind, "missing-answer");
});
