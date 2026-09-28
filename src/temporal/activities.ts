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

export interface ActivityDeps {
  judge: Judge;
  tape: Tape;
  /** Test/demo hook: crash the worker process after N applies to show recovery. */
  crashAfterApplies?: number;
}

export function createActivities(deps: ActivityDeps) {
  let applies = 0;
  return {
    async typesafeJudge(req: SystemOneRequest) {
      try {
        return await deps.judge.ask(req);
      } catch (err) {
        toFailure(err);
      }
    },

    async qualifyTask(cmd: Command, _key: string): Promise<Verdict> {
      Context.current().heartbeat("qualifyTask");
      try {
        return await qualifyTaskWith(deps.judge, cmd);
      } catch (err) {
        toFailure(err);
      }
    },

    async qualifyOutput(cmd: Command, proposal: Proposal): Promise<Verdict> {
      Context.current().heartbeat("qualifyOutput");
      try {
        return await qualifyOutputWith(deps.judge, cmd, proposal);
      } catch (err) {
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
      if (deps.crashAfterApplies && applies >= deps.crashAfterApplies) {
        console.error(`[worker] simulated crash after ${applies} applies (pid ${process.pid})`);
        process.exit(137);
      }
      return res;
    },

    /** Waiting/Habit/Someday side events that are not commands: record on the tape, idempotent by key. */
    async recordEvent(key: string, event: string, payload: Record<string, unknown>) {
      return deps.tape.append({ key, command: "-", event, payload, at: new Date().toISOString() });
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
