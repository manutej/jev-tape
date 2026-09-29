#!/usr/bin/env node
/**
 * Build results/raw/judges-comparison.json and docs/judges-comparison.html: the three-judge comparison
 * (Jev · Sonnet screenshot proxy · vibium check with the model alone) with every run, so repeatability is
 * visible. Reads committed files only.   npm run judges
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = process.env.JEV_WORKS_DIR || path.resolve(ROOT, "..", "JEV-works");
const j = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const exists = (p) => fs.existsSync(p);
const ids = ["npm-react", "rfc2324", "wiki-lisp", "mdn-flex", "wiki-ada-false", "gh-linux", "wiki-python-false", "hn"];
const norm = (v) => (v === "inconclusive" ? "escalate" : v);
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; }; // upper middle, as scripts/vibium-bench.ts reports it
const q = (a, f) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.round(f * (a.length - 1))] : null; };

// Bench runs: Jev and vibium check on the same eight pages
const benchFiles = [
  { run: "bench-1", date: "2026-09-28", file: path.join(W, "kit/results/browser-bench-check-vs-jev-2026-09-28.json"), rel: "JEV-works kit/results/browser-bench-check-vs-jev-2026-09-28.json" },
  { run: "bench-2", date: "2026-09-29", file: path.join(ROOT, "results/raw/bench-repeat-2026-09-29.json"), rel: "jev-tape results/raw/bench-repeat-2026-09-29.json" },
].filter((b) => exists(b.file));
const benchRuns = benchFiles.map((b) => { const r = j(b.file); return { run: b.run, date: b.date, file: b.rel, model: r.summary.model, checkModel: r.summary.checkModel,
  rows: r.results.map((x, i) => ({ id: ids[i], url: x.url, claim: x.claim, expect: x.expect, navMs: x.navMs, snapMs: x.snapMs,
    jev: { verdict: norm(x.jev.verdict), ok: x.jev.verdict === "inconclusive" ? null : x.jev.ok, ms: x.jev.ms, pVerified: x.jevAnswers?.outcome?.probabilities?.verified, blocked: x.jevAnswers?.blocked?.choice, inputTokens: x.jev.inputTokens },
    check: { verdict: x.check.verdict, ok: x.check.ok, ms: x.check.ms, summary: (x.check.summary || "").slice(0, 160) } })) }; });

// Sonnet judge runs
const sonnet = j(path.join(ROOT, "results/raw/sonnet-judge-runs.json"));
const expectOf = Object.fromEntries(sonnet.key.map((k) => [k.id, k.expect]));
const sonnetRuns = sonnet.runs.map((r) => ({ run: r.run, date: r.date, blind: r.blind, note: r.note, rows: r.results.map((x) => ({ id: x.id, verdict: x.verdict, ok: x.verdict === "inconclusive" ? null : x.verdict === expectOf[x.id], ms: x.ms, wallMs: x.wallMs })) }));

// Corpus runs: Jev alone, 80 rows
const corpusFiles = [
  { run: "corpus-1", date: "2026-09-28", file: "results/raw/corpus-2026-09-28.rows.json", note: "3 parallel sessions, no recordings" },
  { run: "corpus-2", date: "2026-09-29", file: "results/raw/corpus-rec-2026-09-29.rows.json", note: "3 parallel sessions, a recording zip per row" },
].filter((c) => exists(path.join(ROOT, c.file)));
const corpusRuns = corpusFiles.map((c) => { const r = j(path.join(ROOT, c.file)); const settled = r.rows.filter((x) => ["passed", "failed", "inconclusive"].includes(x.verdict));
  return { run: c.run, date: c.date, file: "jev-tape " + c.file, note: c.note, wallMs: r.summary?.wallMs, rows: r.rows.map((x) => ({ id: x.id, verdict: ["passed", "failed", "inconclusive"].includes(x.verdict) ? norm(x.verdict) : "stopped", ok: x.verdict === "inconclusive" ? null : (["passed", "failed"].includes(x.verdict) ? x.ok : null), jevMs: x.jevMs, navMs: x.navMs, pVerified: x.answers?.outcome?.probabilities?.verified })),
    settled: settled.length, decided: settled.filter((x) => x.verdict !== "inconclusive").length, right: settled.filter((x) => x.verdict !== "inconclusive" && x.ok).length, escalates: settled.filter((x) => x.verdict === "inconclusive").length,
    jevMsMedian: med(settled.map((x) => x.jevMs).filter(Boolean)), jevMsP10: q(settled.map((x) => x.jevMs).filter(Boolean), 0.1), jevMsP90: q(settled.map((x) => x.jevMs).filter(Boolean), 0.9) }; });

// Agreement between runs
function agree(a, b, key = "verdict") { let both = 0, same = 0; const diffs = []; for (const x of a) { const y = b.find((z) => z.id === x.id); if (!y) continue; const vx = x[key], vy = y[key]; if (vx == null || vy == null || vx === "stopped" || vy === "stopped") continue; both++; if (vx === vy) same++; else diffs.push({ id: x.id, a: vx, b: vy }); } return { both, same, diffs }; }
const repeat = {};
if (benchRuns.length > 1) { repeat.jevBench = agree(benchRuns[0].rows.map((r) => ({ id: r.id, verdict: r.jev.verdict })), benchRuns[1].rows.map((r) => ({ id: r.id, verdict: r.jev.verdict }))); repeat.checkBench = agree(benchRuns[0].rows.map((r) => ({ id: r.id, verdict: r.check.verdict })), benchRuns[1].rows.map((r) => ({ id: r.id, verdict: r.check.verdict }))); }
const blind = sonnetRuns.filter((r) => r.blind); if (blind.length > 1) repeat.sonnetBlind = agree(blind[0].rows, blind[1].rows);
if (corpusRuns.length > 1) repeat.jevCorpus = agree(corpusRuns[0].rows, corpusRuns[1].rows);

// Timing samples per judge, pooled across runs (ms)
const samples = {
  jev: benchRuns.flatMap((r) => r.rows.map((x) => ({ run: r.run, id: x.id, ms: x.jev.ms }))),
  jevCorpus: corpusRuns.flatMap((r) => r.rows.filter((x) => x.jevMs).map((x) => ({ run: r.run, id: x.id, ms: x.jevMs }))),
  sonnetSelf: sonnetRuns.filter((r) => r.blind).flatMap((r) => r.rows.map((x) => ({ run: r.run, id: x.id, ms: x.ms }))),
  sonnetWall: sonnetRuns.filter((r) => r.blind).flatMap((r) => r.rows.map((x) => ({ run: r.run, id: x.id, ms: x.wallMs }))),
  check: benchRuns.flatMap((r) => r.rows.map((x) => ({ run: r.run, id: x.id, ms: x.check.ms }))),
};
const stat = (a) => ({ n: a.length, median: med(a), p10: q(a, 0.1), p90: q(a, 0.9), min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null });
const stats = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, stat(v.map((s) => s.ms))]));
const perRun = { jev: benchRuns.map((r) => ({ run: r.run, ...stat(r.rows.map((x) => x.jev.ms)) })), check: benchRuns.map((r) => ({ run: r.run, ...stat(r.rows.map((x) => x.check.ms)) })), sonnetSelf: sonnetRuns.map((r) => ({ run: r.run, blind: r.blind, ...stat(r.rows.map((x) => x.ms)) })), sonnetWall: sonnetRuns.map((r) => ({ run: r.run, blind: r.blind, ...stat(r.rows.map((x) => x.wallMs)) })), jevCorpus: corpusRuns.map((r) => ({ run: r.run, n: r.settled, median: r.jevMsMedian, p10: r.jevMsP10, p90: r.jevMsP90 })) };
const right = { jev: benchRuns.map((r) => ({ run: r.run, decided: r.rows.filter((x) => x.jev.ok !== null).length, right: r.rows.filter((x) => x.jev.ok).length, escalates: r.rows.filter((x) => x.jev.verdict === "escalate").length })), check: benchRuns.map((r) => ({ run: r.run, decided: r.rows.length, right: r.rows.filter((x) => x.check.ok).length })), sonnet: sonnetRuns.map((r) => ({ run: r.run, blind: r.blind, decided: r.rows.filter((x) => x.ok !== null).length, right: r.rows.filter((x) => x.ok).length, inconclusive: r.rows.filter((x) => x.verdict === "inconclusive").length })) };

// The login three ways (spec §8c and docs/COMPUTER-USE-CROSSCHECK.md), with stage breakdown in ms
const login = [
  { variant: "Jev + operator policy", judge: "jev", totalMs: 5000, stages: [{ name: "page load", ms: 700 }, { name: "gate call", ms: 330 }, { name: "act + settle", ms: 3470 }, { name: "verify call", ms: 500 }], outcome: "verified true", file: "jev-tape spec/SURFACES-VIBIUM.md §8c" },
  { variant: "Sonnet pixel operator", judge: "sonnet", totalMs: 14174, wallMs: 23146, stages: [{ name: "3 screenshots + 3 vision turns", ms: 13700 }, { name: "1 click + 30 key presses", ms: 474 }], outcome: "passed; final frame checked by hand", file: "jev-tape docs/COMPUTER-USE-CROSSCHECK.md" },
  { variant: "Model only: vibium run + check", judge: "check", totalMs: 32800, stages: [{ name: "page load", ms: 600 }, { name: "vibium run (plan + act)", ms: 14200 }, { name: "vibium check (verify)", ms: 17300 }, { name: "settle", ms: 700 }], outcome: "completed, passed", file: "jev-tape spec/SURFACES-VIBIUM.md §8c" },
];

const out = { builtAt: new Date().toISOString().slice(0, 10), ids, pages: benchRuns[0]?.rows.map((r) => ({ id: r.id, url: r.url, claim: r.claim, expect: r.expect })) || [], benchRuns, sonnetRuns, corpusRuns, repeat, samples, stats, perRun, right, login,
  judges: { jev: { name: "Jev, typed judge", model: benchRuns[0]?.model || "jev-1.13.0", sees: "the settled page as text: url, title, a page-text excerpt, up to 60 element-map labels, and the claim, in one typed request", timed: "one POST round trip, measured in the runner around fetch()", answers: "outcome (verified / contradicted / unsupported) with probabilities, errorShown, blocked; a rule table turns them into passed, failed or escalate" },
    sonnet: { name: "Sonnet, screenshot proxy", model: sonnet.model, sees: "one 780×493 frame of the same settled page, captured by vibium screenshot, and the claim; nothing else", timed: "self-timed: date +%s%3N before the Read and after the decision; agent wall from spawn to hand-back is kept beside it", answers: "passed, failed or inconclusive, with a one-line reason" },
    check: { name: "vibium check, model alone", model: benchRuns[0]?.checkModel || "xai/grok-4.6", sees: "the live browser and the claim; it drives its own tool loop (map, text, screenshot) until it decides or its budget ends", timed: "process wall of vibium check, measured in the runner", answers: "passed or failed with a summary" } } };
fs.writeFileSync(path.join(ROOT, "results/raw/judges-comparison.json"), JSON.stringify(out, null, 1) + "\n");
let html = fs.readFileSync(path.join(ROOT, "docs/judges-comparison.src.html"), "utf8");
html = html.replace("/*__DATA__*/", JSON.stringify(out).replace(/<\//g, "<\\/"));
fs.writeFileSync(path.join(ROOT, "docs/judges-comparison.html"), html);
console.log(JSON.stringify({ benchRuns: benchRuns.map((r) => r.run), sonnetRuns: sonnetRuns.map((r) => r.run), corpusRuns: corpusRuns.map((r) => r.run), repeat: Object.fromEntries(Object.entries(repeat).map(([k, v]) => [k, v.same + "/" + v.both])), stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.median])) }));
