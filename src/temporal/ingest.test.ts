/**
 * Connector → jev with no model in the loop: a real MCP server over stdio (scripts/mcp-fake-gmail.ts),
 * pullSurface pages through it, codec maps rows in code, dedupe by threadId, lanes judge and apply.
 * Needs a Temporal dev server like workflows.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectMcp } from "../surfaces/mcp.ts";
import { gmailToCaptures } from "../surfaces/codec.ts";
import { scrub, displayName } from "../surfaces/scrub.ts";
import { countingJudge, stubJudge } from "../judge.ts";
import { createActivities, disposeActivities, fileTape } from "./activities.ts";
import { workflowsPath } from "./worker.ts";
import { SurfaceIngestWorkflow } from "./workflows.ts";

const fakeServer = fileURLToPath(new URL("../../scripts/mcp-fake-gmail.ts", import.meta.url));
const fixture = Array.from({ length: 7 }, (_, i) => ({ name: "Capture", payload: { text: `Thread ${i} body`, from: `Person ${i}`, subject: `Subject ${i}`, date: "2026-09-2" + i, threadId: `thr-${i}` } }));

test("scrub and displayName never let an address, phone or code through", () => {
  assert.equal(scrub("call 650-283-2299 or mail a@b.com code 227591").text, "call [phone removed] or mail [email removed] code [code removed]");
  assert.equal(displayName("Victoria DeGroot <v@pursuit-path.com>"), "Victoria DeGroot");
  assert.equal(displayName("donotreply@godaddy.com"), "godaddy");
});

test("codec: connector shape → Capture commands, deterministic, scrubbed", () => {
  const page = gmailToCaptures({ threads: [{ id: "t1", messages: [{ subject: "Hi x@y.com", snippet: "ring 650-283-2299", sender: "A <a@b.c>", date: "2026-09-28T01:00:00Z", labelIds: ["INBOX", "UNREAD"] }] }], nextPageToken: "n" });
  assert.equal(page.commands.length, 1);
  const p = page.commands[0]!.payload;
  assert.equal(p.threadId, "t1"); assert.equal(p.from, "A"); assert.equal(p.date, "2026-09-28"); assert.equal(p.unread, true);
  assert.ok(!/@|650/.test(JSON.stringify(p)));
  assert.equal(page.nextPageToken, "n");
  assert.deepEqual(gmailToCaptures({ threads: [] }), { commands: [], nextPageToken: undefined, skipped: 0 });
});

test("MCP client over stdio: the fake Gmail server pages a local pack in the connector's shape", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jev-mcp-"));
  const packPath = join(dir, "pack.json");
  await writeFile(packPath, JSON.stringify(fixture));
  const s = await connectMcp({ kind: "stdio", command: process.execPath, args: ["--experimental-strip-types", fakeServer], env: { JEV_FAKE_PACK: packPath } });
  try {
    assert.deepEqual(await s.listTools(), ["search_threads"]);
    const p1 = gmailToCaptures(await s.call("search_threads", { query: "in:inbox", pageSize: 5 }));
    assert.equal(p1.commands.length, 5); assert.equal(p1.nextPageToken, "5");
    const p2 = gmailToCaptures(await s.call("search_threads", { query: "in:inbox", pageSize: 5, pageToken: "5" }));
    assert.equal(p2.commands.length, 2); assert.equal(p2.nextPageToken, undefined);
  } finally {
    await s.close();
  }
});

const reachable = await fetch("http://localhost:8233/").then(() => true).catch(() => false);
test("SurfaceIngestWorkflow: 2 pages → 7 captures in 2 lanes; a second ingest dedupes all 7", { skip: !reachable && "no Temporal dev server" }, async () => {
  const { TestWorkflowEnvironment } = await import("@temporalio/testing");
  const { Worker } = await import("@temporalio/worker");
  const env = await TestWorkflowEnvironment.createFromExistingServer({ address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233" });
  const dir = await mkdtemp(join(tmpdir(), "jev-ingest-"));
  const packPath = join(dir, "pack.json");
  await writeFile(packPath, JSON.stringify(fixture));
  const tapePath = join(dir, "tape.jsonl");
  const judge = countingJudge(stubJudge());
  const taskQueue = `jev-tape-ingest-${Date.now()}`;
  const activities = createActivities({ judge, tape: fileTape(tapePath), mcp: { kind: "stdio", command: process.execPath, args: ["--experimental-strip-types", fakeServer], env: { JEV_FAKE_PACK: packPath } } });
  const worker = await Worker.create({ connection: env.nativeConnection, namespace: env.namespace, taskQueue, workflowsPath, activities });
  try {
    await worker.runUntil(async () => {
      const h = await env.client.workflow.start(SurfaceIngestWorkflow, { taskQueue, workflowId: `test-ingest-${Date.now()}`, args: [{ surface: "gmail", query: "in:inbox", pageSize: 5, laneSize: 4 }] });
      const first = await h.result();
      // lanes are ABANDONed children: wait for them to finish so the tape is complete
      for (const l of first.lanes) await env.client.workflow.getHandle(l).result();
      assert.equal(first.pages, 2); assert.equal(first.pulled, 7); assert.equal(first.deduped, 0); assert.equal(first.started, 7);
      assert.equal(first.lanes.length, 3, "page 1 → lanes of 4+1, page 2 → 1 lane");
      const tape = await fileTape(tapePath).entries();
      assert.equal(tape.length, 7);
      assert.equal(new Set(tape.map((t) => (t.payload as any).threadId)).size, 7);
      assert.equal(judge.calls, 14);

      const h2 = await env.client.workflow.start(SurfaceIngestWorkflow, { taskQueue, workflowId: `test-ingest2-${Date.now()}`, args: [{ surface: "gmail", query: "in:inbox", pageSize: 5, laneSize: 4 }] });
      const second = await h2.result();
      assert.equal(second.deduped, 7); assert.equal(second.started, 0); assert.equal(second.lanes.length, 0);
      assert.equal((await fileTape(tapePath).entries()).length, 7, "nothing written twice");
      assert.equal(judge.calls, 14, "no judge calls for already-seen threads");
    });
  } finally {
    await disposeActivities(activities);
    await env.teardown();
  }
});
