/**
 * Worker. TASK_QUEUE=jev-tape. Run as many as you want; they share the queue.
 *
 *   npm run worker                       local dev server, judge from env
 *   TEMPORAL_ADDRESS=... TEMPORAL_API_KEY=... npm run worker     Temporal Cloud
 *
 * The key is read here and only here. The workflow bundle never sees process.env.
 */
import { NativeConnection, Runtime, Worker, DefaultLogger } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import { selectJudge } from "../judge.ts";
import { createActivities, fileTape } from "./activities.ts";
import { temporalTarget } from "./connection.ts";
import { TASK_QUEUE } from "./workflows.ts";

export const DEFAULT_TAPE = new URL("../../.jev-tape/tape.jsonl", import.meta.url).pathname;
export const workflowsPath = fileURLToPath(new URL("./workflows.ts", import.meta.url));

export interface WorkerOptions {
  tapePath?: string;
  crashAfterApplies?: number;
  judge?: ReturnType<typeof selectJudge>;
  maxConcurrentActivities?: number;
  maxConcurrentWorkflows?: number;
}

export async function createWorker(opts: WorkerOptions = {}) {
  const target = temporalTarget();
  const judge = opts.judge ?? selectJudge();
  const connection = await NativeConnection.connect({
    address: target.address,
    tls: target.tls,
    ...(target.apiKey ? { apiKey: target.apiKey } : {}),
  });
  const worker = await Worker.create({
    connection,
    namespace: target.namespace,
    taskQueue: TASK_QUEUE,
    workflowsPath,
    activities: createActivities({ judge, tape: fileTape(opts.tapePath ?? process.env.JEV_TAPE_PATH ?? DEFAULT_TAPE), crashAfterApplies: opts.crashAfterApplies }),
    maxConcurrentActivityTaskExecutions: opts.maxConcurrentActivities ?? Number(process.env.JEV_MAX_ACTIVITIES ?? 20),
    maxConcurrentWorkflowTaskExecutions: opts.maxConcurrentWorkflows ?? Number(process.env.JEV_MAX_WORKFLOWS ?? 20),
    identity: `jev-tape-${process.pid}`,
  });
  return { worker, connection, judge, target };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  Runtime.install({ logger: new DefaultLogger(process.env.JEV_LOG_LEVEL as "INFO" | "WARN" ?? "WARN") });
  const crash = process.env.JEV_CRASH_AFTER ? Number(process.env.JEV_CRASH_AFTER) : undefined;
  const { worker, connection, judge, target } = await createWorker({ crashAfterApplies: crash });
  console.log(`[worker] pid ${process.pid} queue=${TASK_QUEUE} ns=${target.namespace} at ${target.address} judge=${judge.source}${crash ? ` crashAfter=${crash}` : ""}`);
  const stop = () => worker.shutdown();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await worker.run();
  } finally {
    await connection.close();
  }
  console.log("[worker] stopped");
}
