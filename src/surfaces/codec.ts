/**
 * Codecs: connector results → Capture commands, deterministically. No prompt, no model.
 * A codec is a pure function of the tool result. Scrubbing happens here, before anything is judge state.
 */
import type { Command } from "../domain.ts";
import { displayName, scrub } from "./scrub.ts";

export interface Page {
  commands: Command[];
  nextPageToken?: string;
  /** Rows the codec could not map (kept for the log, never for the tape). */
  skipped: number;
}

type Msg = { subject?: string; snippet?: string; sender?: string; from?: string; date?: string; internalDate?: string; labelIds?: string[]; id?: string; threadId?: string };
type Thread = { id?: string; threadId?: string; messages?: Msg[]; subject?: string; snippet?: string; sender?: string; from?: string; date?: string };

function pickNewest(ms: Msg[]): Msg | undefined {
  return [...ms].sort((a, b) => String(b.date ?? b.internalDate ?? "").localeCompare(String(a.date ?? a.internalDate ?? "")))[0];
}

/** Gmail `search_threads` shape: { threads: [{ id, messages: [{ subject, snippet, sender, date }] }], nextPageToken }. Also accepts a bare array of threads or messages. */
export function gmailToCaptures(result: unknown): Page {
  const r = (result ?? {}) as { threads?: Thread[]; messages?: Msg[]; nextPageToken?: string } | Thread[];
  const threads: Thread[] = Array.isArray(r) ? r : (r.threads ?? (r.messages ? [{ messages: r.messages }] : []));
  const commands: Command[] = [];
  let skipped = 0;
  for (const t of threads) {
    const m = t.messages?.length ? pickNewest(t.messages) : (t as Msg);
    const threadId = t.id ?? t.threadId ?? m?.threadId ?? m?.id;
    if (!m || !threadId) { skipped++; continue; }
    const subject = scrub(String(m.subject ?? t.subject ?? "")).text;
    const snippet = scrub(String(m.snippet ?? t.snippet ?? "")).text.slice(0, 160);
    const from = displayName(String(m.sender ?? m.from ?? t.sender ?? t.from ?? ""));
    const date = String(m.date ?? m.internalDate ?? t.date ?? "").slice(0, 10);
    const labels = m.labelIds ?? [];
    const text = [subject, snippet].filter(Boolean).join(" — ").slice(0, 220);
    if (!text) { skipped++; continue; }
    commands.push({
      name: "Capture",
      payload: { text, source: "gmail", from, subject, date, threadId: String(threadId), category: labels.includes("CATEGORY_PROMOTIONS") ? "newsletter" : labels.includes("CATEGORY_UPDATES") ? "notification" : "inbox", unread: labels.includes("UNREAD") },
    });
  }
  return { commands, nextPageToken: Array.isArray(r) ? undefined : r.nextPageToken, skipped };
}

/**
 * Generic codec for any JSON tool result: a path to the row array and a field map.
 *   { rows: "items", id: "id", text: ["title", "body"], from: "author", date: "created_at" }
 */
export interface GenericMap { rows?: string; id: string; text: string[]; from?: string; date?: string; next?: string; source: string }
const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), o);

export function genericToCaptures(result: unknown, map: GenericMap): Page {
  const rows = (map.rows ? get(result, map.rows) : result) as unknown[];
  const commands: Command[] = [];
  let skipped = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = get(row, map.id);
    const text = scrub(map.text.map((p) => String(get(row, p) ?? "")).filter(Boolean).join(" — ")).text.slice(0, 220);
    if (!id || !text) { skipped++; continue; }
    commands.push({ name: "Capture", payload: { text, source: map.source, from: map.from ? displayName(String(get(row, map.from) ?? "")) : "", date: map.date ? String(get(row, map.date) ?? "").slice(0, 10) : "", threadId: `${map.source}:${String(id)}` } });
  }
  return { commands, nextPageToken: map.next ? (get(result, map.next) as string | undefined) : undefined, skipped };
}

export const CODECS = { gmail: gmailToCaptures } as const;
export type Surface = keyof typeof CODECS;

/** Which tool to call per surface, and how the page token travels. */
export const SURFACE_TOOLS: Record<Surface, { tool: string; args: (q: string, pageSize: number, pageToken?: string) => Record<string, unknown> }> = {
  gmail: { tool: "search_threads", args: (query, pageSize, pageToken) => ({ query, pageSize, ...(pageToken ? { pageToken } : {}), view: "THREAD_VIEW_MINIMAL" }) },
};
