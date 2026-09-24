/**
 * Command / DomainEvent mirrors of manutej/jev-domain.
 * Shape lives in the Rust crate. This file is a codec for the tape, not a second ADT.
 * Do not grow variants here that the crate refuses.
 *
 * CreateHabit is SPEC'd in SPEC-v0-Block-C.md but DEFERRED in command.rs.
 */

export type Clarification = "ToNextAction" | "ToProject" | "ToSomeday" | "ToWaiting";

export type CommandName =
  | "Capture"
  | "Clarify"
  | "Complete"
  | "StallProject"
  | "SetNext"
  | "StartWaiting"
  | "ResolveWaiting"
  | "SnoozeSomeday"
  | "MintInstance"
  | "Trash"
  | "CreateHabit";

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

export const HUMAN_GATED_COMMANDS = new Set<CommandName>(["Complete", "Trash", "ResolveWaiting"]);
