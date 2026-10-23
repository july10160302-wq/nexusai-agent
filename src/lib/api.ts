import { readEvents } from './stream';
import type { AppSettings, ChatMessage, TokenUsage } from '@/types';

export interface ApiToolCall {
  id: string;
  name: string;
  args: string;
}

interface ToolSchema {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}
interface CompletionChunk {
  error?: { message?: string };
  choices?: { finish_reason?: string | null; delta?: CompletionDelta; message?: CompletionDelta }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface CompletionDelta {
  content?: string | null;
  reasoning_content?: string;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

const normBase = (u: string) => u.trim().replace(/\/+$/, '');

export function toApiMessages(messages: ChatMessage[], systemPrompt: string) {
  const out: Record<string, unknown>[] = [];
  if (systemPrompt.trim()) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) {
    if (m.role === 'user') {
      if (m.attachments?.length) {
        out.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            ...m.attachments.map((a) => ({
              type: 'image_url',
              image_url: { url: a.dataUrl },
            })),
          ],
        });
      } else {
        out.push({ role: 'user', content: m.content });
      }
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args },
        }));
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

export async function chatOnce(opts: {
  settings: AppSettings;
  messages: Record<string, unknown>[];
  tools: ToolSchema[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
  onPhase?: (phase: 'connecting' | 'receiving' | 'reasoning' | 'streaming') => void;
}): Promise<{ content: string; toolCalls: ApiToolCall[]; usage?: TokenUsage }> {
  const { settings, messages, tools, onDelta, signal } = opts;
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: settings.temperature,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (settings.reasoningEffort && settings.reasoningEffort !== 'off') {
    body.reasoning_effort = settings.reasoningEffort;
  }
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  opts.onPhase?.('connecting');
  const timeout = AbortSignal.timeout((settings.requestTimeout || 120) * 1000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(`${normBase(settings.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: requestSignal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API 返回 ${res.status}：${text.slice(0, 300)}`);
  }
  if (!res.body) throw new Error('响应没有内容流');

  opts.onPhase?.('receiving');
  let content = '';
  let usage: TokenUsage | undefined;
  const tcMap = new Map<number, ApiToolCall>();
  let terminal = false;
  // JSON fallback for compatible providers that ignore stream:true.
  const consume = (json: CompletionChunk) => {
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    const choice = json.choices?.[0];
    const delta = choice?.delta || choice?.message;
    if (delta?.reasoning_content) opts.onPhase?.('reasoning');
    if (typeof delta?.content === 'string' && delta.content) {
      content += delta.content;
      opts.onPhase?.('streaming');
      onDelta(delta.content);
    }
    if (Array.isArray(delta?.tool_calls)) {
      for (const [i, tc] of delta.tool_calls.entries()) {
        const idx = typeof tc.index === 'number' ? tc.index : i;
        const cur = tcMap.get(idx) ?? { id: '', name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        tcMap.set(idx, cur);
      }
    }
    if (choice?.finish_reason) terminal = true;
    if (json.usage) usage = { prompt: json.usage.prompt_tokens ?? 0, completion: json.usage.completion_tokens ?? 0 };
  };
  if (res.headers.get('content-type')?.includes('application/json')) {
    consume(await res.json());
    terminal = true;
  } else {
    await readEvents(res.body, (data) => {
      if (data.trim() === '[DONE]') { terminal = true; return true; }
      consume(JSON.parse(data));
    });
  }
  if (!terminal) throw new Error('Response interrupted before completion. Please retry.');
  if (!content && !tcMap.size) throw new Error('The provider returned no text or tool calls. Check model and API compatibility.');

  const toolCalls = Array.from(tcMap.values()).map((tc, i) => ({
    ...tc,
    id: tc.id || `call_${Date.now()}_${i}`,
  }));
  return { content, toolCalls, usage };
}

export async function testConnection(settings: AppSettings): Promise<string> {
  const started = performance.now();
  const result = await chatOnce({
    settings: { ...settings, reasoningEffort: 'off', requestTimeout: 30 },
    messages: [{ role: 'user', content: 'Reply with OK.' }], tools: [], onDelta: () => undefined,
  });
  return ((performance.now() - started) / 1000).toFixed(1) + 's · ' + result.content.slice(0, 100);
}

export async function listModels(settings: AppSettings): Promise<string[]> {
  const res = await fetch(normBase(settings.baseUrl) + '/models', {
    headers: { Authorization: 'Bearer ' + settings.apiKey }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return (json.data || []).map((m: { id: string }) => m.id).sort();
}
