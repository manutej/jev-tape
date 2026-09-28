/**
 * One item through the loop. Pure control flow over injected ports.
 *
 * The in-process twin (src/engine.ts) and JevCorrectnessWorkflow (src/temporal/workflows.ts) both call
 * runItem with their own ports. Same names, same branches. The workflow's ports are Activities and a
 * Signal wait; the twin's ports are plain async functions. Neither one may reorder the steps.
 */
import type { Command } from "./domain.ts";
import {
  applyHumanVerdict,
  decide,
  localGate,
  propose,
  type HumanVerdict,
  type ItemOutcome,
  type Proposal,
  type Step,
  type Verdict,
} from "./loop.ts";

export interface Ports {
  qualifyTask(cmd: Command, key: string): Promise<Verdict>;
  qualifyOutput(cmd: Command, proposal: Proposal): Promise<Verdict>;
  applyCommand(cmd: Command, proposal: Proposal): Promise<{ applied: boolean; duplicate: boolean }>;
  /** C10 park. Resolves when a human answers. The workflow implements this as a Signal wait. */
  awaitHumanVerdict(cmd: Command, proposal: Proposal, verdict: Verdict): Promise<HumanVerdict>;
}

function failedVerdict(gate: Verdict["gate"], err: unknown): Verdict {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return { gate, light: "RED", reasons: [`${gate}: judge failed, fail closed. ${message.slice(0, 300)}`], source: "none", model: "", answers: {} };
}

export async function runItem(cmd: Command, key: string, ports: Ports): Promise<ItemOutcome> {
  const steps: Step[] = [];
  let seq = 0;
  const step = (s: Omit<Step, "seq">) => steps.push({ seq: ++seq, ...s });
  const done = (status: ItemOutcome["status"], light: ItemOutcome["light"], event?: Proposal["event"]): ItemOutcome =>
    ({ idempotencyKey: key, command: cmd, status, light, steps, ...(event ? { event } : {}) });

  // Path 0: code only. An illegal command never reaches a judge. 0 POSTs.
  const local = localGate(cmd);
  step({ kind: "assertLegalCommand", light: local.light, reasons: local.reasons, source: "code" });
  if (local.light === "RED") {
    step({ kind: "residual", light: "RED", reasons: ["local RED, judge not consulted"], source: "code" });
    return done("residual", "RED");
  }

  // Gate 1
  let task: Verdict;
  try {
    task = await ports.qualifyTask(cmd, key);
  } catch (err) {
    task = failedVerdict("task", err);
  }
  step({ kind: "qualifyTask", light: task.light, reasons: task.reasons, source: task.source, ms: task.ms, detail: { model: task.model, pack: task.pack, oc: task.oc } });
  if (decide(task.light) === "residual") {
    step({ kind: "residual", light: "RED", reasons: ["task gate RED"], source: task.source });
    return done("residual", "RED");
  }

  // Propose in memory. Nothing written.
  const proposal = propose(cmd, key);
  step({ kind: "propose", source: "code", detail: { event: proposal.event.name } });

  // Gate 2
  let output: Verdict;
  try {
    output = await ports.qualifyOutput(cmd, proposal);
  } catch (err) {
    output = failedVerdict("output", err);
  }
  step({ kind: "qualifyOutput", light: output.light, reasons: output.reasons, source: output.source, ms: output.ms, detail: { model: output.model, pack: output.pack, oc: output.oc } });
  if (decide(output.light) === "residual") {
    step({ kind: "residual", light: "RED", reasons: ["output gate RED"], source: output.source });
    return done("residual", "RED");
  }

  // Park (AMBER at either gate, including every C10 command). A human decides.
  let light = task.light === "AMBER" || output.light === "AMBER" ? "AMBER" as const : "GREEN" as const;
  if (light === "AMBER") {
    const verdict = await ports.awaitHumanVerdict(cmd, proposal, output);
    step({ kind: "humanVerdict", light, reasons: [`human said ${verdict}`], source: "human" });
    if (applyHumanVerdict(verdict) === "residual") {
      step({ kind: "residual", light: "RED", reasons: [`human ${verdict}`], source: "human" });
      return done("residual", "RED");
    }
    light = "GREEN";
  }

  // Apply last. First and only domain write.
  const applied = await ports.applyCommand(cmd, proposal);
  step({ kind: "applyCommand", light: "GREEN", reasons: [applied.duplicate ? "idempotent: already on tape" : "written"], source: "code" });
  return done("applied", "GREEN", proposal.event);
}
