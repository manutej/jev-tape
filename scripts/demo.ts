#!/usr/bin/env node
/**
 * The show. One command, real Temporal server, real workflows, real Event History.
 *
 *   npm run demo                   worker in this process; judge from env (key → live, else JEV_JUDGE=stub)
 *   npm run demo -- --crash        worker in a child process that dies after 3 applies, then a fresh
 *                                  worker picks the same workflow up. No item is applied twice.
 *   npm run demo -- --no-worker    you already run `npm run worker` (one or many) elsewhere
 *   npm run demo -- --pack FILE    use a local pack of commands (JSON array) instead of the built-in one
 *
 * What it drives:
 *   1. JevCorrectnessWorkflow with 11 commands → ContinueAsNew at 8, one C10 park answered by Signal,
 *      two locally-illegal commands that never reach the judge (path 0, 0 POSTs).
 *   2. WaitingWorkflow: StartWaiting → 2 timer nudges → resolve Signal → ResolveWaiting parked → compose.
 *   3. HabitWorkflow minting 3 Instances on a timer.
 * Then prints the tape and the UI links.
 */
import { Client, Connection } from "@temporalio/client";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "../src/domain.ts";
import { fileTape } from "../src/temporal/activities.ts";
import { temporalTarget, uiUrl } from "../src/temporal/connection.ts";
import { DEFAULT_TAPE } from "../src/temporal/worker.ts";
import {
  HabitWorkflow,
  JevCorrectnessWorkflow,
  TASK_QUEUE,
  WaitingWorkflow,
  humanVerdictSignal,
  resolveSignal,
  statusQuery,
} from "../src/temporal/workflows.ts";

const argv = process.argv.slice(2);
const args = new Set(argv);
const packArg = argv[argv.indexOf("--pack") + 1];
const packPath = argv.includes("--pack") && packArg ? packArg : process.env.JEV_PACK;
const crash = args.has("--crash");
const noWorker = args.has("--no-worker");
const tapePath = process.env.JEV_TAPE_PATH ?? DEFAULT_TAPE;
const runId = Date.now().toString(36);
const ui = uiUrl();
const target = temporalTarget();

if (!process.env.TYPESAFE_API_KEY && process.env.JEV_JUDGE !== "stub") {
  console.error("No TYPESAFE_API_KEY and JEV_JUDGE is not 'stub'. Fail closed: every gate would be RED.");
  console.error("Either export the key (live jev-1.13.0) or run with JEV_JUDGE=stub to show the tape.");
  process.exit(1);
}

const workerScript = fileURLToPath(new URL("../src/temporal/worker.ts", import.meta.url));
function spawnWorker(extraEnv: Record<string, string> = {}): ChildProcess {
  const child = spawn(process.execPath, ["--experimental-strip-types", workerScript], {
    env: { ...process.env, JEV_TAPE_PATH: tapePath, ...extraEnv },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return child;
}

const log = (s: string) => console.log(`\x1b[36m▶\x1b[0m ${s}`);

async function main() {
  const connection = await Connection.connect({
    address: target.address,
    tls: target.tls,
    ...(target.apiKey ? { apiKey: target.apiKey } : {}),
  });
  const client = new Client({ connection, namespace: target.namespace });

  let inProcess: Awaited<ReturnType<typeof import("../src/temporal/worker.ts").createWorker>> | undefined;
  let child: ChildProcess | undefined;
  if (!noWorker && !crash) {
    const { createWorker } = await import("../src/temporal/worker.ts");
    const { Runtime, DefaultLogger } = await import("@temporalio/worker");
    Runtime.install({ logger: new DefaultLogger((process.env.JEV_LOG_LEVEL as "INFO" | "WARN") ?? "WARN") });
    inProcess = await createWorker({ tapePath });
    void inProcess.worker.run();
    log(`worker started in-process: queue=${TASK_QUEUE} judge=${inProcess.judge.source}`);
  } else if (crash) {
    child = spawnWorker({ JEV_CRASH_AFTER: "3" });
    log(`worker child pid ${child.pid} will crash after 3 applies`);
  }

  // ---------------------------------------------------------------- 1. worklist
  const commands: Command[] = packPath ? (JSON.parse(readFileSync(packPath, "utf8")) as Command[]) : [
    { name: "Capture", payload: { text: "Book dentist for October" } },
    { name: "Capture", payload: { text: "Reply to Ana about the Oct 2 dry run" } },
    { name: "Capture", payload: { text: "Should we move the offsite?" } }, // '?' → mid-band → AMBER park
    { name: "Capture", payload: { text: "Renew domain" } },
    { name: "CreateHabit", payload: { name: "Stretch" } }, // deferred in jev-domain → local RED, 0 POSTs
    { name: "Capture", payload: { text: "Draft Q4 plan outline" } },
    { name: "Complete", payload: { itemKind: "Project", itemKey: "p-1" } }, // illegal Complete → local RED
    { name: "Capture", payload: { text: "Order new keyboard" } },
    { name: "Complete", payload: { itemKind: "NextAction", itemKey: "na-42" } }, // C10 → parks
    { name: "Capture", payload: { text: "[red] wire money to unknown account" } }, // judge RED
    { name: "Clarify", payload: { itemKey: "inbox-7", to: "ToNextAction" } },
  ];
  const wfId = `jev-worklist-${runId}`;
  const handle = await client.workflow.start(JevCorrectnessWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId: wfId,
    args: [{ commands, parkTimeoutMs: 120_000 }],
  });
  log(`started JevCorrectnessWorkflow ${wfId} with ${commands.length} commands${packPath ? ` from ${packPath}` : ""}`);
  log(`  ${ui}/namespaces/${target.namespace}/workflows/${wfId}`);

  // Answer C10 parks as they appear. In production this is a person in a UI; here it is a loop.
  const answered = new Set<string>();
  const answer = async () => {
    const s = await handle.query(statusQuery).catch(() => undefined);
    if (!s) return;
    for (const key of s.parked) {
      if (answered.has(key)) continue;
      answered.add(key);
      const idx = Number(key.split(":").pop());
      const verdict = commands[idx]?.name === "Complete" ? "compose" : "escalate";
      await handle.signal(humanVerdictSignal, { key, verdict });
      log(`C10 park ${key} (${commands[idx]?.name}) ← human says ${verdict}`);
    }
  };

  let crashed = false;
  const poll = setInterval(async () => {
    await answer();
    if (crash && child && child.exitCode !== null && !crashed) {
      crashed = true;
      log(`worker child exited with ${child.exitCode}. Starting a fresh worker; the workflow resumes from Event History.`);
      child = spawnWorker();
    }
  }, 500);

  const result = await handle.result();
  clearInterval(poll);
  log(`worklist done in ${result.runs} run(s) (ContinueAsNew every 8): applied=${result.applied.length} residual=${result.residual.length}`);

  // Outcomes live in the final run's result only for its own batch; read every run's steps from the tape of outcomes.
  const rows = [];
  for (const [i, cmd] of commands.entries()) {
    const key = `${wfId}:${i}`;
    const o = result.outcomes.find((x) => x.idempotencyKey === key);
    const status = result.applied.includes(key) ? "applied" : "residual";
    const gate = (k: "qualifyTask" | "qualifyOutput") => o?.steps.find((s) => s.kind === k);
    rows.push({
      i,
      command: cmd.name,
      text: String(cmd.payload.text ?? cmd.payload.itemKey ?? cmd.payload.name ?? "").slice(0, 34),
      status,
      task: gate("qualifyTask")?.light ?? (o ? "—" : "?"),
      output: gate("qualifyOutput")?.light ?? "—",
      judge_ms: [gate("qualifyTask")?.ms, gate("qualifyOutput")?.ms].filter((x) => x !== undefined).join("+") || "0 (path 0)",
      source: gate("qualifyTask")?.source ?? "code",
    });
  }
  console.table(rows);

  // ---------------------------------------------------------------- 2. waiting
  const waitId = `jev-waiting-${runId}`;
  const waiting = await client.workflow.start(WaitingWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId: waitId,
    args: [{ display_name: "Ana", what: "confirm the Oct 2 dry run", nudgeEveryMs: 1000, maxNudges: 2, parkTimeoutMs: 60_000 }],
  });
  log(`started WaitingWorkflow ${waitId}: nudges every 1s`);
  await new Promise((r) => setTimeout(r, 5000));
  await waiting.signal(resolveSignal, { note: "Ana confirmed by mail" });
  log("resolve signal sent → ResolveWaiting is C10, parks for humanVerdict");
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const t = await fileTape(tapePath).entries();
    if (t.some((e) => e.key === `${waitId}:resolve`)) break;
    // The Waiting park key is `${waitId}:resolve`; send compose once the park exists (after two gates).
    if (i === 8) await waiting.signal(humanVerdictSignal, { key: `${waitId}:resolve`, verdict: "compose" });
  }
  const w = await waiting.result();
  log(`waiting done: nudges=${w.nudges} resolved=${w.resolved?.status ?? "n/a"}`);

  // ---------------------------------------------------------------- 3. habit
  const habitId = `jev-habit-${runId}`;
  const habit = await client.workflow.start(HabitWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId: habitId,
    args: [{ habitId: "stretch", everyMs: 400, maxInstances: 3 }],
  });
  const h = await habit.result();
  log(`habit done: minted=${h.minted} instance(s) (CreateHabit never emitted)`);

  // ---------------------------------------------------------------- tape
  const tape = (await fileTape(tapePath).entries()).filter((e) => e.key.includes(runId));
  console.log(`\ntape ${tapePath} (${tape.length} rows for this run):`);
  console.table(tape.map((e) => ({ key: e.key.replace(`-${runId}`, ""), event: e.event, command: e.command })));
  const dup = tape.length - new Set(tape.map((e) => e.key)).size;
  log(`duplicate applies on tape: ${dup}`);
  log(`Temporal UI: ${ui}/namespaces/${target.namespace}/workflows`);
  log(`replay proof: npm run replay -- ${wfId}`);

  if (inProcess) {
    inProcess.worker.shutdown();
    await new Promise((r) => setTimeout(r, 500));
    await inProcess.connection.close().catch(() => {});
  }
  child?.kill("SIGTERM");
  await connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
