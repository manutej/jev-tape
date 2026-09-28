import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryTape } from "./engine.ts";
import { stubJudge } from "./judge.ts";
import { runJob } from "./job.ts";
import { runWaiting } from "./waiting.ts";
import { runSomedayReview } from "./someday.ts";
import { runHabit } from "./habit.ts";

const deps = () => ({ judge: stubJudge(), tape: memoryTape(), human: async () => "compose" as const });

test("job twin: 10 items → 2 batches of 8, same fold as the workflow", async () => {
  const cmds = Array.from({ length: 10 }, (_, i) => ({ name: "Capture" as const, payload: { text: `i${i}` } }));
  const r = await runJob(cmds, deps());
  assert.equal(r.batches, 2);
  assert.equal(r.applied.length, 10);
});

test("waiting twin: nudges until resolved, then ResolveWaiting through C10", async () => {
  let ticks = 0;
  const d = deps();
  const r = await runWaiting({ display_name: "Ana", what: "confirm", waitOrNudge: async () => ++ticks >= 3 }, d);
  assert.equal(r.nudges, 2);
  assert.equal(r.resolved?.status, "applied");
  assert.ok((await d.tape.entries()).some((e) => e.event === "WaitingNudged"));
});

test("someday twin: keep, snooze, trash", async () => {
  const r = await runSomedayReview("s-1", ["keep", "snooze", "trash"], deps());
  assert.equal(r.reviews, 3);
  assert.equal(r.final, "trashed");
});

test("habit twin mints Instances and never emits HabitCreated", async () => {
  const d = deps();
  const r = await runHabit("stretch", 3, d);
  assert.equal(r.minted, 3);
  assert.ok((await d.tape.entries()).every((e) => e.event === "InstanceMinted"));
});
