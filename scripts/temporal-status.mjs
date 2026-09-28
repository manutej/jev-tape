#!/usr/bin/env node
/** Scripts match spec/TEMPORAL.md: every named file exists, every named workflow/signal/queue/pin is present. */
import { existsSync, readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const spec = read("spec/TEMPORAL.md");
const fails = [];

const files = [...spec.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]).filter((f) => f !== "File");
for (const f of files) if (!existsSync(new URL(f, root))) fails.push(`missing file named in spec: ${f}`);

const wf = existsSync(new URL("src/temporal/workflows.ts", root)) ? read("src/temporal/workflows.ts") : "";
for (const name of ["JevCorrectnessWorkflow", "WaitingWorkflow", "HabitWorkflow", "SomedayReviewWorkflow", "SurfaceIngestWorkflow"]) {
  if (!new RegExp(`export async function ${name}\\b`).test(wf)) fails.push(`workflow not exported: ${name}`);
}
if (!/defineSignal[^\n]*"humanVerdict"/.test(wf)) fails.push("signal humanVerdict not defined");
if (!/TASK_QUEUE = "jev-tape"/.test(wf)) fails.push("TASK_QUEUE must be jev-tape");
if (!/TYPESAFE_PINNED_MODEL = "jev-1\.13\.0"/.test(read("src/typesafe/contract.ts"))) fails.push("pin must be jev-1.13.0");
const acts = existsSync(new URL("src/temporal/activities.ts", root)) ? read("src/temporal/activities.ts") : "";
for (const a of ["qualifyItem", "qualifyTask", "qualifyOutput", "applyCommand", "typesafeJudge"]) if (!new RegExp(`async ${a}\\(`).test(acts)) fails.push(`activity missing: ${a}`);
const pkg = JSON.parse(read("package.json"));
for (const s of ["test", "smoke", "live", "qualify"]) if (!pkg.scripts[s]) fails.push(`npm script missing: ${s}`);

if (fails.length) {
  console.error("temporal: FAIL");
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`temporal: ok — ${files.length} files, 5 workflows, signal humanVerdict, queue jev-tape, pin jev-1.13.0`);
