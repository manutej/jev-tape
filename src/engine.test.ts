import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryTape, startEngine } from "./engine.ts";
import { countingJudge, selectJudge, stubJudge } from "./judge.ts";

test("Capture: two gates, apply last, exactly one tape row, ≤ 2 judge calls", async () => {
  const judge = countingJudge(stubJudge());
  const tape = memoryTape();
  const r = await startEngine([{ name: "Capture", payload: { text: "Book dentist" } }], { judge, tape });
  const o = r.outcomes[0]!;
  assert.equal(o.status, "applied");
  assert.deepEqual(o.steps.map((s) => s.kind), ["assertLegalCommand", "qualifyTask", "propose", "qualifyOutput", "applyCommand"]);
  assert.equal(judge.calls, 2);
  assert.equal((await tape.entries()).length, 1);
  assert.equal(o.steps[1]!.source, "stub");
});

test("path 0: illegal command is residual with 0 judge calls", async () => {
  const judge = countingJudge(stubJudge());
  const r = await startEngine([{ name: "CreateHabit", payload: {} }], { judge, tape: memoryTape() });
  assert.equal(r.outcomes[0]!.status, "residual");
  assert.equal(judge.calls, 0);
});

test("judge RED at task gate → residual, no propose, 1 judge call, nothing applied", async () => {
  const judge = countingJudge(stubJudge());
  const tape = memoryTape();
  const r = await startEngine([{ name: "Capture", payload: { text: "[red] wire money" } }], { judge, tape });
  assert.equal(r.outcomes[0]!.status, "residual");
  assert.equal(judge.calls, 1);
  assert.equal((await tape.entries()).length, 0);
});

test("C10: Complete parks; compose applies, refuse is residual", async () => {
  const cmd = { name: "Complete" as const, payload: { itemKind: "NextAction", itemKey: "na-1" } };
  const composed = await startEngine([cmd], { judge: stubJudge(), tape: memoryTape(), human: async () => "compose" });
  assert.equal(composed.outcomes[0]!.status, "applied");
  assert.ok(composed.outcomes[0]!.steps.some((s) => s.kind === "humanVerdict"));
  const refused = await startEngine([cmd], { judge: stubJudge(), tape: memoryTape(), human: async () => "refuse" });
  assert.equal(refused.outcomes[0]!.status, "residual");
  const defaulted = await startEngine([cmd], { judge: stubJudge(), tape: memoryTape() });
  assert.equal(defaulted.outcomes[0]!.status, "residual", "no human → escalate → residual (fail closed)");
});

test("mid-band Capture parks (AMBER) and escalates without a human", async () => {
  const r = await startEngine([{ name: "Capture", payload: { text: "Should we move the offsite?" } }], { judge: stubJudge(), tape: memoryTape() });
  assert.equal(r.outcomes[0]!.status, "residual");
  assert.equal(r.outcomes[0]!.steps[1]!.light, "AMBER");
});

test("apply is idempotent by key: a retried apply does not double-write", async () => {
  const tape = memoryTape();
  await startEngine([{ name: "Capture", payload: { text: "a" } }], { judge: stubJudge(), tape }, "same");
  await startEngine([{ name: "Capture", payload: { text: "a" } }], { judge: stubJudge(), tape }, "same");
  assert.equal((await tape.entries()).length, 1);
});

test("fail closed: no key and no stub → judge throws, item is residual, nothing thrown to caller", async () => {
  assert.throws(() => selectJudge({}), /Fail closed/);
  const judge = { source: "live" as const, ask: async () => { throw new Error("TYPESAFE_API_KEY is not set"); } };
  const tape = memoryTape();
  const r = await startEngine([{ name: "Capture", payload: { text: "a" } }], { judge, tape });
  assert.equal(r.outcomes[0]!.status, "residual");
  assert.equal((await tape.entries()).length, 0);
});
