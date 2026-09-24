/** Interface colors of the JEV operad — types as ports. Identical to manutej/jev. */

export const COLORS = ["entity", "concept", "idea", "evidence", "action"] as const;
export type Color = (typeof COLORS)[number];

export function isColor(value: string): value is Color {
  return (COLORS as readonly string[]).includes(value);
}
