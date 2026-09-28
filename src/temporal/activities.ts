/**
 * Activities: the only place IO happens. qualifyTask, qualifyOutput, applyCommand, typesafeJudge.
 *
 * TypeSafe is an Activity. Its result lands in Event History. Replay reuses it and never POSTs again.
 * Retry: 5xx / 429 / 529 → retryable. 401 / 422 / missing key / wrong model → non-retryable.
 */
import { ApplicationFailure, Context } from "@temporalio/activity";
import { appendFile, mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Command } from "../domain.ts";
import { qualifyOutputWith, qualifyTaskWith, type Tape, type TapeEntry } from "../engine.ts";
import type { Judge } from "../judge.ts";
import type { Proposal, Verdict } from "../loop.ts";
export { NON_RETRYABLE } from "../loop.ts";
import { TypesafeError } from "../typesafe/client.ts";
import type { SystemOneRequest } from "../typesafe/contract.ts";
import { CODECS, SURFACE_TOOLS, type Page, type Surface } from "../surfaces/codec.ts";
import { connectMcp, mcpTargetFromEnv, type McpSession, type McpTarget } from "../surfaces/mcp.ts";


function toFailure(err: unknown): never {
  if (err instanceof TypesafeError) {
    throw ApplicationFailure.create({
      type: err.nonRetryable ? "TypesafeNonRetryable" : "TypesafeRetryable",
      nonRetryable: err.nonRetryable,
      message: err.message,
      details: [{ status: err.status }],
    });
  }
  throw err;
}

/**
 * Append-only JSONL projection with a unique idempotency key per row.
 * At scale this is a table with a unique index on `key`; the contract is the same: a duplicate apply is a no-op.
 */
export function fileTape(path: string): Tape {
  // In-memory key index + byte offset of what has been indexed. On every append the unread tail is scanned first,
  // so a retry that lands on another worker process still sees that process's writes. O(new bytes), not O(file).
  const keys = new Set<string>();
  const threadIds = new Set<string>();
  let offset = 0;
  let remainder = "";
  const indexRow = (line: string) => {
    if (!line) return;
    try {
      const r = JSON.parse(line) as TapeEntry;
      keys.add(r.key);
      const t = (r.payload as Record<string, unknown>)?.threadId;
      if (t) threadIds.add(String(t));
    } catch {
      /* a torn last line is re-read on the next tail scan */
    }
  };
  const scanTail = async () => {
    let fh;
    try {
      fh = await open(path, "r");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    try {
      const size = (await fh.stat()).size;
      if (size <= offset) return;
      const buf = Buffer.alloc(size - offset);
      await fh.read(buf, 0, buf.length, offset);
      offset = size;
      const text = remainder + buf.toString("utf8");
      const lines = text.split("\n");
      remainder = lines.pop() ?? "";
      for (const l of lines) indexRow(l);
    } finally {
      await fh.close();
    }
  };
  const entries = async (): Promise<TapeEntry[]> => {
    try {
      const raw = await readFile(path, "utf8");
      return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as TapeEntry);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  };
  return {
    entries,
    async append(entry) {
      await scanTail();
      if (keys.has(entry.key)) return { applied: false, duplicate: true };
      await mkdir(dirname(path), { recursive: true });
      const line = JSON.stringify(entry) + "\n";
      await appendFile(path, line);
      keys.add(entry.key);
      const t = (entry.payload as Record<string, unknown>)?.threadId;
      if (t) threadIds.add(String(t));
      offset += Buffer.byteLength(line);
      return { applied: true, duplicate: false };
    },
    async seenThreadIds(ids: string[]) {
      await scanTail();
      return ids.filter((id) => threadIds.has(id));
    },
  };
}

/** One live observation from an Activity. The harness streams these; they are not the tape. */
export interface StepEvent {
  at: string;
  workflowId: string;
  runId: string;
  key: string;
  kind: "qualifyTask" | "qualifyOutput" | "applyCommand" | "recordEvent" | "pullSurface";
  command?: string;
  light?: Verdict["light"];
  reasons?: string[];
  source?: string;
  model?: string;
  ms?: number;
  event?: string;
  duplicate?: boolean;
  attempt: number;
  pack?: string;
  oc?: Verdict["oc"];
}

export interface ActivityDeps {
  judge: Judge;
  tape: Tape;
  /** Test/demo hook: crash the worker process after N applies to show recovery. */
  crashAfterApplies?: number;
  /** Live observer. Called after each Activity completes. Never awaited, never affects the result. */
  onStep?: (e: StepEvent) => void;
  /** Where the connector is. Read from env by the worker; null means pullSurface fails closed. */
  mcp?: McpTarget | null;
}

/** Non-enumerable handle so the Worker does not register it as an activity. */
export const DISPOSE = Symbol.for("jev.dispose");

export function createActivities(deps: ActivityDeps) {
  let applies = 0;
  let mcp: Promise<McpSession> | undefined;
  const session = () => {
    const target = deps.mcp === undefined ? mcpTargetFromEnv() : deps.mcp;
    if (!target) throw ApplicationFailure.create({ type: "SurfaceUnconfigured", nonRetryable: true, message: "No MCP target: set JEV_MCP_COMMAND or JEV_MCP_URL on the worker. Fail closed." });
    mcp ??= connectMcp(target).catch((e) => { mcp = undefined; throw e; });
    return mcp;
  };
  const observe = (e: Omit<StepEvent, "at" | "workflowId" | "runId" | "attempt">) => {
    if (!deps.onStep) return;
    const info = Context.current().info;
    try {
      deps.onStep({
        at: new Date().toISOString(),
        workflowId: info.workflowExecution?.workflowId ?? "twin",
        runId: info.workflowExecution?.runId ?? "",
        attempt: info.attempt,
        ...e,
      });
    } catch {
      /* observers never break an Activity */
    }
  };
  const acts = {
    async typesafeJudge(req: SystemOneRequest) {
      try {
        return await deps.judge.ask(req);
      } catch (err) {
        toFailure(err);
      }
    },

    async qualifyTask(cmd: Command, key: string): Promise<Verdict> {
      Context.current().heartbeat("qualifyTask");
      try {
        const v = await qualifyTaskWith(deps.judge, cmd);
        observe({ key, kind: "qualifyTask", command: cmd.name, light: v.light, reasons: v.reasons, source: v.source, model: v.model, ms: v.ms, pack: v.pack, oc: v.oc });
        return v;
      } catch (err) {
        observe({ key, kind: "qualifyTask", command: cmd.name, light: "RED", reasons: [String((err as Error).message).slice(0, 200)], source: "none" });
        toFailure(err);
      }
    },

    async qualifyOutput(cmd: Command, proposal: Proposal): Promise<Verdict> {
      Context.current().heartbeat("qualifyOutput");
      try {
        const v = await qualifyOutputWith(deps.judge, cmd, proposal);
        observe({ key: proposal.idempotencyKey, kind: "qualifyOutput", command: cmd.name, light: v.light, reasons: v.reasons, source: v.source, model: v.model, ms: v.ms, event: proposal.event.name, pack: v.pack, oc: v.oc });
        return v;
      } catch (err) {
        observe({ key: proposal.idempotencyKey, kind: "qualifyOutput", command: cmd.name, light: "RED", reasons: [String((err as Error).message).slice(0, 200)], source: "none" });
        toFailure(err);
      }
    },

    async applyCommand(cmd: Command, proposal: Proposal): Promise<{ applied: boolean; duplicate: boolean }> {
      const info = Context.current().info;
      const res = await deps.tape.append({
        key: proposal.idempotencyKey,
        command: cmd.name,
        event: proposal.event.name,
        payload: { ...proposal.event.payload, workflowId: info.workflowExecution?.workflowId ?? "twin" },
        at: new Date().toISOString(),
      });
      applies += res.applied ? 1 : 0;
      observe({ key: proposal.idempotencyKey, kind: "applyCommand", command: cmd.name, light: "GREEN", event: proposal.event.name, duplicate: res.duplicate, source: "code" });
      if (deps.crashAfterApplies && applies >= deps.crashAfterApplies) {
        console.error(`[worker] simulated crash after ${applies} applies (pid ${process.pid})`);
        process.exit(137);
      }
      return res;
    },

    /**
     * Pull one page from a connector through MCP and map it to Capture commands in code. No model reads it.
     * The page lands in Event History, so a crash mid-ingest resumes from the recorded page, not from the connector.
     */
    async pullSurface(surface: Surface, query: string, pageSize: number, pageToken?: string): Promise<Page> {
      const spec = SURFACE_TOOLS[surface];
      const codec = CODECS[surface];
      if (!spec || !codec) throw ApplicationFailure.create({ type: "SurfaceUnknown", nonRetryable: true, message: `no codec for surface ${surface}` });
      Context.current().heartbeat(`pullSurface ${surface}`);
      const t0 = performance.now();
      const s = await session();
      const raw = await s.call(spec.tool, spec.args(query, pageSize, pageToken));
      const page = codec(raw);
      const ms = Math.round(performance.now() - t0);
      observe({ key: `${surface}:${pageToken ?? "0"}`, kind: "pullSurface", source: "mcp", ms, reasons: [`${surface}.${spec.tool}: ${page.commands.length} commands, ${page.skipped} skipped${page.nextPageToken ? ", more pages" : ", last page"}`] });
      return page;
    },

    /** Which of these threadIds are already on the tape. The ingest workflow drops them before starting lanes. */
    async seenThreadIds(ids: string[]): Promise<string[]> {
      if (deps.tape.seenThreadIds) return deps.tape.seenThreadIds(ids);
      const rows = await deps.tape.entries();
      const seen = new Set(rows.map((r) => String((r.payload as Record<string, unknown>).threadId ?? "")).filter(Boolean));
      return ids.filter((id) => seen.has(id));
    },

    /** Waiting/Habit/Someday side events that are not commands: record on the tape, idempotent by key. */
    async recordEvent(key: string, event: string, payload: Record<string, unknown>) {
      const res = await deps.tape.append({ key, command: "-", event, payload, at: new Date().toISOString() });
      observe({ key, kind: "recordEvent", event, duplicate: res.duplicate, source: "code" });
      return res;
    },
  };
  Object.defineProperty(acts, DISPOSE, {
    enumerable: false,
    value: async () => {
      const s = await mcp?.catch(() => undefined);
      mcp = undefined;
      await s?.close().catch(() => {});
    },
  });
  return acts;
}

/** Close anything the activities hold open (the MCP child process). Call on worker shutdown and in tests. */
export async function disposeActivities(acts: object): Promise<void> {
  const fn = (acts as Record<symbol, unknown>)[DISPOSE];
  if (typeof fn === "function") await (fn as () => Promise<void>)();
}

export type Activities = ReturnType<typeof createActivities>;
