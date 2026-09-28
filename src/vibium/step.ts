/**
 * One typed browser step: code first, one gate POST only for a commit verb, act, one verify POST only
 * when the step declares what it expects. Apply last. Fail closed.
 *
 *   step(action):
 *     before = snapshot()                                   code, ~4 vibium reads
 *     path 0  read verb → act, no POST
 *             tab-edit verb (fill/select/check…) → act, no POST   (nothing leaves the tab until a commit)
 *             nav verb → host allowlist in code → act
 *             commit verb on a C10 target (pay/send/delete…) → park for a human, no POST, no act
 *     path 1  commit verb → ONE gate POST (browser.action-gate) → auto | refuse | escalate
 *     act
 *     verify  expect given → after = snapshot(); labelDiff in code; ONE verify POST (browser.step-verify)
 *
 * Acceptance (SPEC-v1-SPEED): an applied step makes ≤ 2 POSTs; replay makes 0; read-only turns make 0.
 */
import { excerpt, hostOf, labelDiff, resolveRef, snapshot, vibium, type LabelDiff, type Snapshot, type VibiumOpts } from "./cli.ts";
import { decide, type Decided } from "./decide.ts";
import { buildRequest, moduleOf, type Pack } from "./pack.ts";
import type { Judge } from "./tape.ts";
import type { TypesafeAnswer } from "../typesafe/contract.ts";

export const READ_VERBS = new Set([
  "map", "text", "url", "title", "screenshot", "html", "find", "count", "a11y-tree", "is", "value", "attr",
  "frames", "frame", "diff", "wait", "pages", "viewport", "window", "sleep", "highlight", "pdf",
]);
/** Edits that stay inside the tab until a commit verb sends them anywhere. */
export const TAB_EDIT_VERBS = new Set(["fill", "type", "select", "set", "unset", "check", "uncheck", "focus", "hover", "scroll", "press-tab"]);
export const NAV_VERBS = new Set(["go", "back", "forward", "reload"]);
/** Everything else commits: click, dblclick, press, keys, upload, drag, eval, dialog, content, cookies, storage, mouse. */

export type VerbClass = "read" | "tab-edit" | "nav" | "commit";

export function classify(verb: string, args: string[]): VerbClass {
  if (verb === "cookies" && args.length) return "commit";
  if (verb === "storage" && args[0] === "restore") return "commit";
  if (verb === "press" && args[0] === "Tab") return "tab-edit";
  if (READ_VERBS.has(verb) || (verb === "cookies" && !args.length) || (verb === "storage" && !args.length)) return "read";
  if (TAB_EDIT_VERBS.has(verb)) return "tab-edit";
  if (NAV_VERBS.has(verb)) return "nav";
  return "commit";
}

export interface Action {
  verb: string;
  args: string[];
  /** A literal, observable claim about the page after the action. Triggers the verify POST. */
  expect?: string;
}

export interface Policy {
  /** Hosts a nav verb may open and a commit verb may run on. Empty = no host check (dev only). */
  allowHosts: string[];
  /** C10: targets whose label matches never run without a human verdict, whatever the judge says. */
  humanGate: RegExp;
  textExcerptChars: number;
}

export const DEFAULT_POLICY: Policy = {
  allowHosts: [],
  humanGate: /\b(pay|purchase|checkout|place order|buy now|send|delete|remove|transfer|confirm payment|unsubscribe|submit payment)\b/i,
  textExcerptChars: 1500,
};

export interface StepContext {
  vibium?: VibiumOpts;
  judge: Judge;
  gatePack: Pack;
  verifyPack: Pack;
  gateModule?: string;
  verifyModule?: string;
  policy?: Partial<Policy>;
}

export type Route = "read" | "tab-edit" | "nav" | "human" | "refused-host" | "auto" | "refuse" | "escalate";

export interface JudgedStage {
  decided: Decided;
  answers: Record<string, TypesafeAnswer>;
  ms: number;
}

export interface StepResult {
  action: Action;
  verbClass: VerbClass;
  route: Route;
  acted: boolean;
  before?: Snapshot;
  after?: Snapshot;
  target?: string;
  gate?: JudgedStage;
  diff?: LabelDiff;
  verify?: JudgedStage;
  /** POSTs this step *asked for*; the tape may have answered some from record (see JudgeStats). */
  judgeCalls: number;
  ms: { snapshot: number; gate: number; act: number; verify: number; total: number };
}

const REDACT_VERBS = new Set(["fill", "type"]);

/** What the judge is told about the action. Typed values are never sent; a password field never leaks. */
export function describeAction(a: Action, targetLine: string | null): string {
  const args = [...a.args];
  if (REDACT_VERBS.has(a.verb) && args.length >= 2) {
    args[args.length - 1] = `<value:${args[args.length - 1]!.length} chars>`;
  }
  if (targetLine && /type="password"/.test(targetLine)) {
    return `${a.verb} ${args[0] ?? ""} <redacted>`.trim();
  }
  return `${a.verb} ${args.join(" ")}`.trim();
}

function hostAllowed(policy: Policy, url: string | null): boolean {
  if (!policy.allowHosts.length) return true;
  const h = url ? hostOf(url) : null;
  return !!h && policy.allowHosts.some((a) => h === a || h.endsWith(`.${a}`));
}

async function judged(ctx: StepContext, pack: Pack, moduleName: string, state: Record<string, unknown>): Promise<JudgedStage> {
  const req = buildRequest(pack, moduleName, state);
  const t0 = performance.now();
  const res = await ctx.judge(req);
  const ms = Math.round(performance.now() - t0);
  const m = moduleOf(pack, moduleName);
  return { decided: decide(res.answers, m.compose), answers: res.answers, ms };
}

export async function step(action: Action, ctx: StepContext): Promise<StepResult> {
  const policy: Policy = { ...DEFAULT_POLICY, ...(ctx.policy ?? {}) };
  const verbClass = classify(action.verb, action.args);
  const t0 = performance.now();
  const ms = { snapshot: 0, gate: 0, act: 0, verify: 0, total: 0 };
  const result: StepResult = { action, verbClass, route: "read", acted: false, judgeCalls: 0, ms };
  const finish = () => {
    ms.total = Math.round(performance.now() - t0);
    return result;
  };
  const act = async () => {
    const ta = performance.now();
    await vibium([action.verb, ...action.args], ctx.vibium);
    ms.act = Math.round(performance.now() - ta);
    result.acted = true;
  };

  // Path 0: a read never costs a snapshot, a POST, or a policy check.
  if (verbClass === "read") {
    await act();
    return finish();
  }

  // `go` without an expectation needs no page snapshot: the page it leaves is not evidence for anything.
  if (verbClass === "nav" && action.verb === "go" && !action.expect) {
    if (!hostAllowed(policy, action.args[0] ?? null)) {
      result.route = "refused-host";
      return finish();
    }
    result.route = "nav";
    await act();
    return finish();
  }

  const ts = performance.now();
  const before = await snapshot(ctx.vibium);
  ms.snapshot = Math.round(performance.now() - ts);
  result.before = before;

  if (verbClass === "nav") {
    const dest = action.verb === "go" ? action.args[0] ?? null : before.url;
    if (!hostAllowed(policy, dest)) {
      result.route = "refused-host";
      return finish();
    }
    result.route = "nav";
    await act();
  } else if (verbClass === "tab-edit") {
    result.route = "tab-edit";
    await act();
  } else {
    // commit verb
    const ref = action.args.find((a) => /^@e\d+$/.test(a));
    const line = ref ? resolveRef(before.map, ref) : null;
    if (ref && !line) {
      // A stale ref is a code failure, not a judge question: re-map and retry upstream.
      throw new Error(`stale ref ${ref}: not in the current map; re-map before acting`);
    }
    const target = line?.raw ?? action.args.join(" ");
    result.target = target;
    if (!hostAllowed(policy, before.url)) {
      result.route = "refused-host";
      return finish();
    }
    if (policy.humanGate.test(target) || policy.humanGate.test(action.args.join(" "))) {
      result.route = "human"; // C10: parks even before the judge is asked
      return finish();
    }
    result.judgeCalls++;
    result.gate = await judged(ctx, ctx.gatePack, ctx.gateModule ?? ctx.gatePack.modules[0]!.name, {
      url: before.url,
      title: before.title,
      action: describeAction(action, line?.raw ?? null),
      target,
      textExcerpt: excerpt(before.text, policy.textExcerptChars),
    });
    ms.gate = result.gate.ms;
    const v = result.gate.decided.verdict;
    result.route = v === true ? "auto" : v === false ? "refuse" : "escalate";
    if (v !== true) return finish();
    await act();
  }

  if (!action.expect) return finish();

  const tv = performance.now();
  const after = await snapshot(ctx.vibium);
  result.after = after;
  result.diff = labelDiff(before.map, after.map);
  result.judgeCalls++;
  result.verify = await judged(ctx, ctx.verifyPack, ctx.verifyModule ?? ctx.verifyPack.modules[0]!.name, {
    claim: action.expect,
    beforeUrl: before.url,
    afterUrl: after.url,
    urlChanged: after.url !== before.url ? "yes" : "no",
    title: after.title,
    textExcerpt: excerpt(after.text, policy.textExcerptChars),
    labelsAdded: result.diff.added,
    labelsRemoved: result.diff.removed,
  });
  ms.verify = Math.round(performance.now() - tv);
  return finish();
}
