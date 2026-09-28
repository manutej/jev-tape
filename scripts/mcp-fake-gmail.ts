#!/usr/bin/env node
/**
 * A tiny MCP server over stdio that speaks the Gmail connector's `search_threads` shape from a local pack.
 * For tests and for demos without a Gmail MCP server:
 *   JEV_MCP_COMMAND="node --experimental-strip-types scripts/mcp-fake-gmail.ts" npm run ingest
 * Pages of `pageSize` from JEV_FAKE_PACK (default .jev-tape/pack.json) or a built-in sample.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const packPath = process.env.JEV_FAKE_PACK ?? new URL("../.jev-tape/pack.json", import.meta.url).pathname;
type Row = { payload: { text: string; from?: string; subject?: string; date?: string; threadId?: string } };
const rows: Row[] = existsSync(packPath)
  ? (JSON.parse(readFileSync(packPath, "utf8")) as Row[])
  : [
      { payload: { text: "Reply to Ana about the Oct 2 dry run", from: "Ana", subject: "Re: Availability Oct 2nd", date: "2026-09-27", threadId: "t-1" } },
      { payload: { text: "Invoice #4471 is due Friday", from: "Vendor Billing", subject: "Invoice 4471", date: "2026-09-26", threadId: "t-2" } },
      { payload: { text: "Weekly digest: 12 new articles", from: "Newsletter", subject: "Weekly digest", date: "2026-09-26", threadId: "t-3" } },
    ];

const server = new McpServer({ name: "fake-gmail", version: "0.1.0" });
server.registerTool(
  "search_threads",
  {
    description: "Fake Gmail search_threads: pages over a local pack in the connector's shape.",
    inputSchema: { query: z.string().optional(), pageSize: z.number().optional(), pageToken: z.string().optional(), view: z.string().optional() },
  },
  async ({ pageSize, pageToken }) => {
    const size = Math.min(50, pageSize ?? 20);
    const start = pageToken ? Number(pageToken) : 0;
    const slice = rows.slice(start, start + size);
    const threads = slice.map((r, i) => ({
      id: r.payload.threadId ?? `fake-${start + i}`,
      messages: [{ id: `m-${start + i}`, threadId: r.payload.threadId ?? `fake-${start + i}`, subject: r.payload.subject ?? r.payload.text, snippet: r.payload.text, sender: `${r.payload.from ?? "Someone"} <hidden@example.com>`, date: `${r.payload.date ?? "2026-09-28"}T12:00:00Z`, labelIds: ["INBOX"] }],
    }));
    const next = start + size < rows.length ? String(start + size) : undefined;
    return { content: [{ type: "text", text: JSON.stringify({ threads, ...(next ? { nextPageToken: next } : {}), resultCountEstimate: rows.length }) }] };
  },
);
await server.connect(new StdioServerTransport());
