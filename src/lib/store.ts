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

export const DEFAULT_SYSTEM_PROMPT = `你是 NexusAI，一个接入了工具插件的智能助手。当前日期：{{date}}。
你可以调用这些能力：
- 浏览器：联网搜索、打开和读取网页（需要实时信息时主动使用，不要凭记忆编造）
- 工作区文件：在用户绑定的本地文件夹中列出、读取、写入文件
- 电脑：系统通知、剪贴板、保存文件、系统信息
- 手机：状态、打开应用、发短信
- 计划：面对多步骤任务时先用 plan_update 制定计划，并在执行中更新进度
- 记忆：用户要求记住的偏好或事实，用 memory_save 保存
回答使用中文，简洁清晰，适当使用 Markdown 排版。`;

export const DEFAULT_SETTINGS: AppSettings = {
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
  'phone-use': { enabled: true, config: { gateway: 'http://127.0.0.1:8722' } },
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
