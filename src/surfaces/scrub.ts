/** Scrubbing in code. The same rules as scripts/pack-scan.mjs, applied before anything becomes judge state. */
export const SCRUB_RULES: Array<[name: string, re: RegExp]> = [
  ["email", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["phone", /(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g],
  ["code", /\b\d{6,8}\b/g],
  ["url", /https?:\/\/\S+|\bwww\.\S+/gi],
  ["cardlike", /\b(?:\d[ -]?){13,19}\b/g],
];

export function scrub(text: string): { text: string; hits: Record<string, number> } {
  const hits: Record<string, number> = {};
  let out = text;
  for (const [name, re] of SCRUB_RULES) {
    const m = out.match(re);
    if (m) {
      hits[name] = m.length;
      out = out.replace(re, `[${name} removed]`);
    }
  }
  return { text: out.replace(/\s+/g, " ").trim(), hits };
}

/** "Victoria DeGroot <v@x.com>" → "Victoria DeGroot"; "v@x.com" → "x". Never an address. */
export function displayName(sender: string): string {
  const s = String(sender ?? "").trim();
  const angle = s.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  if (angle) return angle[1]!.trim();
  const at = s.match(/^([^@\s]+)@([^.\s]+)/);
  if (at) return at[2]!;
  return scrub(s).text;
}
