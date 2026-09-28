/** Habit twin. Mints Instances. CreateHabit is illegal here and everywhere on the tape. */
import { enginePorts, type EngineDeps } from "./engine.ts";
import { runItem } from "./item.ts";

export async function runHabit(habitId: string, instances: number, deps: EngineDeps, id = "habit"): Promise<{ minted: number }> {
  const ports = enginePorts(deps);
  let minted = 0;
  for (let n = 1; n <= instances; n++) {
    const out = await runItem({ name: "MintInstance", payload: { habitId, n } }, `${id}:mint:${n}`, ports);
    if (out.status === "applied") minted += 1;
  }
  return { minted };
}
