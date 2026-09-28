#!/usr/bin/env node
/**
 * Privacy scan for a pack file before it becomes judge state.
 *   npm run pack:scan -- .jev-tape/pack.json          report, exit 1 on any hit
 *   npm run pack:scan -- .jev-tape/pack.json --fix    redact hits in place, then report
 * Hits: email addresses, phone numbers, 6-8 digit codes, URLs, IBAN/card-like digit runs.
 */
import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
const fix = process.argv.includes("--fix");
if (!path) { console.error("usage: node scripts/pack-scan.mjs <pack.json> [--fix]"); process.exit(1); }
const RULES = [
  ["email", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["phone", /(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g],
  ["code", /\b\d{6,8}\b/g],
  ["url", /https?:\/\/\S+|\bwww\.\S+/gi],
  ["cardlike", /\b(?:\d[ -]?){13,19}\b/g],
];
const pack = JSON.parse(readFileSync(path, "utf8"));
if (!Array.isArray(pack)) { console.error("pack must be a JSON array of commands"); process.exit(1); }
let hits = 0; const byRule = {}; const cats = {}; const names = {};
for (const cmd of pack) {
  if (!cmd || typeof cmd.name !== "string" || typeof cmd.payload !== "object") { console.error("bad command:", JSON.stringify(cmd).slice(0, 120)); process.exit(1); }
  names[cmd.name] = (names[cmd.name] ?? 0) + 1;
  cats[cmd.payload.category ?? "-"] = (cats[cmd.payload.category ?? "-"] ?? 0) + 1;
  for (const [k, v] of Object.entries(cmd.payload)) {
    if (typeof v !== "string") continue;
    let out = v;
    for (const [rule, re] of RULES) {
      const m = out.match(re);
      if (m) { hits += m.length; byRule[rule] = (byRule[rule] ?? 0) + m.length; if (fix) out = out.replace(re, `[${rule} removed]`); else console.error(`  ${rule.padEnd(8)} ${k}: ${m[0]}`); }
    }
    if (fix) cmd.payload[k] = out;
  }
}
if (fix) writeFileSync(path, JSON.stringify(pack, null, 2) + "\n");
console.log(`${path}: ${pack.length} commands · ${Object.entries(names).map(([k, n]) => `${k} ${n}`).join(", ")}`);
console.log(`categories: ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
if (hits) { console.log(`${fix ? "redacted" : "FOUND"} ${hits} hit(s): ${Object.entries(byRule).map(([k, n]) => `${k} ${n}`).join(", ")}`); process.exit(fix ? 0 : 1); }
console.log("privacy: clean");
