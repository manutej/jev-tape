#!/usr/bin/env node
/** FIRE still unrepresentable. Static checks that fail the build if a forbidden shape appears. */
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const fails = [];
const must = (cond, msg) => { if (!cond) fails.push(msg); };

const wf = read("src/temporal/workflows.ts");
must(!/\bfetch\s*\(/.test(wf), "workflows.ts calls fetch: TypeSafe must be an Activity");
must(!/typesafe\/client/.test(wf), "workflows.ts imports the TypeSafe client");
must(!/process\.env/.test(wf), "workflows.ts reads process.env: no key in the isolate");
must(!/node:/.test(wf), "workflows.ts imports node: modules");
must(!/TaskWorkflow/.test(wf), "god-TaskWorkflow is unrepresentable");
must(/humanVerdict/.test(wf), "Signal humanVerdict missing");
must(/continueAsNew/.test(wf), "ContinueAsNew missing");
for (const f of ["src/loop.ts", "src/engine.ts", "src/item.ts", "src/temporal/activities.ts", "src/temporal/workflows.ts", "src/judge.ts"]) {
  must(!/jev-latest/.test(read(f)), `${f} mentions jev-latest`);
}
const domain = read("src/domain.ts");
must(/CreateHabit is deferred/.test(domain), "CreateHabit must stay refused in assertLegalCommand");
const item = read("src/item.ts");
const applyIdx = item.indexOf("ports.applyCommand(");
const outIdx = item.indexOf("ports.qualifyOutput(");
must(applyIdx > outIdx && outIdx > 0, "apply must come after qualifyOutput (apply last)");
must(!/scoreFill/.test(read("src/loop.ts")), "scoreFill as a gate is unrepresentable");
const pkg = JSON.parse(read("package.json"));
must(!("worker:cloud" in pkg.scripts), "no cloud worker script from npm run live");

if (fails.length) {
  console.error("check: FAIL");
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("check: ok — FIRE still unrepresentable (11 checks)");
