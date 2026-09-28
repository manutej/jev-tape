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

/** One vibium call. Throws VibiumError on `ok:false` or unparseable output. */
export async function vibium<T = string>(args: string[], opts: VibiumOpts = {}): Promise<T> {
  const bin = opts.bin ?? process.env.VIBIUM_BIN ?? "vibium";
  const session = opts.session ?? process.env.VIBIUM_SESSION ?? "jev-tape";
  const full = ["--json", "--session", session, ...(opts.headless ? ["--headless"] : []), ...args];
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

/** What one page looks like to the tape: four reads, no model. */
export interface Snapshot {
  url: string;
  title: string;
  text: string;
  map: string;
  takenAt: string;
}

export async function snapshot(opts: VibiumOpts = {}): Promise<Snapshot> {
  const [url, title, text, map] = await Promise.all([
    vibium<string>(["url"], opts),
    vibium<string>(["title"], opts),
    vibium<string>(["text"], opts),
    vibium<string>(["map"], opts),
  ]);
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

export function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}
