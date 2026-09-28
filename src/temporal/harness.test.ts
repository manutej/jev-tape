/**
 * The harness end to end: HTTP start → SSE steps → verdict → done. Needs a Temporal server like workflows.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const reachable = await fetch("http://localhost:8233/").then(() => true).catch(() => false);
const canRun = reachable && (process.env.TYPESAFE_API_KEY || process.env.JEV_JUDGE === "stub");

test("harness: /start streams steps, /verdict releases a park, /tape shows the write", { skip: !canRun && "needs a Temporal dev server and a judge (TYPESAFE_API_KEY or JEV_JUDGE=stub)" }, async () => {
  const { createHarness } = await import("../../scripts/harness.ts");
  const dir = await mkdtemp(join(tmpdir(), "jev-harness-"));
  const port = 4900 + Math.floor(Math.random() * 100);
  const h = await createHarness({ port, tapePath: join(dir, "tape.jsonl"), taskQueue: `jev-tape-harness-${Date.now()}` });
  try {
    const info = (await (await fetch(`${h.url}/info`)).json()) as any;
    assert.ok(String(info.taskQueue).startsWith("jev-tape"));
    assert.equal(info.workflows.length, 4);

    const commands = [
      { name: "Capture", payload: { text: "harness capture" } },
      { name: "Complete", payload: { itemKind: "NextAction", itemKey: "na-9" } },
      { name: "CreateHabit", payload: {} },
    ];
    const { workflowId } = (await (await fetch(`${h.url}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commands }) })).json()) as any;
    assert.ok(workflowId.startsWith("jev-worklist-"));

    // Read the stream until the C10 park shows, answer it, then wait for done.
    const res = await fetch(`${h.url}/events`);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const seen: any[] = [];
    let answered = false;
    let done: any;
    const deadline = Date.now() + 60_000;
    while (!done && Date.now() < deadline) {
      const { value, done: closed } = await reader.read();
      if (closed) break;
      buf += dec.decode(value);
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, "");
        buf = buf.slice(i + 2);
        const m = JSON.parse(line);
        seen.push(m);
        if (m.type === "status" && m.parked?.length && !answered) {
          answered = true;
          await fetch(`${h.url}/verdict`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflowId, key: m.parked[0], verdict: "compose" }) });
        }
        if (m.type === "done" && m.workflowId === workflowId) done = m;
      }
    }
    reader.cancel().catch(() => {});
    assert.ok(done, "workflow reached done");
    assert.equal(done.result.applied.length, 2);
    assert.equal(done.result.residual.length, 1);
    assert.ok(seen.some((m) => m.type === "path0" && m.command === "CreateHabit"), "path-0 predicted for CreateHabit");
    assert.ok(seen.some((m) => m.type === "step" && m.kind === "qualifyTask" && typeof m.ms === "number"), "steps carry ms");
    assert.ok(seen.some((m) => m.type === "human" && m.verdict === "compose"));
    const tape = (await (await fetch(`${h.url}/tape`)).json()) as any[];
    assert.equal(tape.length, 2);
  } finally {
    await h.close();
  }
});
