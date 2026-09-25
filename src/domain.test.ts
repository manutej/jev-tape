import { test } from "node:test";
import assert from "node:assert/strict";
import { C10_ACTIONS } from "../.jev/jev-core.ts";
import { assertLegalCommand, COMMAND_NAMES, completeAllowed, HUMAN_GATED_COMMANDS, type Command } from "./domain.ts";

const cmd = (name: Command["name"], payload: Record<string, unknown> = {}): Command => ({ name, payload });

test("Complete is legal only on NextAction, Instance or Event", () => {
  for (const kind of ["NextAction", "Instance", "Event"]) {
    assert.equal(completeAllowed(kind), true);
    assert.equal(assertLegalCommand(cmd("Complete", { itemKind: kind })), null);
  }
  for (const kind of ["Project", "Someday", "Waiting", "Habit"]) {
    assert.equal(completeAllowed(kind), false);
    assert.match(assertLegalCommand(cmd("Complete", { itemKind: kind })) ?? "", new RegExp(`Complete on ${kind} is illegal`));
  }
});

test("Complete without an itemKind is not refused by the codec", () => {
  assert.equal(assertLegalCommand(cmd("Complete")), null);
});

test("StartWaiting requires a non-blank PersonCard.display_name", () => {
  assert.equal(assertLegalCommand(cmd("StartWaiting", { display_name: "Victoria" })), null);
  assert.equal(assertLegalCommand(cmd("StartWaiting")), "StartWaiting requires PersonCard.display_name");
  assert.equal(assertLegalCommand(cmd("StartWaiting", { display_name: "   " })), "StartWaiting requires PersonCard.display_name");
});

test("CreateHabit is refused: deferred in jev-domain command.rs", () => {
  assert.match(assertLegalCommand(cmd("CreateHabit", { rule: "daily" })) ?? "", /CreateHabit is deferred/);
});

test("every other command passes the codec", () => {
  for (const name of COMMAND_NAMES) {
    if (name === "Complete" || name === "StartWaiting" || name === "CreateHabit") continue;
    assert.equal(assertLegalCommand(cmd(name)), null, name);
  }
});

test("HUMAN_GATED_COMMANDS is C10 restricted to domain Commands", () => {
  assert.deepEqual([...HUMAN_GATED_COMMANDS].sort(), ["Complete", "ResolveWaiting", "Trash"]);
  for (const name of COMMAND_NAMES) {
    assert.equal(HUMAN_GATED_COMMANDS.has(name), (C10_ACTIONS as readonly string[]).includes(name), name);
  }
  // The rest of C10 are surface writes, not Commands.
  const rest = C10_ACTIONS.filter((a) => !(COMMAND_NAMES as readonly string[]).includes(a));
  assert.deepEqual(rest, ["send", "merge-to-default"]);
});
