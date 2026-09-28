#!/usr/bin/env node
/**
 * Live tape harness. One Node process: an in-process worker, a Temporal client, and a small HTTP
 * server that streams every Activity step over Server-Sent Events to harness/index.html.
 *
 *   npm run harness                 → http://localhost:4848   (worker in-process; judge from env)
 *   npm run harness -- --no-worker  → you run `npm run worker` elsewhere
 *
 * The page shows: what is loaded (judge, pin, queue, workflows, activities), the loop, every item's
 * two gates with their lights and judge latency in ms, C10 parks with verdict buttons, the step feed,
 * and the tape. Deep links go to the Temporal UI.
 */
import { Client, Connection, type WorkflowHandle } from "@temporalio/client";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "../src/domain.ts";
import { localGate } from "../src/loop.ts";
import { fileTape, type StepEvent } from "../src/temporal/activities.ts";
import { temporalTarget, uiUrl } from "../src/temporal/connection.ts";
import { DEFAULT_TAPE, createWorker } from "../src/temporal/worker.ts";
import {
  HabitWorkflow,
  JevCorrectnessWorkflow,
  TASK_QUEUE,
  WaitingWorkflow,
  humanVerdictSignal,
  resolveSignal,
  statusQuery,
  type WorklistStatus,
} from "../src/temporal/workflows.ts";
import { TYPESAFE_PINNED_MODEL } from "../src/typesafe/contract.ts";

type Msg = { type: string; [k: string]: unknown };

export interface Harness {
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function createHarness(opts: { port?: number; worker?: boolean; tapePath?: string; taskQueue?: string; packPath?: string } = {}): Promise<Harness> {
  const port = opts.port ?? Number(process.env.JEV_HARNESS_PORT ?? 4848);
  const taskQueue = opts.taskQueue ?? TASK_QUEUE;
  const tapePath = opts.tapePath ?? process.env.JEV_TAPE_PATH ?? DEFAULT_TAPE;
  // A local pack of real commands. Gitignored by default (.jev-tape/). JEV_PACK overrides the path.
  const packPath = opts.packPath ?? process.env.JEV_PACK ?? new URL("../.jev-tape/pack.json", import.meta.url).pathname;
  const target = temporalTarget();
  const ui = uiUrl();
  const html = readFileSync(fileURLToPath(new URL("../harness/index.html", import.meta.url)), "utf8");

  // ---------------------------------------------------------------- stream
  const clients = new Set<ServerResponse>();
  const buffer: Msg[] = [];
  const broadcast = (m: Msg) => {
    const withAt = { at: new Date().toISOString(), ...m };
    buffer.push(withAt);
    if (buffer.length > 2000) buffer.shift();
    const line = `data: ${JSON.stringify(withAt)}\n\n`;
    for (const c of clients) c.write(line);
  };

  // ---------------------------------------------------------------- temporal
  const connection = await Connection.connect({ address: target.address, tls: target.tls, ...(target.apiKey ? { apiKey: target.apiKey } : {}) });
  const client = new Client({ connection, namespace: target.namespace });
  let judgeSource = process.env.TYPESAFE_API_KEY ? "live" : process.env.JEV_JUDGE === "stub" ? "stub" : "closed";
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  if (opts.worker ?? true) {
    try {
      worker = await createWorker({ tapePath, taskQueue, onStep: (e: StepEvent) => broadcast({ type: "step", ...e }) });
      judgeSource = worker.judge.source;
      void worker.worker.run();
    } catch (err) {
      broadcast({ type: "error", message: `worker did not start: ${(err as Error).message}` });
    }
  }

  const handles = new Map<string, WorkflowHandle>();
  const pollers = new Map<string, NodeJS.Timeout>();

  function track(handle: WorkflowHandle, kind: string, commands?: Command[]) {
    handles.set(handle.workflowId, handle);
    broadcast({ type: "workflow", kind, workflowId: handle.workflowId, commands, link: `${ui}/namespaces/${target.namespace}/workflows/${handle.workflowId}` });
    if (kind === "JevCorrectnessWorkflow") {
      // Path-0 items never reach an Activity. Predict them from the same code the workflow runs.
      commands?.forEach((cmd, i) => {
        const local = localGate(cmd);
        if (local.light === "RED") broadcast({ type: "path0", workflowId: handle.workflowId, key: `${handle.workflowId}:${i}`, command: cmd.name, reasons: local.reasons });
      });
      let last = "";
      const t = setInterval(async () => {
        try {
          const s = (await handle.query(statusQuery)) as WorklistStatus;
          const sig = JSON.stringify(s);
          if (sig === last) return;
          last = sig;
          broadcast({ type: "status", workflowId: handle.workflowId, ...s });
        } catch {
          /* completed or not yet started */
        }
      }, 500);
      pollers.set(handle.workflowId, t);
    }
    handle
      .result()
      .then((result) => broadcast({ type: "done", kind, workflowId: handle.workflowId, result }))
      .catch((err) => broadcast({ type: "failed", kind, workflowId: handle.workflowId, message: (err as Error).message }))
      .finally(() => {
        const t = pollers.get(handle.workflowId);
        if (t) clearInterval(t);
        pollers.delete(handle.workflowId);
      });
  }

  // ---------------------------------------------------------------- http
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<any>((resolve, reject) => {
      let s = "";
      req.on("data", (c) => (s += c));
      req.on("end", () => {
        try {
          resolve(s ? JSON.parse(s) : {});
        } catch (e) {
          reject(e);
        }
      });
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      if (req.method === "GET" && url.pathname === "/info") {
        return json(res, 200, {
          judge: judgeSource,
          pin: TYPESAFE_PINNED_MODEL,
          endpoint: "https://api.typesafe.ai/v1/systemone",
          taskQueue,
          temporal: { address: target.address, namespace: target.namespace, ui },
          worker: worker ? { identity: worker.worker.options.identity, inProcess: true } : { inProcess: false },
          workflows: ["JevCorrectnessWorkflow", "WaitingWorkflow", "HabitWorkflow", "SomedayReviewWorkflow"],
          activities: ["qualifyTask", "qualifyOutput", "applyCommand", "typesafeJudge", "recordEvent"],
          loop: ["assertLegalCommand", "qualifyTask", "gate", "propose", "qualifyOutput", "gate", "humanVerdict?", "applyCommand"],
          tapePath,
        });
      }
      if (req.method === "GET" && url.pathname === "/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(`data: ${JSON.stringify({ type: "hello", buffered: buffer.length })}\n\n`);
        for (const m of buffer) res.write(`data: ${JSON.stringify(m)}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (req.method === "GET" && url.pathname === "/pack") {
        if (!existsSync(packPath)) return json(res, 200, { path: packPath, commands: null });
        try {
          const commands = JSON.parse(readFileSync(packPath, "utf8"));
          return json(res, 200, { path: packPath, commands });
        } catch (e) {
          return json(res, 200, { path: packPath, commands: null, error: (e as Error).message });
        }
      }
      if (req.method === "GET" && url.pathname === "/tape") {
        const rows = await fileTape(tapePath).entries();
        return json(res, 200, rows.slice(-200));
      }
      if (req.method === "POST" && url.pathname === "/start") {
        const body = await readBody(req);
        const commands = body.commands as Command[];
        if (!Array.isArray(commands) || commands.length === 0) return json(res, 400, { error: "commands[] required" });
        // Lanes: a big pack becomes N worklists that run in parallel across every worker on the queue.
        // A park only blocks its own lane. Each lane still ContinueAsNews every 8.
        const laneSize = Math.max(1, Math.min(Number(body.laneSize) || commands.length, commands.length));
        const parkTimeoutMs = body.parkTimeoutMs ? Number(body.parkTimeoutMs) : undefined;
        const stamp = Date.now().toString(36);
        const workflowIds: string[] = [];
        for (let i = 0, lane = 0; i < commands.length; i += laneSize, lane++) {
          const slice = commands.slice(i, i + laneSize);
          const workflowId = laneSize < commands.length ? `jev-worklist-${stamp}-L${String(lane).padStart(2, "0")}` : `jev-worklist-${stamp}`;
          const handle = await client.workflow.start(JevCorrectnessWorkflow, { taskQueue, workflowId, args: [{ commands: slice, parkTimeoutMs }] });
          track(handle, "JevCorrectnessWorkflow", slice);
          workflowIds.push(workflowId);
        }
        broadcast({ type: "batch", workflowIds, total: commands.length, laneSize, parkTimeoutMs });
        return json(res, 200, { workflowIds, workflowId: workflowIds[0] });
      }
      if (req.method === "POST" && url.pathname === "/waiting") {
        const body = await readBody(req);
        const workflowId = `jev-waiting-${Date.now().toString(36)}`;
        const handle = await client.workflow.start(WaitingWorkflow, {
          taskQueue,
          workflowId,
          args: [{ display_name: body.display_name ?? "Ana", what: body.what ?? "confirm", nudgeEveryMs: body.nudgeEveryMs ?? 3000, maxNudges: body.maxNudges ?? 3 }],
        });
        track(handle, "WaitingWorkflow");
        return json(res, 200, { workflowId });
      }
      if (req.method === "POST" && url.pathname === "/habit") {
        const body = await readBody(req);
        const workflowId = `jev-habit-${Date.now().toString(36)}`;
        const handle = await client.workflow.start(HabitWorkflow, {
          taskQueue,
          workflowId,
          args: [{ habitId: body.habitId ?? "stretch", everyMs: body.everyMs ?? 1000, maxInstances: body.maxInstances ?? 3 }],
        });
        track(handle, "HabitWorkflow");
        return json(res, 200, { workflowId });
      }
      if (req.method === "POST" && url.pathname === "/verdict") {
        const { workflowId, key, verdict } = await readBody(req);
        if (!["compose", "escalate", "refuse"].includes(verdict)) return json(res, 400, { error: "verdict must be compose|escalate|refuse" });
        const handle = handles.get(workflowId) ?? client.workflow.getHandle(workflowId);
        await handle.signal(humanVerdictSignal, { key, verdict });
        broadcast({ type: "human", workflowId, key, verdict });
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/resolve") {
        const { workflowId, note } = await readBody(req);
        const handle = handles.get(workflowId) ?? client.workflow.getHandle(workflowId);
        await handle.signal(resolveSignal, { note });
        broadcast({ type: "resolve", workflowId, note });
        return json(res, 200, { ok: true });
      }
      json(res, 404, { error: "not found" });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    port,
    url: `http://localhost:${port}`,
    async close() {
      for (const t of pollers.values()) clearInterval(t);
      for (const c of clients) c.end();
      server.close();
      if (worker) {
        worker.worker.shutdown();
        await new Promise((r) => setTimeout(r, 300));
        await worker.connection.close().catch(() => {});
      }
      await connection.close();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { Runtime, DefaultLogger } = await import("@temporalio/worker");
  Runtime.install({ logger: new DefaultLogger((process.env.JEV_LOG_LEVEL as "INFO" | "WARN") ?? "WARN") });
  const h = await createHarness({ worker: !process.argv.includes("--no-worker") });
  console.log(`jev-tape harness  ${h.url}   (Temporal UI ${uiUrl()})`);
  const stop = async () => {
    await h.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
