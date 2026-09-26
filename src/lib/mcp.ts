/**
 * 最小 MCP（Model Context Protocol）客户端 —— Streamable HTTP 传输。
 * 支持 initialize / tools/list / tools/call，工具名以 mcp__服务器__工具 暴露给模型。
 */
import type { McpServer } from '@/types';

export interface McpToolInfo {
  serverId: string;
  serverName: string;
  exposedName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const toolCache = new Map<string, McpToolInfo[]>();
const nameMap = new Map<string, McpToolInfo>();
const sessionIds = new Map<string, string>();

const sanitize = (_s: string) => _s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);

async function rpc(
  server: McpServer,
  method: string,
  params?: unknown,
  id?: number,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const sid = sessionIds.get(server.id);
  if (sid) headers['mcp-session-id'] = sid;

  const res = await fetch(server.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      ...(id !== undefined ? { id } : {}),
      method,
      params,
    }),
  });

  const newSid = res.headers.get('mcp-session-id');
  if (newSid) sessionIds.set(server.id, newSid);
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const text = await res.text();
    let result: Record<string, unknown> | null = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const j = JSON.parse(line.slice(5).trim());
          if (j.result !== undefined || j.error) result = j;
        } catch {
          /* partial chunk */
        }
      }
    }
    const err = result?.error as { message?: string } | undefined;
    if (err) throw new Error(err.message || 'MCP 错误');
    return result?.result;
  }

  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'MCP 错误');
  return j.result;
}

export async function refreshMcpTools(server: McpServer): Promise<McpToolInfo[]> {
  await rpc(
    server,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'NexusAI', version: '2.0' },
    },
    1,
  );
  await rpc(server, 'notifications/initialized').catch(() => undefined);
  const result = (await rpc(server, 'tools/list', {}, 2)) as
    | { tools?: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] }
    | undefined;
  const tools: McpToolInfo[] = (result?.tools || []).map((t) => {
    const exposed = `mcp__${sanitize(server.name)}__${sanitize(t.name)}`.slice(0, 64);
    return {
      serverId: server.id,
      serverName: server.name,
      exposedName: exposed,
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
    };
  });
  toolCache.set(server.id, tools);
  for (const t of tools) nameMap.set(t.exposedName, t);
  return tools;
}

export function getCachedMcpTools(servers: McpServer[]): McpToolInfo[] {
  return servers.filter((s) => s.enabled).flatMap((s) => toolCache.get(s.id) || []);
}

export function findMcpTool(exposed: string): McpToolInfo | null {
  return nameMap.get(exposed) || null;
}

export async function callMcpTool(
  server: McpServer,
  toolName: string,
  args: unknown,
): Promise<string> {
  const result = (await rpc(server, 'tools/call', { name: toolName, arguments: args }, 3)) as
    | { content?: { type?: string; text?: string }[] }
    | undefined;
  const content = result?.content;
  if (Array.isArray(content)) {
    return content.map((c) => c.text ?? JSON.stringify(c)).join('\n');
  }
  return JSON.stringify(result ?? '（无返回）');
}
