#!/usr/bin/env node
/**
 * Larger number space: N workers, each its own Vibium session and its own Jev calls, over a catalog of
 * pages with a claim and an expected verdict. Every row becomes a labelled item for JEV-works.
 *
 *   npm run corpus -- [--catalog fixtures/vibium/catalog-pages.json] [--workers 3] [--limit N]
 *                     [--out runs/corpus-<date>.json] [--items ../JEV-works/kit/modules/items/browser-verify.corpus-<date>.items.json]
 *
 * Per row: go → wait load → snapshot → one verify POST (step-verify) → compose. No actions, no model.
 * Labels written: outcome only (passed → verified, failed → contradicted). errorShown and blocked are unlabelled.
 * Rows whose page never settled (empty document) are recorded as nav failures and get no item.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { systemOne } from "../src/typesafe/client.ts";
import { ensureDaemon, excerpt, mapLabels, snapshot, vibium, type Snapshot } from "../src/vibium/cli.ts";
import { decide, normEntropy } from "../src/vibium/decide.ts";
import { buildRequest, loadPack, moduleOf } from "../src/vibium/pack.ts";
import { Tape, tapedJudge } from "../src/vibium/tape.ts";
import type { TypesafeAnswer } from "../src/typesafe/contract.ts";

type Row = { id: string; url: string; claim: string; expect: "passed" | "failed" };
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
if (!process.env.TYPESAFE_API_KEY) { console.error("TYPESAFE_API_KEY is not set"); process.exit(1); }

const ROOT = new URL("../", import.meta.url).pathname;
const date = new Date().toISOString().slice(0, 10);
const catalogPath = opt("--catalog") ?? `${ROOT}fixtures/vibium/catalog-pages.json`;
const workers = Number(opt("--workers") ?? 3);
const limit = Number(opt("--limit") ?? Infinity);
const outPath = opt("--out") ?? `${ROOT}runs/corpus-${date}.json`;
const itemsPath = opt("--items") ?? `${ROOT}runs/browser-verify.corpus-${date}.items.json`;
const rows = (JSON.parse(readFileSync(catalogPath, "utf8")) as Row[]).slice(0, limit);

const pack = loadPack(`${ROOT}packs/browser.step-verify.json`);
const mod = moduleOf(pack, "step-verify");
const tape = new Tape(`${ROOT}runs/vibium-tape.jsonl`);
const stats = { posts: 0, replays: 0 };
const judge = tapedJudge((req) => systemOne(req), tape, stats, { pack: pack.name, module: mod.name });

type Result = {
  id: string; url: string; claim: string; expect: string; worker: number;
  navMs: number; snapMs: number; jevMs?: number; verdict: string; ok: boolean | null; rule?: number | "default";
  entropy?: number; answers?: Record<string, TypesafeAnswer>; error?: string; state?: Record<string, unknown>;
};

async function runRow(row: Row, w: number, vopts: { session: string; headless: boolean }, prevUrl: string): Promise<Result> {
  const t0 = performance.now();
  try {
    await vibium(["go", row.url], { ...vopts, timeoutMs: 60_000 });
    await vibium(["wait", "load", "--timeout", "30000"], vopts).catch(() => undefined);
    const navMs = Math.round(performance.now() - t0);
    const t1 = performance.now();
    const s: Snapshot = await snapshot(vopts);
    const snapMs = Math.round(performance.now() - t1);
    if (s.map === "" && s.text.trim().length < 200) {
      return { id: row.id, url: row.url, claim: row.claim, expect: row.expect, worker: w, navMs, snapMs, verdict: "nav-failed", ok: null, error: `empty document: ${s.text.slice(0, 60)}` };
    }
    const state = {
      claim: row.claim, beforeUrl: prevUrl, afterUrl: s.url, urlChanged: s.url !== prevUrl ? "yes" : "no", title: s.title,
      textExcerpt: excerpt(s.text, 1500), labelsAdded: mapLabels(s.map).slice(0, 60), labelsRemoved: [] as string[],
    };
    const req = buildRequest(pack, mod.name, state);
    const t2 = performance.now();
    const res = await judge(req);
    const jevMs = Math.round(performance.now() - t2);
    const d = decide(res.answers, mod.compose);
    const verdict = d.verdict === true ? "passed" : d.verdict === false ? "failed" : "inconclusive";
    const oc = res.answers.outcome;
    const entropy = oc?.type === "choice" ? normEntropy(oc.probabilities) : undefined;
    return { id: row.id, url: row.url, claim: row.claim, expect: row.expect, worker: w, navMs, snapMs, jevMs, verdict, ok: verdict === row.expect, rule: d.rule, entropy, answers: res.answers, state };
  } catch (e) {
    return { id: row.id, url: row.url, claim: row.claim, expect: row.expect, worker: w, navMs: Math.round(performance.now() - t0), snapMs: 0, verdict: "error", ok: null, error: String((e as Error).message).slice(0, 200) };
  }
}

const results: Result[] = [];
let next = 0;
const t0 = performance.now();
await Promise.all(Array.from({ length: Math.min(workers, rows.length) }, async (_, w) => {
  const vopts = { session: `corpus-${w}`, headless: true };
  await ensureDaemon(vopts);
  let prevUrl = "about:blank";
  for (let i = next++; i < rows.length; i = next++) {
    const r = await runRow(rows[i]!, w, vopts, prevUrl);
    results.push(r);
    prevUrl = r.state ? (r.state.afterUrl as string) : prevUrl;
    console.log(JSON.stringify({ id: r.id, w, verdict: r.verdict, expect: r.expect, ok: r.ok, jevMs: r.jevMs, navMs: r.navMs, entropy: r.entropy !== undefined ? +r.entropy.toFixed(2) : undefined, error: r.error }));
  }
  await vibium(["daemon", "stop"], vopts).catch(() => undefined);
}));
const wallMs = Math.round(performance.now() - t0);

const decided = results.filter((r) => r.verdict === "passed" || r.verdict === "failed");
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const summary = {
  rows: results.length, workers, wallMs, posts: stats.posts, replays: stats.replays,
  decided: decided.length, right: decided.filter((r) => r.ok).length, wrong: decided.filter((r) => r.ok === false).length,
  inconclusive: results.filter((r) => r.verdict === "inconclusive").length,
  navFailed: results.filter((r) => r.verdict === "nav-failed").length, errors: results.filter((r) => r.verdict === "error").length,
  jevMedianMs: med(results.flatMap((r) => (r.jevMs ? [r.jevMs] : []))), navMedianMs: med(results.map((r) => r.navMs)),
  model: "jev-1.13.0",
};
console.log(JSON.stringify({ summary }));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ summary, results, at: new Date().toISOString(), catalog: catalogPath }, null, 2) + "\n");
const items = results.filter((r) => r.state).map((r) => ({ id: r.id, state: r.state, labels: { outcome: r.expect === "passed" ? "verified" : "contradicted" } }));
mkdirSync(dirname(itemsPath), { recursive: true });
writeFileSync(itemsPath, JSON.stringify(items, null, 2) + "\n");
console.log(`wrote ${outPath} and ${items.length} items → ${itemsPath}`);
