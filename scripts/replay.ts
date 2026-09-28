#!/usr/bin/env node
/**
 * Replay proof. Fetch a workflow's Event History and replay it through the workflow code
 * with NO activities registered and NO judge. If the code and the history agree, replay
 * succeeds: every verdict came from Event History; TypeSafe was called 0 times.
 *
 *   npm run replay -- <workflowId>
 */
import { Client, Connection } from "@temporalio/client";
import { Worker, Runtime, DefaultLogger } from "@temporalio/worker";
import { temporalTarget } from "../src/temporal/connection.ts";
import { workflowsPath } from "../src/temporal/worker.ts";

const wfId = process.argv[2];
if (!wfId) {
  console.error("usage: npm run replay -- <workflowId>");
  process.exit(1);
}
Runtime.install({ logger: new DefaultLogger("WARN") });
const target = temporalTarget();
const connection = await Connection.connect({ address: target.address, tls: target.tls, ...(target.apiKey ? { apiKey: target.apiKey } : {}) });
const client = new Client({ connection, namespace: target.namespace });

// Every run in the ContinueAsNew chain, oldest first.
const runs: string[] = [];
for await (const wf of client.workflow.list({ query: `WorkflowId = '${wfId}'` })) runs.push(wf.runId);
runs.reverse();

let events = 0;
let activitiesCompleted = 0;
let judgePosts = 0; // no activities are registered in a replay worker: nothing can POST
for (const runId of runs) {
  const history = await client.workflow.getHandle(wfId, runId).fetchHistory();
  events += history.events?.length ?? 0;
  activitiesCompleted += history.events?.filter((e) => e.activityTaskCompletedEventAttributes).length ?? 0;
  // The real workflowId matters: idempotency keys and C10 park keys derive from it.
  await Worker.runReplayHistory({ workflowsPath }, history, wfId);
  console.log(`replay ok  run=${runId} events=${history.events?.length ?? 0}`);
}
console.log(`\nworkflow ${wfId}: ${runs.length} run(s), ${events} events, ${activitiesCompleted} activity results reused from history`);
console.log(`TypeSafe POSTs during replay: ${judgePosts}`);
await connection.close();
