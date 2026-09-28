#!/usr/bin/env node
/**
 * Same claim, same page, same browser session: Vibium's own model loop (`vibium check`, an LLM tool loop)
 * against one Jev verify POST. Both keys required. Rows are real public pages from the 2026-09-16 field
 * catalog, plus false claims. Jev goes first (reads only); Check goes last because it may navigate.
 *
 *   npm run bench -- [--rows 0-7] [--provider xai --model grok-4.6] [--out runs/bench.json]
 *
 * Reported per row: Jev POST ms, Jev verdict, Check wall ms, Check verdict, expected, and the ratio.
 * "Verdict" for Jev is the step-verify compose rule: true → passed, false → failed, escalate → inconclusive.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { systemOne } from "../src/typesafe/client.ts";
import { ensureDaemon, excerpt, mapLabels, snapshot, vibium, type Snapshot } from "../src/vibium/cli.ts";
import { decide } from "../src/vibium/decide.ts";
import { buildRequest, loadPack, moduleOf } from "../src/vibium/pack.ts";

const ROWS = [
  { url: "https://www.npmjs.com/package/react", claim: "This is the npm registry page for the package named react", expect: "passed" },
  { url: "https://www.rfc-editor.org/info/rfc2324/", claim: "This page is about RFC 2324, the Hyper Text Coffee Pot Control Protocol", expect: "passed" },
  { url: "https://en.wikipedia.org/wiki/Common_Lisp", claim: "This is the Wikipedia article on the Common Lisp programming language", expect: "passed" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout", claim: "This MDN page documents CSS flexible box layout", expect: "passed" },
  { url: "https://en.wikipedia.org/wiki/Ada_Lovelace", claim: "This article says Ada Lovelace invented JavaScript", expect: "failed" },
  { url: "https://github.com/torvalds/linux", claim: "This is the GitHub repository page for torvalds/linux", expect: "passed" },
  { url: "https://en.wikipedia.org/wiki/Python_(programming_language)", claim: "This article says Python was created by Linus Torvalds", expect: "failed" },
  { url: "https://news.ycombinator.com/", claim: "The Hacker News front page is showing a list of stories with points and comments", expect: "passed" },
] as const;

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const range = (opt("--rows") ?? `0-${ROWS.length - 1}`).split("-").map(Number);
const rows = ROWS.slice(range[0]!, (range[1] ?? range[0]!) + 1);
const provider = opt("--provider") ?? "xai";
const model = opt("--model") ?? "grok-4.6";
const outPath = opt("--out") ?? new URL("../runs/bench.json", import.meta.url).pathname;

if (!process.env.TYPESAFE_API_KEY) { console.error("TYPESAFE_API_KEY is not set"); process.exit(1); }
if (!process.env.XAI_API_KEY && provider === "xai") { console.error("XAI_API_KEY is not set"); process.exit(1); }

const verifyPack = loadPack(new URL("../packs/browser.step-verify.json", import.meta.url).pathname);
const mod = moduleOf(verifyPack, "step-verify");
const vopts = { headless: true, session: process.env.VIBIUM_SESSION ?? "bench" };

async function jevVerify(claim: string, before: string, s: Snapshot) {
  const req = buildRequest(verifyPack, "step-verify", {
    claim, beforeUrl: before, afterUrl: s.url, urlChanged: s.url !== before ? "yes" : "no", title: s.title,
    textExcerpt: excerpt(s.text, 1500), labelsAdded: mapLabels(s.map).slice(0, 60), labelsRemoved: [],
  });
  const t0 = performance.now();
  const res = await systemOne(req);
  const ms = Math.round(performance.now() - t0);
  const d = decide(res.answers, mod.compose);
  const verdict = d.verdict === true ? "passed" : d.verdict === false ? "failed" : "inconclusive";
  return { ms, verdict, rule: d.rule, answers: res.answers, inputTokens: res.usage.input_tokens };
}

async function vibiumCheck(claim: string) {
  const t0 = performance.now();
  try {
    const r = await vibium<{ status: string; summary?: string }>(["check", "--provider", provider, "--model", model, "--reasoning-effort", "", claim], { ...vopts, timeoutMs: 300_000 });
    return { ms: Math.round(performance.now() - t0), verdict: r.status, summary: r.summary?.slice(0, 160) };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), verdict: "error", summary: String((e as Error).message).slice(0, 160) };
  }
}

await ensureDaemon(vopts);
const results: unknown[] = [];
let prevUrl = "about:blank";
for (const row of rows) {
  const tNav = performance.now();
  await vibium(["go", row.url], vopts);
  await vibium(["wait", "load", "--timeout", "30000"], vopts).catch(() => undefined);
  const navMs = Math.round(performance.now() - tNav);
  const tSnap = performance.now();
  const s = await snapshot(vopts);
  const snapMs = Math.round(performance.now() - tSnap);
  const jev = await jevVerify(row.claim, prevUrl, s);
  const check = await vibiumCheck(row.claim);
  const urlAfterCheck = await vibium<string>(["url"], vopts).catch(() => "?");
  const line = {
    url: row.url, claim: row.claim, expect: row.expect, navMs, snapMs,
    jev: { ms: jev.ms, verdict: jev.verdict, ok: jev.verdict === row.expect, rule: jev.rule, inputTokens: jev.inputTokens },
    check: { ms: check.ms, verdict: check.verdict, ok: check.verdict === row.expect, movedTo: urlAfterCheck !== s.url ? urlAfterCheck : undefined, summary: check.summary },
    ratio: jev.ms ? Math.round((check.ms / jev.ms) * 10) / 10 : null,
  };
  results.push({ ...line, jevAnswers: jev.answers });
  console.log(JSON.stringify(line));
  prevUrl = s.url;
}
await vibium(["daemon", "stop"], vopts).catch(() => undefined);

const ok = (k: "jev" | "check") => results.filter((r) => (r as { [x: string]: { ok: boolean } })[k]!.ok).length;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const summary = {
  rows: results.length, model: "jev-1.13.0", checkModel: `${provider}/${model}`,
  jevMedianMs: med(results.map((r) => (r as { jev: { ms: number } }).jev.ms)),
  checkMedianMs: med(results.map((r) => (r as { check: { ms: number } }).check.ms)),
  medianRatio: med(results.map((r) => (r as { ratio: number | null }).ratio ?? 0)),
  jevRight: `${ok("jev")}/${results.length}`, checkRight: `${ok("check")}/${results.length}`,
};
console.log(JSON.stringify({ summary }));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ summary, results, at: new Date().toISOString() }, null, 2) + "\n");
console.log(`wrote ${outPath}`);
