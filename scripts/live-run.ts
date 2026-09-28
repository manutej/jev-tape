#!/usr/bin/env node
/**
 * One Capture through startEngine (the in-process twin). Not a Cloud worker.
 *   npm run live -- "I can make Oct 2 from 9:00-10:00 CT"
 * Key required. Never sends. Never pushes.
 */
import { memoryTape, startEngine } from "../src/engine.ts";
import { selectJudge } from "../src/judge.ts";

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('usage: npm run live -- "one line to capture"');
  process.exit(1);
}
let judge;
try {
  judge = selectJudge();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const tape = memoryTape();
const result = await startEngine([{ name: "Capture", payload: { text } }], { judge, tape }, "live");
const o = result.outcomes[0]!;
console.log(`judge=${judge.source} status=${o.status} light=${o.light}`);
for (const s of o.steps) console.log(`  ${s.seq}. ${s.kind.padEnd(19)} ${(s.light ?? "").padEnd(5)} ${s.source ?? ""}  ${(s.reasons ?? []).join("; ")}`);
console.log(`tape rows: ${(await tape.entries()).length}`);
if (judge.source !== "live") console.log("NOTE: not a real verdict (source != live)");
