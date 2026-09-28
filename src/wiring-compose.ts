/**
 * composeAnswers for surface `wiring`. Pure code. No fetch, no keys, no IO.
 * Turns one recorded TypeSafe answer map into GREEN / AMBER / RED.
 * A failed frozen rule is a local RED the judge cannot override.
 * Replay re-runs this on the recorded map; it never calls TypeSafe again.
 */
import { isMidBandNoul, type SystemOneResponse, type ScoreAnswer } from "./typesafe/contract.ts";

export type Verdict = "GREEN" | "AMBER" | "RED";
export type RuleResult = { B_minus_A_pts: number; threshold_pts: number; passes: boolean };

/** Pack peakedness floor for a GREEN promote choice. Not θ. See wiki dual-axis. */
export const WIRING_TOP_PROB_FLOOR = 0.5;

export const WIRING_SCOPE_LEVELS = [
  "Rung wording stays inside what the recorded run measured",
  "Rung wording implies something the run did not measure, but nothing on the MAY-NOT list",
  "Rung wording asserts a MAY-NOT item (CR@F95, L3/L4, cross-corpus, OC validates model reasoning)",
] as const;

export function frozenRule(gapPts: number, thresholdPts: number): RuleResult {
  return { B_minus_A_pts: gapPts, threshold_pts: thresholdPts, passes: gapPts > thresholdPts };
}

/** Score answers are continuous; legend keys are 0-indexed level strings. */
export function scoreLevel(a: ScoreAnswer | undefined): string {
  if (!a || !Number.isFinite(a.score)) return "";
  const idx = Math.round(a.score);
  return String(a.legend?.[String(idx)] ?? "");
}

export function composeWiring(
  rule: RuleResult,
  answers: SystemOneResponse["answers"],
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  if (!rule.passes) {
    return { verdict: "RED", reasons: ["local RED: frozen rule failed; judge cannot override"] };
  }
  const promote = answers.promote_rung;
  const choice = promote?.type === "choice" ? promote.choice : "AMBER";
  let verdict: Verdict = choice === "GREEN" || choice === "RED" ? choice : "AMBER";
  reasons.push(`promote_rung=${choice}`);

  if (verdict === "GREEN" && promote?.type === "choice") {
    const p = Number(promote.probabilities?.[choice] ?? 0);
    if (p < WIRING_TOP_PROB_FLOOR) {
      verdict = "AMBER";
      reasons.push(`promote_rung GREEN below top_prob_floor (${p} < ${WIRING_TOP_PROB_FLOOR})`);
    }
  }

  const lr = answers.legend_readable;
  const noul = lr?.type === "noul" ? lr.noul : NaN;
  if (verdict === "GREEN" && isMidBandNoul(noul)) {
    verdict = "AMBER";
    reasons.push(`legend_readable mid-band (${noul}) demotes GREEN to AMBER`);
  } else if (verdict === "GREEN" && noul <= 0.4) {
    verdict = "AMBER";
    reasons.push(`legend_readable low (${noul}) demotes GREEN to AMBER`);
  }

  const ev = answers.evidence_sufficiency;
  const evChoice = ev?.type === "choice" ? ev.choice : "";
  if (verdict === "GREEN" && evChoice !== "parity") {
    verdict = "AMBER";
    reasons.push(`evidence_sufficiency=${evChoice} demotes GREEN to AMBER`);
  }

  const sc = answers.scope;
  const level = scoreLevel(sc?.type === "score" ? sc : undefined);
  if (level) reasons.push(`scope level: ${level}`);
  if (/asserts a MAY-NOT item/.test(level)) {
    verdict = "RED";
    reasons.push("scope: rung asserts a MAY-NOT item");
  }
  return { verdict, reasons };
}
