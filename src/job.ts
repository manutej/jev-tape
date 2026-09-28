/**
 * Worklist fold twin. Same fold as JevCorrectnessWorkflow: batches of 8, RED → residual, C10 parks.
 * ContinueAsNew every 8 shows up here as one `Batch` per 8 items, so a twin run and a Cloud run
 * carry the same batch count.
 */
import type { Command } from "./domain.ts";
import { enginePorts, type EngineDeps, type Worklist } from "./engine.ts";
import { runItem } from "./item.ts";
import type { ItemOutcome } from "./loop.ts";

export const BATCH = 8;

export interface JobResult extends Worklist {
  batches: number;
}

export async function runJob(commands: Command[], deps: EngineDeps, jobId = "job"): Promise<JobResult> {
  const ports = enginePorts(deps);
  const outcomes: ItemOutcome[] = [];
  let batches = 0;
  for (let cursor = 0; cursor < commands.length; cursor += BATCH) {
    batches += 1;
    const end = Math.min(commands.length, cursor + BATCH);
    for (let i = cursor; i < end; i++) outcomes.push(await runItem(commands[i]!, `${jobId}:${i}`, ports));
  }
  return {
    outcomes,
    batches,
    applied: outcomes.filter((o) => o.status === "applied"),
    residual: outcomes.filter((o) => o.status === "residual"),
  };
}
