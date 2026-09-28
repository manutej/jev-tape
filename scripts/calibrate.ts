#!/usr/bin/env node
/**
 * Calibration per question, per kind: are Jev's probabilities honest? From one or more corpus results files
 * (scripts/vibium-corpus.ts output) and optional independent labels (e.g. Haiku screenshot reads).
 *
 *   npm run calibrate -- runs/corpus-*.json [--labels runs/labels.json] [--bins 5]
 *
 * Label source per row: --labels file {id → "yes"|"no"|"cannot-tell"} when given and not cannot-tell, else the
 * catalog expectation. Rows where the two sources disagree are listed as findings and excluded from the score.
 * Reports, for `outcome` (p(verified) vs truth) and each noul: Brier score, reliability bins (mean p vs observed
 * rate, n), and per-kind accuracy at the confident ends. No thresholds are moved here; this only reads.
 */
import { readFileSync } from "node:fs";
import type { TypesafeAnswer } from "../src/typesafe/contract.ts";

type Row = { id: string; kind: string; expect: string; verdict: string; ok: boolean | null; answers?: Record<string, TypesafeAnswer>; entropy?: number };
const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a) && a !== argv[argv.indexOf("--labels") + 1]);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const bins = Number(opt("--bins") ?? 5);
const labels: Record<string, string> = opt("--labels") ? JSON.parse(readFileSync(opt("--labels")!, "utf8")) : {};

const rows: Row[] = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Row[] }).results);
const truthOf = (r: Row): boolean | null => {
  const cat = r.expect === "passed";
  const h = labels[r.id];
  if (h === undefined || h === "cannot-tell") return cat;
  const hb = h === "yes";
  return hb === cat ? cat : null; // disagreement → excluded, reported
};
const findings = rows.filter((r) => labels[r.id] && labels[r.id] !== "cannot-tell" && (labels[r.id] === "yes") !== (r.expect === "passed"));
const scored = rows.filter((r) => r.answers && truthOf(r) !== null);

function report(name: string, pOf: (r: Row) => number | undefined, positive: (r: Row) => boolean) {
  const pts = scored.flatMap((r) => { const p = pOf(r); return p === undefined ? [] : [{ p, y: positive(r) ? 1 : 0, kind: r.kind }]; });
  if (!pts.length) return;
  const brier = pts.reduce((s, x) => s + (x.p - x.y) ** 2, 0) / pts.length;
  const base = pts.reduce((s, x) => s + x.y, 0) / pts.length;
  const brierRef = base * (1 - base);
  console.log(`\n${name}: n=${pts.length} · Brier ${brier.toFixed(3)} (climatology ${brierRef.toFixed(3)}; lower is better, skill = ${(1 - brier / (brierRef || 1)).toFixed(2)})`);
  console.log("  bin        mean p   observed   n");
  for (let b = 0; b < bins; b++) {
    const lo = b / bins, hi = (b + 1) / bins;
    const inBin = pts.filter((x) => x.p >= lo && (b === bins - 1 ? x.p <= hi : x.p < hi));
    if (!inBin.length) continue;
    const mp = inBin.reduce((s, x) => s + x.p, 0) / inBin.length;
    const obs = inBin.reduce((s, x) => s + x.y, 0) / inBin.length;
    console.log(`  ${lo.toFixed(1)}–${hi.toFixed(1)}    ${mp.toFixed(2)}     ${obs.toFixed(2)}     ${inBin.length}`);
  }
  const kinds = [...new Set(pts.map((x) => x.kind))].sort();
  const line = kinds.map((k) => { const ks = pts.filter((x) => x.kind === k); const ends = ks.filter((x) => x.p >= 0.85 || x.p <= 0.15); const right = ends.filter((x) => (x.p >= 0.85) === (x.y === 1)).length; return `${k} ${right}/${ends.length} at ends (n=${ks.length})`; });
  console.log("  by kind: " + line.join(" · "));
}

console.log(`rows ${rows.length} · with answers ${rows.filter((r) => r.answers).length} · scored ${scored.length} · label disagreements ${findings.length}`);
for (const f of findings) console.log(`  FINDING ${f.id}: catalog says ${f.expect}, independent label says ${labels[f.id]}`);
report("outcome → p(verified)", (r) => { const a = r.answers?.outcome; return a?.type === "choice" ? a.probabilities.verified : undefined; }, (r) => truthOf(r) === true);
report("errorShown → p(true)", (r) => { const a = r.answers?.errorShown; return a?.type === "noul" ? a.noul : undefined; }, (r) => r.kind === "error");
report("blocked → p(not none)", (r) => { const a = r.answers?.blocked; return a?.type === "choice" ? 1 - (a.probabilities.none ?? 0) : undefined; }, (r) => r.kind === "login-wall");
