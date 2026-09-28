/** SomedayReview twin. Each review is a decision: keep | snooze | trash. Trash is C10. */
import { enginePorts, type EngineDeps } from "./engine.ts";
import { runItem } from "./item.ts";

export type ReviewDecision = "keep" | "snooze" | "trash";

export async function runSomedayReview(
  itemKey: string,
  decisions: ReviewDecision[],
  deps: EngineDeps,
  id = "someday",
): Promise<{ reviews: number; final: string }> {
  const ports = enginePorts(deps);
  let reviews = 0;
  for (const d of decisions) {
    reviews += 1;
    if (d === "trash") {
      const out = await runItem({ name: "Trash", payload: { itemKey, itemKind: "Someday" } }, `${id}:trash:${reviews}`, ports);
      return { reviews, final: out.status === "applied" ? "trashed" : `trash ${out.status}` };
    }
    if (d === "snooze") await runItem({ name: "SnoozeSomeday", payload: { itemKey, review: reviews } }, `${id}:snooze:${reviews}`, ports);
  }
  return { reviews, final: "kept" };
}
