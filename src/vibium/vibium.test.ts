/**
 * Twins for the Vibium surface. No browser, no key: the binary is fixtures/vibium/fake-vibium.mjs
 * and the judge is a scripted answer map. What is asserted is the loop's shape and its POST budget.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { excerpt, labelDiff, mapLabels, parseMap, resolveRef } from "./cli.ts";
import { checkDecision, decide, normEntropy, type Decision } from "./decide.ts";
import { buildRequest, loadPack, PackError, trimState } from "./pack.ts";
import { Tape, tapedJudge, type Judge } from "./tape.ts";
import { classify, describeAction, step, type Action, type StepContext } from "./step.ts";
import type { SystemOneRequest, SystemOneResponse, TypesafeAnswer } from "../typesafe/contract.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const FIX = join(ROOT, "fixtures/vibium");
const snap = (name: string) => JSON.parse(readFileSync(join(FIX, `${name}.json`), "utf8"));

// ------------------------------------------------------------------ cli: parsing is code

test("parseMap reads the real map format and labelDiff ignores ref numbering", () => {
  const before = snap("login-page").map as string;
  const after = snap("login-success").map as string;
  const lines = parseMap(before);
  assert.equal(lines.length, 4);
  assert.deepEqual(lines[2], { ref: "@e3", tag: 'button type="submit"', label: '"Login"', raw: '@e3 [button type="submit"] "Login"' });
  const d = labelDiff(before, after);
  assert.deepEqual(d.removed.sort(), ['[button type="submit"] "Login"', '[input type="password"] name="password"', '[input type="text"] name="username"'].sort());
  assert.deepEqual(d.added.sort(), ['[a] "Logout"', '[a] "×"'].sort());
  assert.equal(d.unchanged, 1); // Elemental Selenium link survives on both pages
  // The failed login inserts one flash-close link and re-numbers every ref: positional diff shows 9 changes, ours shows 1.
  const fail = labelDiff(before, snap("login-fail").map as string);
  assert.deepEqual(fail, { added: ['[a] "×"'], removed: [], unchanged: 4 });
  assert.equal(mapLabels("").length, 0);
  assert.equal(resolveRef(before, "@e9"), null);
  assert.equal(excerpt("a  b\n\n\n\nc", 3), "a b…");
});

// ------------------------------------------------------------------ decide: the kit's semantics

const noul = (p: number): TypesafeAnswer => ({ type: "noul", noul: p });
const choice = (c: string, probabilities: Record<string, number>): TypesafeAnswer => ({ type: "choice", choice: c, probabilities, confidence: Math.max(...Object.values(probabilities)) });

test("decide fires only at confident ends, skips unknown leaves, and validates rules statically", () => {
  const d: Decision = {
    positive: "x",
    rules: [
      { when: { q: "a", is: "yes" }, then: true },
      { when: { all: [{ q: "a", is: "no" }, { q: "missing", is: "no" }] }, then: false },
      { when: { q: "c", choiceIn: ["bad"] }, then: false },
    ],
    default: "escalate",
  };
  assert.deepEqual(decide({ a: noul(0.9) }, d), { verdict: true, rule: 0 });
  assert.deepEqual(decide({ a: noul(0.5) }, d), { verdict: "escalate", rule: "default" }); // mid-band is a coin flip
  assert.deepEqual(decide({ a: noul(0.05) }, d), { verdict: "escalate", rule: "default" }); // rule 1 has an unknown leaf → skipped
  assert.deepEqual(decide({ a: noul(0.5), c: choice("bad", { bad: 0.9, ok: 0.1 }) }, d), { verdict: false, rule: 2 });
  assert.ok(normEntropy({ a: 0.5, b: 0.5 }) > 0.99 && normEntropy({ a: 1, b: 0 }) === 0);
  assert.deepEqual(checkDecision(d, new Set(["a", "c"])), ['compose references unknown question "missing"']);
  assert.match(checkDecision({ positive: "x", thresholds: { yes: 0.5, no: 0.45 }, rules: [], default: true }, new Set()).join(), /noise floor/);
});

// ------------------------------------------------------------------ packs: shape before send

test("both vendored packs load, build valid pinned requests, and reject undeclared state", () => {
  const gate = loadPack(join(ROOT, "packs/browser.action-gate.json"));
  const verify = loadPack(join(ROOT, "packs/browser.step-verify.json"));
  const req = buildRequest(gate, "action-gate", { url: "https://x", title: "t", action: "click @e3", target: '@e3 [button] "Login"', textExcerpt: "…" });
  assert.equal(req.model, "jev-1.13.0");
  assert.deepEqual(Object.keys(req.questions).sort(), ["blastRadius", "mutatesWorld", "reversible", "spendsOrSends"]);
  assert.equal("polarity" in (req.questions.mutatesWorld as object), false); // annotations never reach the wire
  assert.equal(verify.modules.map((m) => m.name).join(","), "step-verify,login-verify");
  assert.throws(() => trimState(gate, { url: "u", password: "hunter2" }), (e: unknown) => e instanceof PackError && /undeclared fields: password/.test(e.message));
  assert.throws(
    () => loadPack(join(FIX, "bad-pack.json")),
    (e: unknown) => e instanceof PackError && e.problems.some((p) => /escapeOption/.test(p)) && e.problems.some((p) => /question mark/.test(p)),
  );
});

// ------------------------------------------------------------------ step: the loop and its POST budget

function scripted(script: Record<string, TypesafeAnswer>[]): { judge: Judge; seen: SystemOneRequest[] } {
  const seen: SystemOneRequest[] = [];
  let i = 0;
  const judge: Judge = async (req) => {
    seen.push(req);
    const answers = script[Math.min(i++, script.length - 1)]!;
    const res: SystemOneResponse = { model: "jev-1.13.0", answers, usage: { input_tokens: 1, output_tokens: 1 } };
    return res;
  };
  return { judge, seen };
}

function fakeBrowser(scenario: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "jev-vibium-"));
  writeFileSync(join(dir, "scenario.json"), JSON.stringify(scenario.map(snap)));
  const log = join(dir, "calls.jsonl");
  const env = { ...process.env, FAKE_VIBIUM_SCENARIO: join(dir, "scenario.json"), FAKE_VIBIUM_CURSOR: join(dir, "cursor"), FAKE_VIBIUM_LOG: log };
  const calls = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]);
  return { vibium: { bin: process.execPath, env, session: "t" }, calls, dir };
}

const packs = () => ({ gatePack: loadPack(join(ROOT, "packs/browser.action-gate.json")), verifyPack: loadPack(join(ROOT, "packs/browser.step-verify.json")) });

// node runs the .mjs when given as the first arg; VibiumOpts.bin is the node binary, so prepend the script via env.
function ctxFor(fb: ReturnType<typeof fakeBrowser>, judge: Judge, extra: Partial<StepContext> = {}): StepContext {
  return { ...packs(), judge, vibium: { ...fb.vibium, bin: join(FIX, "fake-vibium.mjs") }, ...extra };
}

test("a read verb makes no snapshot and no POST", async () => {
  const fb = fakeBrowser(["login-page"]);
  const { judge, seen } = scripted([]);
  const r = await step({ verb: "text", args: [] }, ctxFor(fb, judge));
  assert.equal(r.route, "read");
  assert.equal(r.acted, true);
  assert.equal(seen.length, 0);
  assert.deepEqual(fb.calls().map((c) => c[0]), ["text"]);
});

test("a full login is go + two tab edits + one gated click + one verify: exactly two POSTs", async () => {
  const fb = fakeBrowser(["example-home", "login-page", "login-page", "login-page", "login-success"]);
  const { judge, seen } = scripted([
    { mutatesWorld: noul(0.95), reversible: noul(0.9), spendsOrSends: noul(0.02), blastRadius: { type: "score", score: 1, legend: {}, probabilities: {}, confidence: 0.9 } },
    { signedInSignsShown: noul(0.97), loginFormGone: noul(0.96), credentialErrorShown: noul(0.02), interstitial: choice("none", { none: 0.98, captcha: 0.01, one_time_code: 0.01 }) },
  ]);
  const ctx = ctxFor(fb, judge, { verifyModule: "login-verify", policy: { allowHosts: ["the-internet.herokuapp.com", "example.com"] } });
  const steps: Action[] = [
    { verb: "go", args: ["https://the-internet.herokuapp.com/login"] },
    { verb: "fill", args: ["@e1", "tomsmith"] },
    // The demo site prints its own password in the page text, so the leak check types a value that is NOT on the page.
    { verb: "fill", args: ["@e2", "typed-secret-9f3k-not-on-page"] },
    { verb: "click", args: ["@e3"], expect: "the user is signed in and sees the secure area" },
  ];
  const results = [];
  for (const a of steps) results.push(await step(a, ctx));
  assert.deepEqual(results.map((r) => r.route), ["nav", "tab-edit", "tab-edit", "auto"]);
  assert.equal(results.reduce((n, r) => n + r.judgeCalls, 0), 2);
  assert.equal(seen.length, 2);
  // The gate saw the button, not the password.
  const gateState = seen[0]!.state as Record<string, string>;
  assert.equal(gateState.action, "click @e3");
  assert.equal(gateState.target, '@e3 [button type="submit"] "Login"');
  assert.equal(JSON.stringify(seen).includes("typed-secret-9f3k"), false);
  // The verify pack read a code-computed diff and a code-computed urlChanged.
  const v = seen[1]!.state as Record<string, unknown>;
  assert.equal(v.urlChanged, "yes");
  assert.equal(v.afterUrl, "https://the-internet.herokuapp.com/secure");
  assert.deepEqual((v.labelsRemoved as string[]).length, 3);
  assert.equal(results[3]!.verify?.decided.verdict, true);
});

test("a typed password is redacted even when the verb is gated", () => {
  assert.equal(describeAction({ verb: "fill", args: ["@e2", "hunter2"] }, '@e2 [input type="password"] name="password"'), "fill @e2 <redacted>");
  assert.equal(describeAction({ verb: "type", args: ["@e1", "tomsmith"] }, '@e1 [input type="text"] name="username"'), "type @e1 <value:8 chars>");
  assert.equal(classify("press", ["Enter"]), "commit");
  assert.equal(classify("press", ["Tab"]), "tab-edit");
  assert.equal(classify("cookies", []), "read");
  assert.equal(classify("cookies", ["sid", "x"]), "commit");
});

test("C10: a pay/send/delete target parks for a human before any POST; a refused gate does not act", async () => {
  const fb = fakeBrowser(["checkout"]);
  const { judge, seen } = scripted([{ mutatesWorld: noul(0.99), reversible: noul(0.01), spendsOrSends: noul(0.99), blastRadius: { type: "score", score: 3, legend: {}, probabilities: {}, confidence: 0.9 } }]);
  const ctx = ctxFor(fb, judge);
  const parked = await step({ verb: "click", args: ["@e2"] }, ctx); // "Place order"
  assert.equal(parked.route, "human");
  assert.equal(parked.acted, false);
  assert.equal(seen.length, 0);
  const refused = await step({ verb: "click", args: ["@e1"] }, ctx); // "Apply coupon": judge says spends & irreversible
  assert.equal(refused.route, "refuse");
  assert.equal(refused.acted, false);
  assert.equal(seen.length, 1);
  assert.equal(fb.calls().some((c) => c[0] === "click"), false);
});

test("mid-band answers escalate and do not act; a stale ref throws before any POST", async () => {
  const fb = fakeBrowser(["login-page", "login-fail"]);
  const { judge, seen } = scripted([{ mutatesWorld: noul(0.5), reversible: noul(0.5), spendsOrSends: noul(0.1), blastRadius: { type: "score", score: 1, legend: {}, probabilities: {}, confidence: 0.5 } }]);
  const ctx = ctxFor(fb, judge);
  const r = await step({ verb: "click", args: ["@e3"] }, ctx);
  assert.equal(r.route, "escalate");
  assert.equal(r.acted, false);
  await assert.rejects(step({ verb: "click", args: ["@e42"] }, ctx), /stale ref @e42/);
  assert.equal(seen.length, 1);
});

test("host policy refuses navigation and commits off the allowlist without a POST", async () => {
  const fb = fakeBrowser(["login-page"]);
  const { judge, seen } = scripted([]);
  const ctx = ctxFor(fb, judge, { policy: { allowHosts: ["example.com"] } });
  assert.equal((await step({ verb: "go", args: ["https://evil.test/"] }, ctx)).route, "refused-host");
  assert.equal((await step({ verb: "click", args: ["@e3"] }, ctx)).route, "refused-host");
  assert.equal(seen.length, 0);
});

test("tape: the second identical step replays from record with zero POSTs; a replay-only judge refuses a miss", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jev-tape-"));
  const tape = new Tape(join(dir, "tape.jsonl"));
  const stats = { posts: 0, replays: 0 };
  const { judge: live, seen } = scripted([{ mutatesWorld: noul(0.02), reversible: noul(0.9), spendsOrSends: noul(0.01), blastRadius: { type: "score", score: 0, legend: {}, probabilities: {}, confidence: 0.9 } }]);
  const taped = tapedJudge(live, tape, stats, { pack: "browser.action-gate", module: "action-gate" });
  const req = buildRequest(packs().gatePack, "action-gate", { url: "https://example.com/", title: "Example Domain", action: "click @e1", target: '@e1 [a] "Learn more"', textExcerpt: "Example Domain" });
  await taped(req);
  await taped(req);
  assert.deepEqual(stats, { posts: 1, replays: 1 });
  assert.equal(seen.length, 1);
  const reloaded = new Tape(join(dir, "tape.jsonl"));
  assert.equal(reloaded.size, 1);
  assert.equal((await reloaded.replayJudge()(req)).answers.mutatesWorld?.type, "noul");
  const other = { ...req, state: { ...(req.state as object), title: "changed" } };
  await assert.rejects(reloaded.replayJudge()(other), /replay does not call TypeSafe/);
});
