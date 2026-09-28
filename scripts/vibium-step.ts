#!/usr/bin/env node
/**
 * One live, typed browser flow through Vibium and TypeSafe. Key required; missing key = exit 1, no verdict invented.
 *
 *   npm run vibium -- --url https://the-internet.herokuapp.com/login \
 *     --fill @e1 tomsmith --fill @e2 'SuperSecretPassword!' \
 *     --click @e3 --expect "the user is signed in and sees the secure area" \
 *     --verify-module login-verify --allow-host the-internet.herokuapp.com
 *
 * Options
 *   --url U                 first step: go U (nav, path 0)
 *   --fill @eN VALUE        tab edit, path 0 (repeatable)
 *   --click @eN | --press K commit verb: one gate POST
 *   --expect "claim"        verify the last commit: one verify POST
 *   --verify-module NAME    step-verify (default) | login-verify
 *   --allow-host H          repeatable; empty = no host check
 *   --tape PATH             JSONL answer tape (default runs/vibium-tape.jsonl)
 *   --replay                answer only from the tape; never calls TypeSafe
 *   --approve-escalate      you, the operator, answer "compose" to an escalate or a C10 park (the model's
 *                           answers are printed first); without it a parked step stays parked
 *   --llm-fallback          when Jev escalates, ask vibium check (the text model) before any person;
 *                           --provider / --model pass through (default xai / grok-4.6)
 *   --screenshots DIR       vibium screenshot after every step, DIR/<n>-<verb>.png
 *   --corpus PATH           append every snapshot as a state for JEV-works measure-confidence
 *   --headless --session S --bin PATH --stop
 *
 * Exit 0: last verdict true. Exit 2: escalate / human / refuse / refused-host. Exit 1: error or missing key.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { systemOne } from "../src/typesafe/client.ts";
import { loadPack } from "../src/vibium/pack.ts";
import { step, type Action, type StepResult } from "../src/vibium/step.ts";
import { Tape, tapedJudge, type Judge } from "../src/vibium/tape.ts";
import { ensureDaemon, vibium } from "../src/vibium/cli.ts";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const opts = (name: string): string[] => argv.flatMap((a, i) => (a === name ? [argv[i + 1]!] : []));

const replay = flag("--replay");
if (!replay && !process.env.TYPESAFE_API_KEY) {
  console.error("TYPESAFE_API_KEY is not set. Copy .env.example → .env on this machine, or pass --replay with a tape.");
  process.exit(1);
}

const ROOT = new URL("../", import.meta.url).pathname;
const gatePack = loadPack(`${ROOT}packs/browser.action-gate.json`);
const verifyPack = loadPack(`${ROOT}packs/browser.step-verify.json`);
const tapePath = opt("--tape") ?? `${ROOT}runs/vibium-tape.jsonl`;
mkdirSync(dirname(tapePath), { recursive: true });
const tape = new Tape(tapePath);
const stats = { posts: 0, replays: 0 };
const live: Judge = (req) => systemOne(req);
const replayOnly = tape.replayJudge();
const judge: Judge = replay
  ? async (req) => {
      const res = await replayOnly(req);
      stats.replays++;
      return res;
    }
  : async (req) => {
      const isGate = "mutatesWorld" in req.questions;
      return tapedJudge(live, tape, stats, isGate ? { pack: gatePack.name, module: "action-gate" } : { pack: verifyPack.name, module: opt("--verify-module") ?? "step-verify" })(req);
    };

const actions: Action[] = [];
const url = opt("--url");
if (url) actions.push({ verb: "go", args: [url] });
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--fill") actions.push({ verb: "fill", args: [argv[i + 1]!, argv[i + 2]!] });
  if (argv[i] === "--click") actions.push({ verb: "click", args: [argv[i + 1]!] });
  if (argv[i] === "--press") actions.push({ verb: "press", args: [argv[i + 1]!] });
}
const expect = opt("--expect");
if (expect) {
  const last = [...actions].reverse().find((a) => a.verb === "click" || a.verb === "press");
  if (!last) {
    console.error("--expect needs a --click or --press to verify");
    process.exit(1);
  }
  last.expect = expect;
}
if (!actions.length) {
  console.error("nothing to do: give --url and/or --fill/--click/--press");
  process.exit(1);
}

const vopts = { bin: opt("--bin"), session: opt("--session"), headless: flag("--headless") };
const corpusPath = opt("--corpus");
const corpus: unknown[] = corpusPath && existsSync(corpusPath) ? (JSON.parse(readFileSync(corpusPath, "utf8")) as unknown[]) : [];

const provider = opt("--provider") ?? "xai";
const model = opt("--model") ?? "grok-4.6";
const llmFallback = flag("--llm-fallback")
  ? async ({ kind, claim }: { kind: "gate" | "verify"; claim: string }) => {
      // Verify only. `vibium check` answers claims about page state; asked whether a click would be safe it
      // investigates for its whole 3-minute budget and times out (measured 2026-09-28: 180 s, no verdict).
      // A gate escalate goes to policy or a person instead.
      if (kind === "gate") return { verdict: "escalate" as const, ms: 0, summary: "gate fallback is policy or a person, not the model" };
      const t = performance.now();
      try {
        const r = await vibium<{ status: string; summary?: string }>(["check", "--provider", provider, "--model", model, "--reasoning-effort", "", claim], { ...vopts, timeoutMs: 300_000 });
        const verdict = r.status === "passed" ? true : r.status === "failed" ? false : ("escalate" as const);
        const out = { verdict, ms: Math.round(performance.now() - t), summary: r.summary?.slice(0, 200) };
        console.log(JSON.stringify({ llmFallback: kind, ...out }));
        return out;
      } catch (e) {
        const out = { verdict: "escalate" as const, ms: Math.round(performance.now() - t), summary: `error: ${String((e as Error).message).slice(0, 160)}` };
        console.log(JSON.stringify({ llmFallback: kind, ...out }));
        return out;
      }
    }
  : undefined;
const shotDir = opt("--screenshots");
if (shotDir) mkdirSync(shotDir, { recursive: true });
let shotN = 0;

let last: StepResult | undefined;
const t0 = performance.now();
const tLaunch = performance.now();
const daemon = await ensureDaemon(vopts);
console.log(JSON.stringify({ daemon: daemon.started ? "started" : "reused", headless: vopts.headless, ms: Math.round(performance.now() - tLaunch) }));
try {
  for (const a of actions) {
    last = await step(a, {
      vibium: vopts,
      judge,
      gatePack,
      verifyPack,
      verifyModule: opt("--verify-module") ?? "step-verify",
      policy: { allowHosts: opts("--allow-host") },
      llmFallback,
      humanVerdict: flag("--approve-escalate")
        ? ({ route, target, answers }) => {
            console.log(JSON.stringify({ humanVerdict: "compose", on: route, target, answers }));
            return "compose";
          }
        : undefined,
    });
    const line = {
      action: `${a.verb} ${a.args.map((x, i) => (a.verb === "fill" && i === 1 ? `<value:${x.length}>` : x)).join(" ")}`.trim(),
      route: last.route,
      gate: last.gate?.decided.verdict,
      verify: last.verify?.decided.verdict,
      judgeCalls: last.judgeCalls,
      llm: last.llm?.map((l) => ({ kind: l.kind, verdict: l.verdict, ms: l.ms })),
      ms: last.ms,
    };
    console.log(JSON.stringify(line));
    if (shotDir) {
      const file = `${shotDir}/${String(++shotN).padStart(2, "0")}-${a.verb}.png`;
      await vibium(["screenshot", "-o", file], vopts).catch(() => undefined);
    }
    if (corpusPath) {
      if (last.before) corpus.push({ ...last.before, action: line.action, phase: "before" });
      if (last.after) corpus.push({ ...last.after, action: line.action, phase: "after", claim: a.expect });
    }
    if (!["auto", "auto-llm", "human-compose", "nav", "tab-edit", "read"].includes(last.route)) break;
  }
} finally {
  if (corpusPath) writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
  if (flag("--stop")) await vibium(["daemon", "stop"], vopts).catch(() => undefined);
}

const totalMs = Math.round(performance.now() - t0);
const summary = { steps: actions.length, posts: stats.posts, replays: stats.replays, tape: tapePath, tapeSize: tape.size, totalMs, model: "jev-1.13.0" };
console.log(JSON.stringify(summary));
if (last?.gate) console.log("gate answers:", JSON.stringify(last.gate.answers));
if (last?.verify) console.log("verify answers:", JSON.stringify(last.verify.answers));

const finalVerdict = last?.verify?.decided.verdict ?? (["auto", "auto-llm", "human-compose", "nav", "tab-edit"].includes(last?.route ?? "") ? true : undefined);
process.exit(finalVerdict === true ? 0 : 2);
