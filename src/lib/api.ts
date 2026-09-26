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

  const res = await fetch(`${normBase(settings.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API 返回 ${res.status}：${text.slice(0, 300)}`);
  }
  if (!res.body) throw new Error('响应没有内容流');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage: TokenUsage | undefined;
  const tcMap = new Map<number, ApiToolCall>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          onDelta(delta.content);
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0;
            const cur = tcMap.get(idx) ?? { id: '', name: '', args: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            tcMap.set(idx, cur);
          }
        }
        if (json.usage) {
          usage = {
            prompt: json.usage.prompt_tokens ?? 0,
            completion: json.usage.completion_tokens ?? 0,
          };
        }
      } catch {
        // 忽略不完整的 JSON 片段
      }
    }
  }

  const toolCalls = Array.from(tcMap.values()).map((tc, i) => ({
    ...tc,
    id: tc.id || `call_${Date.now()}_${i}`,
  }));
  return { content, toolCalls, usage };
}

export async function testConnection(settings: AppSettings): Promise<string> {
  const res = await fetch(`${normBase(settings.baseUrl)}/models`, {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}：${text.slice(0, 200)}`);
  }
  const json = await res.json().catch(() => null);
  const n = Array.isArray(json?.data) ? json.data.length : 0;
  return n ? `连接成功，共 ${n} 个可用模型` : '连接成功';
}
