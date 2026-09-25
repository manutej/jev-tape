/**
 * Command / DomainEvent mirrors of manutej/jev-domain.
 * Shape lives in the Rust crate. This file is a codec for the tape, not a second ADT.
 * Do not grow variants here that the crate refuses.
 *
 * CreateHabit is SPEC'd in SPEC-v0-Block-C.md but DEFERRED in command.rs.
 */

import { C10_ACTIONS } from "../.jev/jev-core.ts";

export type Clarification = "ToNextAction" | "ToProject" | "ToSomeday" | "ToWaiting";

export const COMMAND_NAMES = [
  "Capture",
  "Clarify",
  "Complete",
  "StallProject",
  "SetNext",
  "StartWaiting",
  "ResolveWaiting",
  "SnoozeSomeday",
  "MintInstance",
  "Trash",
  "CreateHabit",
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

export interface Command {
  name: CommandName;
  payload: Record<string, unknown>;
}

export type DomainEventName =
  | "Captured"
  | "Clarified"
  | "Completed"
  | "ProjectStalled"
  | "ProjectNextSet"
  | "WaitingStarted"
  | "WaitingResolved"
  | "WaitingNudged"
  | "SomedaySnoozed"
  | "InstanceMinted"
  | "Trashed"
  | "HabitCreated";

export interface DomainEvent {
  name: DomainEventName;
  payload: Record<string, unknown>;
}

const COMPLETABLE = new Set(["NextAction", "Instance", "Event"]);

export function completeAllowed(itemKind: string): boolean {
  return COMPLETABLE.has(itemKind);
}

export function assertLegalCommand(cmd: Command): string | null {
  if (cmd.name === "Complete") {
    const kind = String(cmd.payload.itemKind ?? "");
    if (kind && !completeAllowed(kind)) {
      return `Complete on ${kind} is illegal (NextAction | Instance | Event only)`;
    }
  }
  if (cmd.name === "StartWaiting") {
    const display = String(cmd.payload.display_name ?? "");
    if (!display.trim()) return "StartWaiting requires PersonCard.display_name";
  }
  if (cmd.name === "CreateHabit") {
    return "CreateHabit is deferred in jev-domain command.rs — do not invent it only on the tape";
  }
  return null;
}

/**
 * C10 (.jev/contracts.json human_gate) restricted to domain Commands: Complete, Trash, ResolveWaiting.
 * The rest of the C10 list (send, merge-to-default) are surface writes, not Commands.
 */
export const HUMAN_GATED_COMMANDS = new Set<CommandName>(
  COMMAND_NAMES.filter((n) => (C10_ACTIONS as readonly string[]).includes(n)),
);
