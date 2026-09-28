import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeWiring, frozenRule, scoreLevel } from "./wiring-compose.ts";

const rec = JSON.parse(readFileSync(new URL("../fixtures/wiring-e5-claim.recorded.json", import.meta.url), "utf8"));

test("replay: recorded E5.1 answer map composes to the recorded verdict without TypeSafe", () => {
  const { verdict, reasons } = composeWiring(rec.rule_result, rec.answers);
  assert.equal(verdict, rec.verdict);
  assert.ok(reasons.some((r) => r.startsWith("promote_rung=RED")));
  assert.ok(reasons.some((r) => r.includes("implies something the run did not measure")));
});

test("frozen rule is code: -3.7 passes a -5 threshold, -5 does not", () => {
  assert.equal(frozenRule(-3.7, -5).passes, true);
  assert.equal(frozenRule(-5, -5).passes, false);
});

test("failed rule is a local RED the judge cannot override", () => {
  const green = structuredClone(rec.answers);
  green.promote_rung.choice = "GREEN";
  green.promote_rung.probabilities = { GREEN: 0.9, AMBER: 0.05, RED: 0.05 };
  green.legend_readable.noul = 0.95;
  const { verdict } = composeWiring(frozenRule(-6, -5), green);
  assert.equal(verdict, "RED");
});

test("score is continuous with 0-indexed legend keys; 1.05 reads level 1", () => {
  assert.match(scoreLevel(rec.answers.scope), /implies something the run did not measure/);
});

test("GREEN demotes to AMBER on low legend_readable even when everything else is green", () => {
  const green = structuredClone(rec.answers);
  green.promote_rung.choice = "GREEN";
  green.promote_rung.probabilities = { GREEN: 0.9, AMBER: 0.05, RED: 0.05 };
  const { verdict, reasons } = composeWiring(rec.rule_result, green);
  assert.equal(verdict, "AMBER");
  assert.ok(reasons.some((r) => r.includes("legend_readable low")));
});

test("scope at the MAY-NOT level is RED", () => {
  const bad = structuredClone(rec.answers);
  bad.promote_rung.choice = "GREEN";
  bad.promote_rung.probabilities = { GREEN: 0.9, AMBER: 0.05, RED: 0.05 };
  bad.legend_readable.noul = 0.95;
  bad.scope.score = 1.9;
  const { verdict } = composeWiring(rec.rule_result, bad);
  assert.equal(verdict, "RED");
});
