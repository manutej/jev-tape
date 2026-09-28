/**
 * Activities: the only place IO happens. qualifyTask, qualifyOutput, applyCommand, typesafeJudge.
 *
 * TypeSafe is an Activity. Its result lands in Event History. Replay reuses it and never POSTs again.
 * Retry: 5xx / 429 / 529 → retryable. 401 / 422 / missing key / wrong model → non-retryable.
 */
import { ApplicationFailure, Context } from "@temporalio/activity";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Command } from "../domain.ts";
import { qualifyOutputWith, qualifyTaskWith, type Tape, type TapeEntry } from "../engine.ts";
import type { Judge } from "../judge.ts";
import type { Proposal, Verdict } from "../loop.ts";
export { NON_RETRYABLE } from "../loop.ts";
import { TypesafeError } from "../typesafe/client.ts";
import type { SystemOneRequest } from "../typesafe/contract.ts";


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
      const existing = await entries();
      if (existing.some((r) => r.key === entry.key)) return { applied: false, duplicate: true };
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, JSON.stringify(entry) + "\n");
      return { applied: true, duplicate: false };
    },
  };
}

/** One live observation from an Activity. The harness streams these; they are not the tape. */
export interface StepEvent {
  at: string;
  workflowId: string;
  runId: string;
  key: string;
  kind: "qualifyTask" | "qualifyOutput" | "applyCommand" | "recordEvent";
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
}

export function createActivities(deps: ActivityDeps) {
  let applies = 0;
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
  return {
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

    /** Waiting/Habit/Someday side events that are not commands: record on the tape, idempotent by key. */
    async recordEvent(key: string, event: string, payload: Record<string, unknown>) {
      const res = await deps.tape.append({ key, command: "-", event, payload, at: new Date().toISOString() });
      observe({ key, kind: "recordEvent", event, duplicate: res.duplicate, source: "code" });
      return res;
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
