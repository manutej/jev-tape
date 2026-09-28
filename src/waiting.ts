/** Waiting twin. StartWaiting → nudges → ResolveWaiting (C10). Timers are injected: the twin has no clock. */
import { enginePorts, type EngineDeps } from "./engine.ts";
import { runItem } from "./item.ts";
import type { ItemOutcome } from "./loop.ts";

export interface WaitingTwinInput {
  display_name: string;
  what: string;
  /** Returns true when the wait resolved, false when a nudge interval elapsed. Mirrors condition(fn, timeout). */
  waitOrNudge: () => Promise<boolean>;
  maxNudges?: number;
  note?: string;
}

export async function runWaiting(input: WaitingTwinInput, deps: EngineDeps, id = "waiting"): Promise<{ started: ItemOutcome; nudges: number; resolved?: ItemOutcome }> {
  const ports = enginePorts(deps);
  const started = await runItem({ name: "StartWaiting", payload: { display_name: input.display_name, what: input.what } }, `${id}:start`, ports);
  if (started.status !== "applied") return { started, nudges: 0 };
  let nudges = 0;
  const max = input.maxNudges ?? 3;
  let resolved = false;
  while (!resolved && nudges < max) {
    resolved = await input.waitOrNudge();
    if (resolved) break;
    nudges += 1;
    await deps.tape.append({ key: `${id}:nudge:${nudges}`, command: "-", event: "WaitingNudged", payload: { display_name: input.display_name, nudge: nudges }, at: (deps.now ?? (() => new Date().toISOString()))() });
  }
  while (!resolved) resolved = await input.waitOrNudge();
  const done = await runItem({ name: "ResolveWaiting", payload: { display_name: input.display_name, what: input.what, note: input.note ?? "" } }, `${id}:resolve`, ports);
  return { started, nudges, resolved: done };
}
