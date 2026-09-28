#!/usr/bin/env node
/**
 * Ingest a connector into jev through Temporal. No model reads the connector.
 *
 *   npm run ingest                                  one SurfaceIngestWorkflow now (gmail, in:inbox newer_than:7d)
 *   npm run ingest -- --query "in:inbox is:unread" --max 200 --lane 25 --park 30
 *   npm run ingest -- --every 15m                   a Temporal Schedule that runs the same ingest every 15 minutes
 *   npm run ingest -- --every off                   delete the schedule
 *
 * The worker must have a connector: JEV_MCP_COMMAND (stdio) or JEV_MCP_URL (http). For a demo without Gmail:
 *   JEV_MCP_COMMAND="node --experimental-strip-types scripts/mcp-fake-gmail.ts"
 */
import { Client, Connection, ScheduleOverlapPolicy } from "@temporalio/client";
import { temporalTarget, uiUrl } from "../src/temporal/connection.ts";
import { SurfaceIngestWorkflow, TASK_QUEUE, type IngestInput } from "../src/temporal/workflows.ts";

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const input: IngestInput = {
  surface: "gmail",
  query: opt("--query", "in:inbox newer_than:7d")!,
  pageSize: Number(opt("--page", "50")),
  maxItems: opt("--max") ? Number(opt("--max")) : undefined,
  laneSize: Number(opt("--lane", "25")),
  parkTimeoutMs: Number(opt("--park", "0")) > 0 ? Number(opt("--park")) * 1000 : undefined,
};
const every = opt("--every");
const target = temporalTarget();
const connection = await Connection.connect({ address: target.address, tls: target.tls, ...(target.apiKey ? { apiKey: target.apiKey } : {}) });
const client = new Client({ connection, namespace: target.namespace });
const scheduleId = "jev-ingest-gmail";

if (every === "off") {
  await client.schedule.getHandle(scheduleId).delete();
  console.log(`schedule ${scheduleId} deleted`);
} else if (every) {
  const m = every.match(/^(\d+)(m|h)$/);
  if (!m) { console.error("--every takes e.g. 15m, 1h, or off"); process.exit(1); }
  const minutes = Number(m[1]) * (m[2] === "h" ? 60 : 1);
  const handle = await client.schedule.create({
    scheduleId,
    spec: { intervals: [{ every: `${minutes}m` }] },
    policies: { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: "1 day" },
    action: { type: "startWorkflow", workflowType: SurfaceIngestWorkflow, taskQueue: TASK_QUEUE, args: [input] },
  }).catch(async (e) => {
    if (String(e).includes("already exists")) { await client.schedule.getHandle(scheduleId).delete(); return client.schedule.create({ scheduleId, spec: { intervals: [{ every: `${minutes}m` }] }, policies: { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: "1 day" }, action: { type: "startWorkflow", workflowType: SurfaceIngestWorkflow, taskQueue: TASK_QUEUE, args: [input] } }); }
    throw e;
  });
  console.log(`schedule ${handle.scheduleId}: every ${every}, query "${input.query}" → ${uiUrl()}/namespaces/${target.namespace}/schedules`);
} else {
  const workflowId = `jev-ingest-${Date.now().toString(36)}`;
  const handle = await client.workflow.start(SurfaceIngestWorkflow, { taskQueue: TASK_QUEUE, workflowId, args: [input] });
  console.log(`started ${workflowId}  ${uiUrl()}/namespaces/${target.namespace}/workflows/${workflowId}`);
  const r = await handle.result();
  console.log(`pulled ${r.pulled} · already on tape ${r.deduped} · started ${r.started} in ${r.lanes.length} lane(s) over ${r.pages} page(s)`);
  for (const l of r.lanes) console.log("  " + l);
}
await connection.close();
