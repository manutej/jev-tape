/**
 * jev as an MCP client. No model reads the connector; code calls its tools and a codec maps results to commands.
 *
 *   JEV_MCP_COMMAND="npx -y some-gmail-mcp-server"   stdio transport (args split on spaces; JEV_MCP_ARGS_JSON for exact args)
 *   JEV_MCP_URL="http://localhost:3333/mcp"           streamable-HTTP transport (JEV_MCP_BEARER adds an Authorization header)
 *
 * Only the worker reads these. The workflow isolate never sees a transport.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpTarget {
  kind: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  bearer?: string;
  env?: Record<string, string>;
}

export function mcpTargetFromEnv(env: NodeJS.ProcessEnv = process.env): McpTarget | null {
  if (env.JEV_MCP_URL) return { kind: "http", url: env.JEV_MCP_URL, bearer: env.JEV_MCP_BEARER };
  if (env.JEV_MCP_COMMAND) {
    const parts = env.JEV_MCP_COMMAND.split(" ").filter(Boolean);
    const args = env.JEV_MCP_ARGS_JSON ? (JSON.parse(env.JEV_MCP_ARGS_JSON) as string[]) : parts.slice(1);
    return { kind: "stdio", command: parts[0], args };
  }
  return null;
}

export interface McpSession {
  client: Client;
  listTools(): Promise<string[]>;
  /** Calls a tool and returns its structured content when present, else the first text block parsed as JSON, else raw text. */
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export async function connectMcp(target: McpTarget): Promise<McpSession> {
  const client = new Client({ name: "jev-tape", version: "0.2.0" });
  if (target.kind === "stdio") {
    if (!target.command) throw new Error("stdio MCP target needs a command");
    const transport = new StdioClientTransport({ command: target.command, args: target.args ?? [], env: { ...(process.env as Record<string, string>), ...(target.env ?? {}) }, stderr: "pipe" });
    await client.connect(transport);
  } else {
    if (!target.url) throw new Error("http MCP target needs a url");
    const transport = new StreamableHTTPClientTransport(new URL(target.url), target.bearer ? { requestInit: { headers: { authorization: `Bearer ${target.bearer}` } } } : undefined);
    await client.connect(transport);
  }
  return {
    client,
    async listTools() {
      const r = await client.listTools();
      return r.tools.map((t) => t.name);
    },
    async call(name, args) {
      const r = await client.callTool({ name, arguments: args });
      if (r.isError) throw new Error(`MCP tool ${name} failed: ${JSON.stringify(r.content).slice(0, 300)}`);
      if (r.structuredContent) return r.structuredContent;
      const content = r.content as Array<{ type: string; text?: string }>;
      const text = content.find((c) => c.type === "text")?.text ?? "";
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
    async close() {
      await client.close();
    },
  };
}
