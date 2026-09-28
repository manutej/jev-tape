/**
 * Real Temporal, real worker, real history. Needs a Temporal dev server:
 *   TEMPORAL_CLI=/path/to/temporal   → an ephemeral server is started for the test
 *   or a server already on TEMPORAL_ADDRESS (default localhost:7233)
 * Skips (loudly) when neither is available.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countingJudge, stubJudge } from "../judge.ts";
import { createActivities, fileTape } from "./activities.ts";
import { workflowsPath } from "./worker.ts";
import { CONTINUE_AS_NEW_EVERY, JevCorrectnessWorkflow, WaitingWorkflow, humanVerdictSignal, resolveSignal, statusQuery } from "./workflows.ts";
import type { Command } from "../domain.ts";

const { TestWorkflowEnvironment } = await import("@temporalio/testing");
const { Worker, Runtime, DefaultLogger } = await import("@temporalio/worker");
Runtime.install({ logger: new DefaultLogger("WARN") });

async function env() {
  if (process.env.TEMPORAL_CLI) {
    return TestWorkflowEnvironment.createLocal({ server: { executable: { type: "existing-path", path: process.env.TEMPORAL_CLI } } });
  }
  try {
    return await TestWorkflowEnvironment.createFromExistingServer({ address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233" });
  } catch {
    return undefined;
  }
}

const testEnv = await env();

test("JevCorrectnessWorkflow: 10 items → ContinueAsNew, C10 signal, path-0 residuals, idempotent tape", { skip: !testEnv && "no Temporal server (set TEMPORAL_CLI or run temporal server start-dev)" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "jev-tape-"));
  const tapePath = join(dir, "tape.jsonl");
  const judge = countingJudge(stubJudge());
  const taskQueue = `jev-tape-test-${Date.now()}`;
  const worker = await Worker.create({
    connection: testEnv!.nativeConnection,
    namespace: testEnv!.namespace,
    taskQueue,
    workflowsPath,
    activities: createActivities({ judge, tape: fileTape(tapePath) }),
  });

  const commands: Command[] = [
    ...Array.from({ length: 7 }, (_, i) => ({ name: "Capture" as const, payload: { text: `item ${i}` } })),
    { name: "CreateHabit", payload: {} },
    { name: "Complete", payload: { itemKind: "NextAction", itemKey: "na-1" } },
    { name: "Capture", payload: { text: "last" } },
  ];
  const wfId = `test-worklist-${Date.now()}`;

  const result = await worker.runUntil(async () => {
    const handle = await testEnv!.client.workflow.start(JevCorrectnessWorkflow, { taskQueue, workflowId: wfId, args: [{ commands }] });
    // Wait for the C10 park, then answer it.
    for (let i = 0; i < 200; i++) {
      const s = await handle.query(statusQuery);
      if (s.parked.length) {
        await handle.signal(humanVerdictSignal, { key: s.parked[0]!, verdict: "compose" });
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return handle.result();
  });

  assert.equal(result.runs, Math.ceil(commands.length / CONTINUE_AS_NEW_EVERY), "ContinueAsNew every 8");
  assert.equal(result.applied.length, 9);
  assert.deepEqual(result.residual, [`${wfId}:7`], "CreateHabit is the only residual");
  const tape = await fileTape(tapePath).entries();
  assert.equal(tape.length, 9);
  assert.equal(new Set(tape.map((t) => t.key)).size, 9, "no duplicate applies");
  // 9 items reached the judge, one POST each (both gates); CreateHabit never did.
  assert.equal(judge.calls, 9);

  // Replay proof: every run of the chain replays from Event History with no activities and no judge.
  const runs: string[] = [];
  for await (const wf of testEnv!.client.workflow.list({ query: `WorkflowId = '${wfId}'` })) runs.push(wf.runId);
  assert.equal(runs.length, 2, "two runs in the ContinueAsNew chain");
  const before = judge.calls;
  for (const runId of runs) {
    const history = await testEnv!.client.workflow.getHandle(wfId, runId).fetchHistory();
    await Worker.runReplayHistory({ workflowsPath }, history, wfId);
  }
  assert.equal(judge.calls, before, "replay made 0 judge calls");
});

test("WaitingWorkflow: nudges on timer, resolve signal, C10 park then compose", { skip: !testEnv && "no Temporal server" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "jev-tape-"));
  const tapePath = join(dir, "tape.jsonl");
  const taskQueue = `jev-tape-test-${Date.now()}`;
  const worker = await Worker.create({
    connection: testEnv!.nativeConnection,
    namespace: testEnv!.namespace,
    taskQueue,
    workflowsPath,
    activities: createActivities({ judge: stubJudge(), tape: fileTape(tapePath) }),
  });
  const wfId = `test-waiting-${Date.now()}`;
  const result = await worker.runUntil(async () => {
    const handle = await testEnv!.client.workflow.start(WaitingWorkflow, {
      taskQueue,
      workflowId: wfId,
      args: [{ display_name: "Ana", what: "confirm", nudgeEveryMs: 500, maxNudges: 5 }],
    });
    // Wait for StartWaiting to land on the tape, then let two nudge intervals elapse before resolving.
    for (let i = 0; i < 100; i++) {
      if ((await fileTape(tapePath).entries()).some((t) => t.key === `${wfId}:start`)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Server-side timers on the dev server fire with up to ~1s of latency; give them room.
    await new Promise((r) => setTimeout(r, 3500));
    await handle.signal(resolveSignal, { note: "done" });
    await new Promise((r) => setTimeout(r, 800));
    await handle.signal(humanVerdictSignal, { key: `${wfId}:resolve`, verdict: "compose" });
    return handle.result();
  });
  assert.equal(result.started.status, "applied");
  assert.ok(result.nudges >= 1 && result.nudges <= 5, `nudges=${result.nudges}`);
  assert.equal(result.resolved?.status, "applied");
  const tape = await fileTape(tapePath).entries();
  assert.ok(tape.some((t) => t.event === "WaitingNudged"));
  assert.ok(tape.some((t) => t.event === "WaitingResolved"));
});

test.after(async () => {
  await testEnv?.teardown();
});
