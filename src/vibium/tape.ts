/**
 * The tape: every TypeSafe answer map, recorded once, keyed by what was asked of what.
 * Replay reads the tape and never calls TypeSafe again (SPEC-v1-TAPE §8, FIRE). JSONL, append-only.
 * In-process twin of the Temporal Activity record; Temporal is optional and not required here.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { SystemOneRequest, SystemOneResponse } from "../typesafe/contract.ts";

export type Judge = (req: SystemOneRequest) => Promise<SystemOneResponse>;

export interface TapeEntry {
  key: string;
  at: string;
  pack: string;
  module: string;
  request: SystemOneRequest;
  response: SystemOneResponse;
  ms: number;
}

export interface JudgeStats {
  posts: number;
  replays: number;
}

export function requestKey(req: SystemOneRequest): string {
  return createHash("sha256")
    .update(JSON.stringify({ model: req.model, state: req.state, questions: req.questions }))
    .digest("hex");
}

export class Tape {
  path: string | null;
  private entries = new Map<string, TapeEntry>();

  constructor(path: string | null = null) {
    this.path = path;
    if (path && existsSync(path)) {
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as TapeEntry;
        this.entries.set(e.key, e);
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }

  lookup(req: SystemOneRequest): TapeEntry | undefined {
    return this.entries.get(requestKey(req));
  }

  record(e: TapeEntry): void {
    this.entries.set(e.key, e);
    if (this.path) appendFileSync(this.path, `${JSON.stringify(e)}\n`);
  }

  /** Answers only from the tape. A miss is an error: replay must not invent or fetch a verdict. */
  replayJudge(): Judge {
    return async (req) => {
      const hit = this.lookup(req);
      if (!hit) throw new Error(`tape miss on replay (${requestKey(req).slice(0, 12)}): replay does not call TypeSafe`);
      return hit.response;
    };
  }
}

/**
 * Wrap a live judge: tape hit → recorded answer, 0 POSTs; miss → one POST, recorded.
 * `stats` counts both so a run can prove its POST budget (SPEC-v1-SPEED acceptance).
 */
export function tapedJudge(inner: Judge, tape: Tape, stats: JudgeStats, label: { pack: string; module: string }): Judge {
  return async (req) => {
    const hit = tape.lookup(req);
    if (hit) {
      stats.replays++;
      return hit.response;
    }
    const t0 = performance.now();
    const response = await inner(req);
    const ms = Math.round(performance.now() - t0);
    stats.posts++;
    tape.record({ key: requestKey(req), at: new Date().toISOString(), pack: label.pack, module: label.module, request: req, response, ms });
    return response;
  };
}
