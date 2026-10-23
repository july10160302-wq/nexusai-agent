/**
 * 最小 MCP（Model Context Protocol）客户端 —— Streamable HTTP 传输。
 * 支持 initialize / tools/list / tools/call，工具名以 mcp__服务器__工具 暴露给模型。
 */
import type { McpServer } from '@/types';
import { readEvents } from './stream';

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
const freshUntil = new Map<string, number>();
const fingerprints = new Map<string, string>();
let requestId = 0;

const sanitize = (_s: string) => _s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);

async function rpc(
  server: McpServer,
  method: string,
  params?: unknown,
  id?: number,
  signal?: AbortSignal,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const sid = sessionIds.get(server.id);
  if (server.token) headers.Authorization = `Bearer ${server.token}`;
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
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });

  const newSid = res.headers.get('mcp-session-id');
  if (newSid) sessionIds.set(server.id, newSid);
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  if (res.status === 202 || res.status === 204) return undefined;

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    let result: Record<string, unknown> | null = null;
    if (!res.body) throw new Error('MCP response has no body');
    await readEvents(res.body, data => {
      const j = JSON.parse(data);
      if (j.id === id && (j.result !== undefined || j.error)) { result = j; return true; }
    });
    if (!result) throw new Error('MCP stream ended without a response');
    const response = result as Record<string, unknown>;
    const err = response.error as { message?: string } | undefined;
    if (err) throw new Error(err.message || 'MCP 错误');
    return response.result;
  }

  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'MCP 错误');
  return j.result;
}

export async function refreshMcpTools(server: McpServer, cached = false, signal?: AbortSignal): Promise<McpToolInfo[]> {
  const fingerprint = JSON.stringify([server.url, server.token]);
  if (fingerprints.get(server.id) !== fingerprint) {
    sessionIds.delete(server.id);
    freshUntil.delete(server.id);
    toolCache.delete(server.id);
  }
  if (cached && (freshUntil.get(server.id) || 0) > Date.now()) return toolCache.get(server.id) || [];
  fingerprints.set(server.id, fingerprint);
  await rpc(
    server,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'NexusAI', version: '2.0' },
    },
    ++requestId,
    signal,
  );
  await rpc(server, 'notifications/initialized', undefined, undefined, signal);
  const result = (await rpc(server, 'tools/list', {}, ++requestId, signal)) as
    | { tools?: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] }
    | undefined;
  const tools: McpToolInfo[] = (result?.tools || []).map((t) => {
    const exposed = `mcp__${sanitize(server.id).slice(0, 12)}__${sanitize(t.name)}`.slice(0, 64);
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
  freshUntil.set(server.id, Date.now() + 60000);
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
  const result = (await rpc(server, 'tools/call', { name: toolName, arguments: args }, ++requestId)) as
    | { content?: { type?: string; text?: string }[] }
    | undefined;
  const content = result?.content;
  if (Array.isArray(content)) {
    return content.map((c) => c.text ?? JSON.stringify(c)).join('\n');
  }
  return JSON.stringify(result ?? '（无返回）');
}
