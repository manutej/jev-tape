#!/usr/bin/env node
/**
 * Build results/registry.json, the single source of truth for every measured result.
 *
 *   node scripts/build-registry.mjs            (or: npm run registry)
 *
 * Reads only committed files: JEV-works kit results (JEV_WORKS_DIR, default ../JEV-works), results/raw/*,
 * fixtures, and every results/incoming/*.json (other sessions' results in the same schema). Never reads runs/.
 * Schema: { experiments: [{id,title,kind,n,what,result,stamp,stampWord,file,date?,jev?,model?}], rows: [{exp,id,task,
 * site,url,claim,expect,kind,jev,jevP,jevMs,jevOk,model,modelMs,modelOk,sonnet,sonnetMs,sonnetOk,note,file,...}] }.
 * Experiment ids must be unique across built-ins and incoming files; the build fails on a clash.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const W = process.env.JEV_WORKS_DIR || path.resolve(ROOT, "..", "JEV-works");
const R = path.join(W, "kit/results/"), I = path.join(W, "kit/modules/items/");
const j = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

const bench = j(R + "browser-bench-check-vs-jev-2026-09-28.json");
const cross = j(R + "browser-crosscheck-computer-use-proxy-2026-09-28.json");
const corpus = j(path.join(ROOT, "results/raw/corpus-2026-09-28.rows.json"));
const gate = j(R + "browser-action-gate-action-gate-2026-09-28.json");
const gi = j(I + "browser-gate.items.json");
const sv = j(R + "browser-step-verify-step-verify-2026-09-28.json");
const lv = j(R + "browser-step-verify-login-verify-2026-09-28.json");

const rows = [];
const ids = ["npm-react", "rfc2324", "wiki-lisp", "mdn-flex", "wiki-ada-false", "gh-linux", "wiki-python-false", "hn"];
bench.results.forEach((r, i) => { const c = cross.rows[i];
  rows.push({ exp: "E5", id: ids[i], task: "verify a claim about a settled page", site: host(r.url), url: r.url, claim: r.claim, expect: r.expect, kind: "html",
    jev: r.jev.verdict === "inconclusive" ? "escalate" : r.jev.verdict, jevP: r.jevAnswers?.outcome?.probabilities?.verified, jevMs: r.jev.ms, jevOk: r.jev.verdict === "inconclusive" ? null : r.jev.ok,
    model: r.check.verdict, modelMs: r.check.ms, modelOk: r.check.ok,
    sonnet: c.sonnetScreenshotBlind.verdict, sonnetMs: c.sonnetScreenshotBlind.readAndDecideMs, sonnetOk: c.sonnetScreenshotBlind.verdict === r.expect,
    note: r.jev.verdict === "inconclusive" ? (r.jevAnswers?.blocked?.choice !== "none" ? "Jev saw a " + r.jevAnswers.blocked.choice + " wall and escalated" : "outcome unsupported, escalated") : "",
    file: "JEV-works kit/results/browser-bench-check-vs-jev-2026-09-28.json · browser-crosscheck-computer-use-proxy-2026-09-28.json" }); });
for (const r of corpus.rows) { const stopped = !["passed", "failed", "inconclusive"].includes(r.verdict);
  rows.push({ exp: "E9", id: r.id, task: "verify a claim about a page, 3 parallel sessions", site: host(r.url), url: r.url, claim: r.claim, expect: r.expect, kind: "html",
    jev: stopped ? "stopped" : (r.verdict === "inconclusive" ? "escalate" : r.verdict), jevP: r.answers?.outcome?.probabilities?.verified, jevMs: r.jevMs, jevOk: stopped || r.verdict === "inconclusive" ? null : (r.ok ?? null), entropy: r.entropy, worker: r.worker, navMs: r.navMs,
    note: stopped ? "stopped in code before any Jev call: " + String(r.error || r.verdict).slice(0, 90) : (r.verdict === "inconclusive" ? "entropy rule 0 fired, escalated" : ""),
    file: "jev-tape results/raw/corpus-2026-09-28.rows.json · JEV-works kit/results/browser-step-verify-corpus-2026-09-28.json" }); }
for (const it of gate.items) { const src = gi.find((x) => x.id === it.id) || {}; const st = src.state || {}; const a = it.answers;
  rows.push({ exp: "E1", id: it.id, task: "may this click run? (four gate questions)", site: host(st.url), url: st.url || "", claim: (st.target || st.action || it.id).replace(/^@e\d+\s*/, ""), expect: src.labels ? Object.entries(src.labels).map(([k, v]) => k + "=" + v).join(" ") : "", kind: "gate",
    jev: `mutatesWorld ${a.mutatesWorld?.p} · reversible ${a.reversible?.p} · spendsOrSends ${a.spendsOrSends?.p} · blastRadius ${a.blastRadius?.score}`, jevP: a.mutatesWorld?.p, jevMs: it.ms, jevOk: it.correct ? Object.values(it.correct).every(Boolean) : null,
    note: it.correct ? "labelled: " + Object.entries(it.correct).map(([k, v]) => k + (v ? " right" : " wrong")).join(", ") : "unlabelled (label-free quality only)", file: "JEV-works kit/results/browser-action-gate-action-gate-2026-09-28.json" }); }
for (const it of sv.items) { const a = it.answers; rows.push({ exp: "E2", id: it.id, task: "did the page do what the step said? (recorded pairs)", site: "recorded page", url: "", claim: it.id, expect: "", kind: "verify", jev: a.outcome?.choice, jevP: a.outcome?.probabilities?.verified, jevMs: it.ms, jevOk: Object.values(it.correct || {}).every(Boolean), note: "errorShown " + a.errorShown?.p + " · blocked " + a.blocked?.choice, file: "JEV-works kit/results/browser-step-verify-step-verify-2026-09-28.json" }); }
for (const it of lv.items) { const a = it.answers; rows.push({ exp: "E3", id: it.id, task: "is the person signed in? (login-verify)", site: "recorded page", url: "", claim: it.id, expect: "", kind: "login", jev: `signedIn ${a.signedInSignsShown?.p} · formGone ${a.loginFormGone?.p} · credError ${a.credentialErrorShown?.p} · ${a.interstitial?.choice}`, jevP: a.signedInSignsShown?.p, jevMs: it.ms, jevOk: Object.values(it.correct || {}).every(Boolean), note: Object.values(it.correct || {}).every(Boolean) ? "all four right" : "loginFormGone mid-band on the closed-flash page", file: "JEV-works kit/results/browser-step-verify-login-verify-2026-09-28.json" }); }
const spec = "jev-tape spec/SURFACES-VIBIUM.md";
const hand = [
  { exp: "E4", id: "fixture-login-gate", task: "log in on the fixture site: gate the submit", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/login", claim: "click Login", expect: "", kind: "login", jev: "escalate", jevP: 0.81, jevMs: 330, jevOk: null, note: "mutatesWorld 0.81, reversible 0.39: mid-band, operator composed", file: spec + " §8a" },
  { exp: "E4", id: "fixture-login-verify", task: "log in on the fixture site: verify the landing", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/secure", claim: "the person is signed in", expect: "passed", kind: "login", jev: "passed", jevP: 0.99, jevMs: 503, jevOk: true, note: "second run served from the tape: 0 calls", file: spec + " §8a" },
  { exp: "E6", id: "login-A-model-only", task: "whole login, model plans and verifies", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/login", claim: "log in as tomsmith", expect: "passed", kind: "login", model: "passed", modelMs: 32800, modelOk: true, note: "run 14.8 s + check 17.3 s", file: spec + " §8c" },
  { exp: "E6", id: "login-B-jev-policy", task: "whole login, Jev gate + verify", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/login", claim: "log in as tomsmith", expect: "passed", kind: "login", jev: "passed", jevMs: 5000, jevOk: true, note: "gate 0.33 s, verify 0.50 s; 81 ms together from the tape", file: spec + " §8c" },
  { exp: "E6", id: "login-C-gate-to-model", task: "whole login, gate escalate handed to check", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/login", claim: "is this click safe", expect: "", kind: "login", model: "no verdict", modelMs: 180000, modelOk: false, note: "check timed out; model fallback is now verify-only", file: spec + " §8c" },
  { exp: "E7", id: "hn-click-new", task: "click 'new' on Hacker News", site: "news.ycombinator.com", url: "https://news.ycombinator.com/", claim: "the newest stories are showing", expect: "passed", kind: "html", jev: "passed", jevP: 0.97, jevMs: 435, jevOk: true, note: "gate auto (mutatesWorld 0.06), verify true; whole step 1.6 s", file: spec + " §8d" },
  { exp: "E7", id: "wiki-search", task: "search a name on Wikipedia", site: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Special:Search", claim: "search results for the name are showing", expect: "passed", kind: "html", jev: "passed", jevP: 0.48, jevMs: 264, jevOk: true, note: "accepted at 0.48: exposed the missing peakedness rule, now escalates above entropy 0.6", file: spec + " §8d" },
  { exp: "E7", id: "gh-issue-filter", task: "filter an issue list on GitHub", site: "github.com", url: "https://github.com/microsoft/vscode/issues", claim: "the issue list is filtered by the typed query", expect: "failed", kind: "html", jev: "failed", jevP: 0.64, jevMs: 320, jevOk: true, model: "passed", modelMs: 50000, modelOk: null, note: "contradicted 0.64 and right: the scripted fill never stuck. Model-only run typed its own way and passed", file: spec + " §8d" },
  { exp: "E8", id: "pick-search-box", task: "which of 80 elements is the search box", site: "github.com", url: "https://github.com/microsoft/vscode/issues", claim: "pick the search box", expect: "passed", kind: "pick", jev: "passed", jevP: 0.99, jevMs: 304, jevOk: true, note: "one Choice over the map lines plus none", file: spec + " §8d" },
  { exp: "E8", id: "pick-pr-tab", task: "which element is the Pull requests tab", site: "github.com", url: "https://github.com/microsoft/vscode/issues", claim: "pick the Pull requests tab", expect: "passed", kind: "pick", jev: "passed", jevP: 1.0, jevMs: 300, jevOk: true, note: "", file: spec + " §8d" },
  { exp: "E8", id: "pick-impossible", task: "which element pays for a subscription", site: "github.com", url: "https://github.com/microsoft/vscode/issues", claim: "pay for a subscription", expect: "none", kind: "pick", jev: "none", jevP: 0.90, jevMs: 300, jevOk: true, note: "declined to pick: the page cannot serve the goal", file: spec + " §8d" },
  { exp: "E10", id: "rec-smoke-npm", task: "record a row to a zip with screenshots", site: "npmjs.com", url: "https://www.npmjs.com/package/react", claim: "recording zip has actions and screenshots", expect: "passed", kind: "html", jev: "passed", jevOk: true, note: "zip written", file: "jev-tape docs/HANDOFF-2026-09-28.md" },
  { exp: "E10", id: "rec-smoke-rfc-pdf", task: "record a row to a zip with screenshots", site: "rfc-editor.org", url: "https://www.rfc-editor.org/rfc/rfc2324.txt", claim: "this is a PDF", expect: "passed", kind: "pdf", jev: "failed", jevOk: null, note: "catalog label wrong (served text/plain); Jev correctly rejected the claim, so no label to score against", file: "jev-tape docs/HANDOFF-2026-09-28.md" },
  { exp: "E12", id: "pixel-operator-login", task: "log in by screenshots, pixel clicks and single keys", site: "127.0.0.1:8787", url: "http://127.0.0.1:8787/login", claim: "log in as tomsmith", expect: "passed", kind: "login", sonnet: "passed", sonnetMs: 14174, sonnetOk: true, note: "3 screenshots, 1 click, 30 key presses; 23.1 s agent wall", file: "jev-tape docs/COMPUTER-USE-CROSSCHECK.md" },
];
rows.push(...hand);
const D = "2026-09-28", JEV = "jev-1.13.0", M = "xai/grok-4.6";
const experiments = [
  { id: "E1", title: "Gate questions on recorded targets", kind: "lab", n: 43, what: "43 clickable targets from six recorded pages, four gate questions each, 7 labelled", result: "mutatesWorld, blastRadius, reversible JEV-SAFE; spendsOrSends MARGINAL", stamp: "⚖", stampWord: "measured", file: "JEV-works kit/results/browser-action-gate-action-gate-2026-09-28.json" },
  { id: "E2", title: "Verify pairs, recorded", kind: "lab", n: 4, what: "four before and after pairs with a claim", result: "outcome 4/4, errorShown 4/4, blocked 3/4; below the 8-item floor", stamp: "◐", stampWord: "partial", file: "JEV-works kit/results/browser-step-verify-step-verify-2026-09-28.json" },
  { id: "E3", title: "Login pairs, recorded", kind: "lab", n: 3, what: "three sign-in outcomes, four login questions each", result: "11/12 right; loginFormGone 0.64 on the closed-flash page", stamp: "◐", stampWord: "partial", file: "JEV-works kit/results/browser-step-verify-login-verify-2026-09-28.json" },
  { id: "E4", title: "Live login, fixture site", kind: "live", n: 2, what: "go, fill, fill, click, verify against the local fixture site", result: "gate escalated (mutatesWorld 0.81), operator composed, verify 0.99 in 503 ms; replay 0 calls", stamp: "⚖", stampWord: "measured", file: spec + " §8a" },
  { id: "E5", title: "Bench: same claim, Jev vs check", kind: "live", n: 8, what: "eight public pages, one claim each, both judges on the same settled page", result: "Jev 248 ms vs 41.0 s (164×); Jev 6/6 decided right + 2 escalates; check 7/8", stamp: "⚖", stampWord: "measured", file: "JEV-works kit/results/browser-bench-check-vs-jev-2026-09-28.json" },
  { id: "E6", title: "Login three ways", kind: "live", n: 3, what: "model only · Jev + policy · Jev with the gate escalate handed to check", result: "32.8 s · 5.0 s · 180 s timeout (model fallback is verify-only)", stamp: "⚖", stampWord: "measured", file: spec + " §8c" },
  { id: "E7", title: "Real sites, no person, no model", kind: "live", n: 3, what: "Hacker News click, Wikipedia search, GitHub issue filter", result: "two auto and verified; GitHub verify contradicted 0.64 and was right", stamp: "⚖", stampWord: "measured", file: spec + " §8d" },
  { id: "E8", title: "Element pick over 80 map lines", kind: "live", n: 3, what: "one Choice over every element plus none", result: "0.99 · 1.00 · none at 0.90", stamp: "⚖", stampWord: "measured", file: spec + " §8d" },
  { id: "E9", title: "Corpus, 80 rows, 3 parallel sessions", kind: "live", n: 80, what: "40 public pages × a true and a false claim, 88 s wall", result: "74 settled; 73/73 right, 0 wrong, 1 escalate; JEV-SAFE 98.6% vs 50%, p = 2.9e-11; Brier 0.006", stamp: "⚖", stampWord: "measured", file: "JEV-works kit/results/browser-step-verify-corpus-2026-09-28.json" },
  { id: "E10", title: "Recording smoke", kind: "live", n: 2, what: "record start --screenshots, then record stop -o zip, per row", result: "zips with actions and screenshots; found one wrong catalog label", stamp: "✓", stampWord: "accept", file: "jev-tape docs/HANDOFF-2026-09-28.md" },
  { id: "E11", title: "Cross-check: blind screenshot judge", kind: "proxy", n: 8, what: "Sonnet reads one frame per page; neutral names, claim-only prompt", result: "7/8 in 2.8 s (9.2 s per agent); the miss is the Cloudflare wall", stamp: "⚖", stampWord: "measured", file: "JEV-works kit/results/browser-crosscheck-computer-use-proxy-2026-09-28.json" },
  { id: "E12", title: "Cross-check: pixel operator login", kind: "proxy", n: 1, what: "Sonnet with screenshot, mouse click x y, one key per press", result: "passed in 14.2 s self-timed, 23.1 s wall", stamp: "⚖", stampWord: "measured", file: "jev-tape docs/COMPUTER-USE-CROSSCHECK.md" },
].map((e) => ({ date: D, jev: JEV, model: M, ...e }));

// Other sessions' results: every results/incoming/*.json in the same schema.
const incomingDir = path.join(ROOT, "results/incoming");
const incoming = fs.existsSync(incomingDir) ? fs.readdirSync(incomingDir).filter((f) => f.endsWith(".json")).sort() : [];
const STAMPS = new Set(["⚖", "✓", "±", "?", "⊘", "◐", "◆"]);
for (const f of incoming) {
  const inc = j(path.join(incomingDir, f));
  for (const e of inc.experiments || []) {
    if (experiments.some((x) => x.id === e.id)) throw new Error(`${f}: experiment id ${e.id} already exists`);
    for (const k of ["id", "title", "kind", "n", "what", "result", "stamp", "stampWord", "file"]) if (e[k] === undefined) throw new Error(`${f}: experiment ${e.id || "?"} lacks ${k}`);
    if (!STAMPS.has(e.stamp)) throw new Error(`${f}: experiment ${e.id} has stamp ${e.stamp}; use one of ${[...STAMPS].join(" ")}`);
    if (!["lab", "live", "proxy"].includes(e.kind)) throw new Error(`${f}: experiment ${e.id} kind must be lab, live or proxy`);
    experiments.push({ source: f, ...e });
  }
  for (const r of inc.rows || []) {
    for (const k of ["exp", "id", "task", "claim", "kind", "file"]) if (r[k] === undefined) throw new Error(`${f}: row ${r.id || "?"} lacks ${k}`);
    if (!experiments.some((x) => x.id === r.exp)) throw new Error(`${f}: row ${r.id} names unknown experiment ${r.exp}`);
    rows.push({ source: f, site: r.site || host(r.url || ""), url: "", expect: "", ...r });
  }
}
const dup = rows.map((r) => r.exp + "/" + r.id).filter((k, i, a) => a.indexOf(k) !== i);
if (dup.length) throw new Error("duplicate row ids: " + dup.join(", "));

const settled = rows.filter((r) => r.exp === "E9" && r.jev !== "stopped").length;
const jevCallsBuiltin = 43 + 4 + 3 + 2 + 8 + 2 + 6 + 3 + settled;
const jevCallsIncoming = rows.filter((r) => r.source && r.jevMs != null).length;
// Verify verdicts: rows where Jev answered passed or failed against a label (E5 bench, E7 real sites, E9 corpus, and any
// incoming row with jev passed/failed and a jevOk). Gate and login-question rows are scored per question in the lab files.
const verdictRows = rows.filter((r) => (r.jev === "passed" || r.jev === "failed") && (r.jevOk === true || r.jevOk === false));
const labelled = rows.filter((r) => r.jevOk === true || r.jevOk === false);
const totals = {
  experiments: experiments.length, rows: rows.length,
  jevCalls: jevCallsBuiltin + jevCallsIncoming,
  verifyDecided: verdictRows.length, verifyRight: verdictRows.filter((r) => r.jevOk).length, verifyWrong: verdictRows.filter((r) => !r.jevOk).length,
  verifyEscalates: rows.filter((r) => r.jev === "escalate" && r.kind !== "gate" && !/gate/.test(r.id)).length,
  labelledRows: labelled.length, labelledRight: labelled.filter((r) => r.jevOk).length,
  pages: new Set(rows.filter((r) => r.url).map((r) => r.url)).size,
  sites: new Set(rows.map((r) => r.site).filter((s) => s && s !== "recorded page" && !s.startsWith("127."))).size,
  judges: ["jev", "model", "sonnet"].filter((k) => rows.some((r) => r[k] != null)).length,
  incomingFiles: incoming,
};
const out = { schema: 1, builtAt: new Date().toISOString().slice(0, 10), jev: JEV, vibium: "26.8.21", model: M, totals, experiments, rows };
fs.writeFileSync(path.join(ROOT, "results/registry.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(totals));
