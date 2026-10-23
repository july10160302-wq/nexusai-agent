import { useEffect, useState } from 'react';
import type { AppSettings, Assistant, PluginStates } from '@/types';

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (initial && typeof initial === 'object' && !Array.isArray(initial)) {
        return { ...(initial as object), ...(parsed as object) } as T;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full / unavailable — ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** 系统提示词变量展开：{{date}} {{time}} {{model}} */
export function expandPrompt(prompt: string, model: string): string {
  const now = new Date();
  return prompt
    .replaceAll('{{date}}', now.toLocaleDateString('zh-CN'))
    .replaceAll('{{time}}', now.toLocaleTimeString('zh-CN', { hour12: false }))
    .replaceAll('{{model}}', model);
}

export const DEFAULT_SYSTEM_PROMPT = `You are NexusAI, a helpful assistant. Today: {{date}}.
Use only tools provided in the current request. Describe missing capabilities honestly.
Never claim to have searched, clicked, read or written anything without a successful tool result.
For file edits, read first, explain the change and respect the user's approval decision.
Keep answers clear and concise. Match the user's language unless instructed otherwise.`;

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'zh',
  chatMode: 'chat',
  requestTimeout: 120,
  baseUrl: 'https://api.moonshot.cn/v1',
  apiKey: '',
  model: 'kimi-k2-0905-preview',
  temperature: 0.6,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  maxToolRounds: 8,
  approvalMode: 'writes',
  mcpServers: [],
  reasoningEffort: 'off',
};

export const DEFAULT_PLUGIN_STATES: PluginStates = {
  'browser-use': { enabled: true, config: {} },
  workspace: { enabled: true, config: {} },
  'computer-use': { enabled: true, config: {} },
  'phone-use': { enabled: false, config: { gateway: 'http://127.0.0.1:8722' } },
  'agent-plan': { enabled: true, config: {} },
  memory: { enabled: true, config: {} },
  utilities: { enabled: true, config: {} },
};

export const DEFAULT_ASSISTANTS: Assistant[] = [
  {
    id: 'default',
    name: '通用助手',
    emoji: '🤖',
    systemPrompt: '',
    model: '',
    temperature: null,
    pluginIds: [],
  },
  {
    id: 'coder',
    name: '编程专家',
    emoji: '💻',
    systemPrompt:
      '你是一名资深全栈工程师。写代码时给出完整可运行的实现，解释关键设计决策。优先使用工作区文件工具读写项目文件，修改前先读取现有代码。',
    model: '',
    temperature: 0.3,
    pluginIds: [],
  },
  {
    id: 'researcher',
    name: '研究员',
    emoji: '🔍',
    systemPrompt:
      '你是一名严谨的研究员。回答问题前主动联网搜索核实，引用信息来源，区分事实与推测，输出结构化的研究结论。',
    model: '',
    temperature: 0.4,
    pluginIds: ['browser-use', 'workspace', 'agent-plan', 'memory', 'utilities'],
  },
];
