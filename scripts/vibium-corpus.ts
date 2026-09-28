#!/usr/bin/env node
/**
 * Larger number space: N workers, each its own Vibium session and its own Jev calls, over a catalog of
 * pages with a claim and an expected verdict. Every row becomes a labelled item for JEV-works.
 *
 *   npm run corpus -- [--catalog fixtures/vibium/catalog-100.json] [--workers 3] [--rows 0-39] [--limit N]
 *                     [--record recordings/] [--llm-fallback] [--session-prefix corpus]
 *                     [--out runs/corpus-<date>.json] [--items ../JEV-works/kit/modules/items/…items.json]
 *
 * Per row: (record start) → go → wait load → snapshot (+ document.contentType) → one verify POST (step-verify)
 * → compose → on escalate, with --llm-fallback, `vibium check` (the model, e.g. xai/grok) with the same claim
 * → (record stop → <id>.zip). Labels written: outcome only (passed → verified, failed → contradicted).
 * Rows whose page never settled are recorded as nav failures and get no item.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { systemOne } from "../src/typesafe/client.ts";
import { ensureDaemon, excerpt, mapLabels, snapshot, vibium, type Snapshot } from "../src/vibium/cli.ts";
import { decide, normEntropy } from "../src/vibium/decide.ts";
import { buildRequest, loadPack, moduleOf } from "../src/vibium/pack.ts";
import { Tape, tapedJudge } from "../src/vibium/tape.ts";
import type { TypesafeAnswer } from "../src/typesafe/contract.ts";

type Row = { id: string; url: string; claim: string; expect: "passed" | "failed"; kind?: string };
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
if (!process.env.TYPESAFE_API_KEY) { console.error("TYPESAFE_API_KEY is not set"); process.exit(1); }

const ROOT = new URL("../", import.meta.url).pathname;
const date = new Date().toISOString().slice(0, 10);
const catalogPath = opt("--catalog") ?? `${ROOT}fixtures/vibium/catalog-100.json`;
const workers = Number(opt("--workers") ?? 3);
const limit = Number(opt("--limit") ?? Infinity);
const range = opt("--rows")?.split("-").map(Number);
const prefix = opt("--session-prefix") ?? "corpus";
const recordDir = opt("--record") ? resolve(opt("--record")!) : null;
const llmFallback = flag("--llm-fallback");
const provider = opt("--provider") ?? "xai";
const model = opt("--model") ?? "grok-4.6";
const tag = range ? `-${range[0]}-${range[1] ?? range[0]}` : "";
const outPath = opt("--out") ?? `${ROOT}runs/corpus-${date}${tag}.json`;
const itemsPath = opt("--items") ?? `${ROOT}runs/browser-verify.corpus-${date}${tag}.items.json`;
let rows = JSON.parse(readFileSync(catalogPath, "utf8")) as Row[];
if (range) rows = rows.slice(range[0]!, (range[1] ?? range[0]!) + 1);
rows = rows.slice(0, limit);
if (recordDir) mkdirSync(recordDir, { recursive: true });

const pack = loadPack(`${ROOT}packs/browser.step-verify.json`);
const mod = moduleOf(pack, "step-verify");
const tape = new Tape(`${ROOT}runs/vibium-tape.jsonl`);
const stats = { posts: 0, replays: 0, llm: 0, llmMs: 0 };
const judge = tapedJudge((req) => systemOne(req), tape, stats, { pack: pack.name, module: mod.name });

type Result = {
  id: string; url: string; kind: string; claim: string; expect: string; worker: number; contentType?: string;
  navMs: number; snapMs: number; jevMs?: number; verdict: string; source?: "jev" | "llm"; ok: boolean | null; rule?: number | "default";
  entropy?: number; llm?: { verdict: string; ms: number; summary?: string }; recording?: string;
  answers?: Record<string, TypesafeAnswer>; error?: string; state?: Record<string, unknown>;
};

const base = (row: Row, w: number): Pick<Result, "id" | "url" | "kind" | "claim" | "expect" | "worker"> =>
  ({ id: row.id, url: row.url, kind: row.kind ?? "html", claim: row.claim, expect: row.expect, worker: w });

async function runRow(row: Row, w: number, vopts: { session: string; headless: boolean }, prevUrl: string): Promise<Result> {
  const t0 = performance.now();
  let recording: string | undefined;
  const stopRecording = async () => {
    if (!recordDir) return;
    const file = `${recordDir}/${row.id}.zip`;
    await vibium(["record", "stop", "-o", file], vopts).then(() => { recording = file; }).catch(() => undefined);
  };
  try {
    if (recordDir) await vibium(["record", "start", "--screenshots"], vopts).catch(() => undefined);
    await vibium(["go", row.url], { ...vopts, timeoutMs: 60_000 });
    await vibium(["wait", "load", "--timeout", "30000"], vopts).catch(() => undefined);
    const navMs = Math.round(performance.now() - t0);
    const t1 = performance.now();
    const s: Snapshot = await snapshot(vopts);
    const contentType = await vibium<string>(["eval", "document.contentType"], vopts).catch(() => "unknown");
    const snapMs = Math.round(performance.now() - t1);
    const isHtml = /html/i.test(contentType);
    if (isHtml && s.map === "" && s.text.trim().length < 200) {
      await stopRecording();
      return { ...base(row, w), contentType, navMs, snapMs, verdict: "nav-failed", ok: null, recording, error: `empty document: ${s.text.slice(0, 60)}` };
    }
    const state = {
      claim: row.claim, beforeUrl: prevUrl, afterUrl: s.url, urlChanged: s.url !== prevUrl ? "yes" : "no", title: s.title, contentType,
      textExcerpt: excerpt(s.text, 1500), labelsAdded: mapLabels(s.map).slice(0, 60), labelsRemoved: [] as string[],
    };
    const req = buildRequest(pack, mod.name, state);
    const t2 = performance.now();
    const res = await judge(req);
    const jevMs = Math.round(performance.now() - t2);
    const d = decide(res.answers, mod.compose);
    let verdict = d.verdict === true ? "passed" : d.verdict === false ? "failed" : "inconclusive";
    let source: "jev" | "llm" = "jev";
    const oc = res.answers.outcome;
    const entropy = oc?.type === "choice" ? normEntropy(oc.probabilities) : undefined;
    let llm: Result["llm"];
    if (verdict === "inconclusive" && llmFallback) {
      const t3 = performance.now();
      try {
        const r = await vibium<{ status: string; summary?: string }>(["check", "--provider", provider, "--model", model, "--reasoning-effort", "", row.claim], { ...vopts, timeoutMs: 300_000 });
        llm = { verdict: r.status, ms: Math.round(performance.now() - t3), summary: r.summary?.slice(0, 200) };
      } catch (e) {
        llm = { verdict: "error", ms: Math.round(performance.now() - t3), summary: String((e as Error).message).slice(0, 160) };
      }
      stats.llm++; stats.llmMs += llm.ms;
      if (llm.verdict === "passed" || llm.verdict === "failed") { verdict = llm.verdict; source = "llm"; }
    }
    await stopRecording();
    return { ...base(row, w), contentType, navMs, snapMs, jevMs, verdict, source, ok: verdict === row.expect ? true : verdict === "inconclusive" ? false : verdict === "error" ? null : false, rule: d.rule, entropy, llm, recording, answers: res.answers, state };
  } catch (e) {
    await stopRecording();
    return { ...base(row, w), navMs: Math.round(performance.now() - t0), snapMs: 0, verdict: "error", ok: null, recording, error: String((e as Error).message).slice(0, 200) };
  }
}

const results: Result[] = [];
let next = 0;
const t0 = performance.now();
await Promise.all(Array.from({ length: Math.min(workers, rows.length) }, async (_, w) => {
  const vopts = { session: `${prefix}-${w}`, headless: true };
  await ensureDaemon(vopts);
  let prevUrl = "about:blank";
  for (let i = next++; i < rows.length; i = next++) {
    const r = await runRow(rows[i]!, w, vopts, prevUrl);
    results.push(r);
    prevUrl = r.state ? (r.state.afterUrl as string) : prevUrl;
    console.log(JSON.stringify({ id: r.id, kind: r.kind, w, verdict: r.verdict, source: r.source, expect: r.expect, ok: r.ok, jevMs: r.jevMs, navMs: r.navMs, ct: r.contentType, entropy: r.entropy !== undefined ? +r.entropy.toFixed(2) : undefined, llm: r.llm ? `${r.llm.verdict} ${r.llm.ms}ms` : undefined, rec: r.recording ? true : undefined, error: r.error }));
  }
  await vibium(["daemon", "stop"], vopts).catch(() => undefined);
}));
const wallMs = Math.round(performance.now() - t0);

const decided = results.filter((r) => r.verdict === "passed" || r.verdict === "failed");
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const byKind: Record<string, { rows: number; right: number; wrong: number; inconclusive: number; navFailed: number }> = {};
for (const r of results) {
  const k = (byKind[r.kind] ??= { rows: 0, right: 0, wrong: 0, inconclusive: 0, navFailed: 0 });
  k.rows++;
  if (r.verdict === "nav-failed") k.navFailed++;
  else if (r.verdict === "inconclusive") k.inconclusive++;
  else if (r.ok === true) k.right++;
  else if (r.ok === false) k.wrong++;
}
const summary = {
  rows: results.length, workers, wallMs, posts: stats.posts, replays: stats.replays,
  decided: decided.length, byJev: decided.filter((r) => r.source === "jev").length, byLlm: decided.filter((r) => r.source === "llm").length,
  right: decided.filter((r) => r.ok).length, wrong: decided.filter((r) => r.ok === false).length,
  inconclusive: results.filter((r) => r.verdict === "inconclusive").length,
  navFailed: results.filter((r) => r.verdict === "nav-failed").length, errors: results.filter((r) => r.verdict === "error").length,
  llmCalls: stats.llm, llmMedianMs: stats.llm ? Math.round(stats.llmMs / stats.llm) : 0,
  jevMedianMs: med(results.flatMap((r) => (r.jevMs ? [r.jevMs] : []))), navMedianMs: med(results.map((r) => r.navMs)),
  recordings: results.filter((r) => r.recording).length, byKind, model: "jev-1.13.0", llmModel: llmFallback ? `${provider}/${model}` : null,
};
console.log(JSON.stringify({ summary }));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ summary, results, at: new Date().toISOString(), catalog: catalogPath }, null, 2) + "\n");
const items = results.filter((r) => r.state).map((r) => ({ id: r.id, state: r.state, labels: { outcome: r.expect === "passed" ? "verified" : "contradicted" } }));
mkdirSync(dirname(itemsPath), { recursive: true });
writeFileSync(itemsPath, JSON.stringify(items, null, 2) + "\n");
console.log(`wrote ${outPath} and ${items.length} items → ${itemsPath}`);
