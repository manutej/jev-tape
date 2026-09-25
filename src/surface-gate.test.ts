import { test } from "node:test";
import assert from "node:assert/strict";
import type { Answer } from "../.jev/jev-core.ts";
import { questionsFor, surfaceGate, surfaceOf } from "./surface-gate.ts";

const choice = (c: string, confidence: number): Answer => ({ type: "choice", choice: c, probabilities: { [c]: confidence }, confidence });
const noul = (n: number): Answer => ({ type: "noul", noul: n });

test("no pack asks Jev to choose the gate verdict (R2)", () => {
  for (const s of ["gmail", "github"] as const) {
    const qs = questionsFor(s);
    assert.ok(!("allow_now" in qs));
    for (const q of Object.values(qs)) {
      if (q.type === "choice") assert.ok(!Object.keys(q.criteria).some((k) => ["GREEN", "AMBER", "RED"].includes(k)));
    }
  }
});

test("surfaceOf defaults to gmail", () => {
  assert.equal(surfaceOf({ surface: "github" }), "github");
  assert.equal(surfaceOf({ surface: "gmail" }), "gmail");
  assert.equal(surfaceOf({}), "gmail");
});

test("a confident draft is GREEN but never applies: θ is smoke-only", () => {
  const v = surfaceGate("gmail", { audience: choice("reviewer", 0.9), money_or_rate: noul(0.05), next_write: choice("draft", 0.92) });
  assert.equal(v.state, "GREEN");
  assert.equal(v.action, "draft");
  assert.equal(v.human, false);
  assert.equal(v.apply, false);
  assert.ok(v.reasons.some((r) => /smoke-only/.test(r)));
});

test("send is parked by C10 even on GREEN", () => {
  const v = surfaceGate("gmail", { audience: choice("reviewer", 0.9), money_or_rate: noul(0.05), next_write: choice("send", 0.95) });
  assert.equal(v.state, "GREEN");
  assert.equal(v.human, true);
  assert.equal(v.apply, false);
  assert.ok(v.reasons.some((r) => /C10: send/.test(r)));
});

test("merge_default maps to merge-to-default and is parked by C10", () => {
  const v = surfaceGate("github", { effect: choice("merge_default", 0.97), agent_authored: noul(0.9) });
  assert.equal(v.action, "merge-to-default");
  assert.equal(v.human, true);
  assert.equal(v.apply, false);
});

test("low confidence on the write is AMBER", () => {
  const v = surfaceGate("github", { effect: choice("push_branch", 0.6), agent_authored: noul(0.1) });
  assert.equal(v.state, "AMBER");
});

test("a mid-band noul demotes to AMBER", () => {
  const v = surfaceGate("gmail", { audience: choice("self", 0.9), money_or_rate: noul(0.5), next_write: choice("none", 0.95) });
  assert.equal(v.state, "AMBER");
  assert.ok(v.reasons.some((r) => /money_or_rate noul 0.5 is in the mid band/.test(r)));
});

test("an answer outside the asked criteria, or of the wrong type, is a RED veto", () => {
  const off = surfaceGate("gmail", { audience: choice("GREEN", 0.99), money_or_rate: noul(0.0), next_write: choice("none", 0.99) });
  assert.equal(off.state, "RED");
  assert.ok(off.reasons.some((r) => /veto: audience/.test(r)));
  const wrong = surfaceGate("github", { effect: noul(0.9), agent_authored: noul(0.1) });
  assert.equal(wrong.state, "RED");
});
