/**
 * Vibium CLI shim. Every call is `vibium --json [--session s] <verb> <args>`; the envelope is
 * `{ ok, result }` or `{ ok: false, error }`. Code owns everything here: parsing the map, the
 * label diff, the excerpt. None of it is a model question.
 *
 * Reference build: HermeticOrmus/vibium feat/linear-tasks (v26.8.21). `map` lines look like
 *   @e1 [input type="text"] name="username"
 *   @e3 [button type="submit"] "Login"
 * and `diff map` is positional (+/- by ref), so a single inserted element re-numbers every ref.
 * That is why labelDiff() below ignores ref numbers.
 */
import { execFile } from "node:child_process";

export interface VibiumEnvelope<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
}

export interface VibiumOpts {
  /** Path to the vibium binary. Default: $VIBIUM_BIN, then `vibium` on PATH. */
  bin?: string;
  /** Named daemon session (--session). Default: $VIBIUM_SESSION or "jev-tape". */
  session?: string;
  /** Pass --headless on launching verbs. */
  headless?: boolean;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export class VibiumError extends Error {
  verb: string;
  constructor(verb: string, message: string) {
    super(`vibium ${verb}: ${message}`);
    this.name = "VibiumError";
    this.verb = verb;
  }
}

function run(bin: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { env, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      // vibium prints the JSON envelope on stdout even when ok:false and exits non-zero.
      if (stdout && stdout.trim().startsWith("{")) return resolve(stdout);
      if (err) return reject(new VibiumError(args.find((a) => !a.startsWith("--")) ?? "?", `${err.message} ${stderr}`.trim()));
      resolve(stdout);
    });
  });
}

/**
 * One vibium call. Throws VibiumError on `ok:false` or unparseable output.
 *
 * `--headless` is never passed here. The CLI forwards launch flags to the daemon as a `browser_start`
 * before every verb that carries them, and that call is not free once a browser is up. Launch options
 * belong to ensureDaemon(), once per session.
 */
export async function vibium<T = string>(args: string[], opts: VibiumOpts = {}): Promise<T> {
  const bin = opts.bin ?? process.env.VIBIUM_BIN ?? "vibium";
  const session = opts.session ?? process.env.VIBIUM_SESSION ?? "jev-tape";
  const full = ["--json", "--session", session, ...args];
  const out = await run(bin, full, opts.env ?? process.env, opts.timeoutMs ?? 120_000);
  let env: VibiumEnvelope<T>;
  try {
    env = JSON.parse(out) as VibiumEnvelope<T>;
  } catch {
    throw new VibiumError(args[0] ?? "?", `non-JSON output: ${out.slice(0, 200)}`);
  }
  if (!env.ok) throw new VibiumError(args[0] ?? "?", env.error ?? "unknown error");
  return env.result as T;
}

/**
 * Start the session's daemon once, with the launch options, if it is not already running.
 * Every later verb then reaches the same browser with no launch flags attached.
 */
export async function ensureDaemon(opts: VibiumOpts = {}): Promise<{ started: boolean }> {
  const status = await vibium<{ running?: boolean }>(["daemon", "status"], opts).catch(() => ({ running: false }));
  if (status && status.running) return { started: false };
  const bin = opts.bin ?? process.env.VIBIUM_BIN ?? "vibium";
  const session = opts.session ?? process.env.VIBIUM_SESSION ?? "jev-tape";
  const args = ["--json", "--session", session, ...(opts.headless ? ["--headless"] : []), "daemon", "start"];
  const out = await run(bin, args, opts.env ?? process.env, opts.timeoutMs ?? 120_000);
  const env = JSON.parse(out) as VibiumEnvelope;
  if (!env.ok) throw new VibiumError("daemon start", env.error ?? "unknown error");
  return { started: true };
}

/** What one page looks like to the tape: four reads, no model. */
export interface Snapshot {
  url: string;
  title: string;
  text: string;
  map: string;
  takenAt: string;
}

/**
 * Sequential on purpose: concurrent CLI calls against a cold daemon race to launch the browser, and
 * `map` must be the last read so the @refs it assigns are the ones the next verb uses.
 */
export async function snapshot(opts: VibiumOpts = {}): Promise<Snapshot> {
  const url = await vibium<string>(["url"], opts);
  const title = await vibium<string>(["title"], opts);
  const text = await vibium<string>(["text"], opts);
  const map = await vibium<string>(["map"], opts);
  return { url, title, text, map: map === "No interactive elements found" ? "" : map, takenAt: new Date().toISOString() };
}

export interface MapLine {
  ref: string;
  tag: string;
  label: string;
  raw: string;
}

const MAP_LINE = /^(@e\d+)\s+\[([^\]]*)\]\s*(.*)$/;

export function parseMap(map: string): MapLine[] {
  const out: MapLine[] = [];
  for (const line of map.split("\n")) {
    const m = MAP_LINE.exec(line.trim());
    if (m) out.push({ ref: m[1]!, tag: m[2]!, label: m[3]!.trim(), raw: line.trim() });
  }
  return out;
}

/** The map line without its ref number: what an element *is*, independent of ordering. */
export function mapLabels(map: string): string[] {
  return parseMap(map).map((l) => `[${l.tag}] ${l.label}`.trim());
}

export interface LabelDiff {
  added: string[];
  removed: string[];
  unchanged: number;
}

/** Multiset diff of element labels. Code, not Jev: "what changed" is arithmetic on two lists. */
export function labelDiff(beforeMap: string, afterMap: string): LabelDiff {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const b = count(mapLabels(beforeMap));
  const a = count(mapLabels(afterMap));
  const added: string[] = [];
  const removed: string[] = [];
  let unchanged = 0;
  for (const [k, n] of a) {
    const bn = b.get(k) ?? 0;
    for (let i = 0; i < n - bn; i++) added.push(k);
    unchanged += Math.min(n, bn);
  }
  for (const [k, n] of b) {
    const an = a.get(k) ?? 0;
    for (let i = 0; i < n - an; i++) removed.push(k);
  }
  return { added, removed, unchanged };
}

/** Resolve an @ref against a map. Returns the raw line, or null if the ref is stale. */
export function resolveRef(map: string, ref: string): MapLine | null {
  return parseMap(map).find((l) => l.ref === ref) ?? null;
}

/** First N characters of page text, whitespace-collapsed. State size is our cost (NETER P2). */
export function excerpt(text: string, max = 1500): string {
  const t = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Hostname without the port: allowlist entries are hosts, and a dev server on :8787 is still 127.0.0.1. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}
