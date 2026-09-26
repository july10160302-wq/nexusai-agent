import type { ApprovalMode, McpServer, PluginStates } from '@/types';
import { fsDelete, fsList, fsMkdir, fsRead, fsWrite } from '@/lib/fs';
import { callMcpTool, findMcpTool, getCachedMcpTools } from '@/lib/mcp';

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface PluginConfigField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}

export type PluginIcon =
  | 'globe'
  | 'monitor'
  | 'smartphone'
  | 'wrench'
  | 'folder'
  | 'list'
  | 'brain'
  | 'terminal';

export interface Plugin {
  id: string;
  name: string;
  icon: PluginIcon;
  tagline: string;
  description: string;
  version: string;
  tools: ToolDef[];
  configFields?: PluginConfigField[];
  execute: (
    tool: string,
    args: Record<string, unknown>,
    config: Record<string, string>,
  ) => Promise<string>;
}

/* ---------------- helpers ---------------- */

const corsProxy = (u: string) =>
  `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,iframe,svg,header,footer,nav').forEach((el) => el.remove());
  return (doc.body?.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/* ---------------- browser-use ---------------- */

const browserUse: Plugin = {
  id: 'browser-use',
  name: '浏览器使用',
  icon: 'globe',
  tagline: '联网搜索 · 打开网页 · 读取页面',
  description:
    '让大模型像人一样使用浏览器：搜索互联网、在新标签页打开网址、抓取并阅读网页正文内容。',
  version: '1.2.0',
  tools: [
    {
      name: 'web_search',
      description: '在互联网上搜索关键词，返回结果标题、链接和摘要。需要实时信息时使用。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '搜索关键词' } },
        required: ['query'],
      },
    },
    {
      name: 'browser_open',
      description: '在用户的浏览器新标签页中打开指定网址。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: '要打开的完整网址，含 https://' } },
        required: ['url'],
      },
    },
    {
      name: 'browser_read',
      description: '读取指定网页的正文文本内容，用于总结或提取信息。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: '要读取的完整网址，含 https://' } },
        required: ['url'],
      },
    },
  ],
  async execute(tool, args) {
    switch (tool) {
      case 'web_search': {
        const q = encodeURIComponent(String(args.query ?? ''));
        const res = await fetchWithTimeout(corsProxy(`https://html.duckduckgo.com/html/?q=${q}`));
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = Array.from(doc.querySelectorAll('.result'))
          .slice(0, 8)
          .map((el) => {
            const a = el.querySelector('.result__a');
            const snip = el.querySelector('.result__snippet');
            let href = a?.getAttribute('href') || '';
            const m = href.match(/uddg=([^&]+)/);
            if (m) href = decodeURIComponent(m[1]);
            return {
              title: a?.textContent?.trim() || '',
              url: href,
              snippet: snip?.textContent?.trim() || '',
            };
          })
          .filter((i) => i.title);
        if (!items.length) return '未找到相关结果';
        return items.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
      }
      case 'browser_open': {
        const url = String(args.url ?? '');
        if (!/^https?:\/\//.test(url)) return '错误：网址必须以 http:// 或 https:// 开头';
        window.open(url, '_blank', 'noopener');
        return `已在浏览器新标签页打开：${url}`;
      }
      case 'browser_read': {
        const url = String(args.url ?? '');
        if (!/^https?:\/\//.test(url)) return '错误：网址必须以 http:// 或 https:// 开头';
        const res = await fetchWithTimeout(corsProxy(url), {}, 25000);
        const text = htmlToText(await res.text());
        return text ? text.slice(0, 6000) : '页面内容为空或无法解析';
      }
      default:
        return `错误：浏览器插件不支持工具 ${tool}`;
    }
  },
};

/* ---------------- workspace ---------------- */

const workspace: Plugin = {
  id: 'workspace',
  name: '工作区文件',
  icon: 'folder',
  tagline: '列出 · 读取 · 写入 · 删除本地文件',
  description:
    'Codex 式工作区：绑定一个本地文件夹后，大模型可以直接在其中查看目录、读写代码和文档。写操作受审批模式保护。',
  version: '1.0.0',
  tools: [
    {
      name: 'fs_list',
      description: '列出工作区中某个目录的内容。路径相对于工作区根目录。',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '目录路径，默认 . 表示根目录' } },
      },
    },
    {
      name: 'fs_read',
      description: '读取工作区中某个文本文件的内容。',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件路径，例如 src/main.ts' } },
        required: ['path'],
      },
    },
    {
      name: 'fs_write',
      description: '把内容写入工作区中的文件（不存在则创建，目录自动创建）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '要写入的完整内容' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'fs_delete',
      description: '删除工作区中的文件或目录。',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '要删除的路径' } },
        required: ['path'],
      },
    },
    {
      name: 'fs_mkdir',
      description: '在工作区中创建目录（含多级）。',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '目录路径' } },
        required: ['path'],
      },
    },
  ],
  async execute(tool, args) {
    const path = String(args.path ?? '.');
    switch (tool) {
      case 'fs_list':
        return await fsList(path);
      case 'fs_read':
        return await fsRead(path);
      case 'fs_write':
        return await fsWrite(path, String(args.content ?? ''));
      case 'fs_delete':
        return await fsDelete(path);
      case 'fs_mkdir':
        return await fsMkdir(path);
      default:
        return `错误：工作区插件不支持工具 ${tool}`;
    }
  },
};

/* ---------------- computer-use ---------------- */

const computerUse: Plugin = {
  id: 'computer-use',
  name: '电脑使用',
  icon: 'monitor',
  tagline: '通知 · 剪贴板 · 保存文件 · 系统信息',
  description:
    '让大模型操作这台电脑：弹系统通知、读写剪贴板、把内容保存为本地文件、读取屏幕与系统信息。',
  version: '1.1.0',
  tools: [
    {
      name: 'computer_notify',
      description: '在电脑上弹出一条系统通知。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '通知标题' },
          message: { type: 'string', description: '通知内容' },
        },
        required: ['title', 'message'],
      },
    },
    {
      name: 'computer_clipboard_write',
      description: '把文本写入电脑剪贴板。',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: '要写入剪贴板的文本' } },
        required: ['text'],
      },
    },
    {
      name: 'computer_clipboard_read',
      description: '读取电脑剪贴板中的文本内容。',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'computer_save_file',
      description: '把文本内容保存为电脑上的一个文件（会触发下载保存）。',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件名，例如 notes.md' },
          content: { type: 'string', description: '文件内容' },
        },
        required: ['filename', 'content'],
      },
    },
    {
      name: 'computer_system_info',
      description: '获取电脑的系统信息：屏幕、平台、语言、联网状态、当前时间等。',
      parameters: { type: 'object', properties: {} },
    },
  ],
  async execute(tool, args) {
    switch (tool) {
      case 'computer_notify': {
        const title = String(args.title ?? '通知');
        const message = String(args.message ?? '');
        if (!('Notification' in window)) return '错误：当前环境不支持系统通知';
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission !== 'granted') return '错误：用户未授予通知权限';
        new Notification(title, { body: message });
        return `已弹出系统通知：${title}`;
      }
      case 'computer_clipboard_write': {
        await navigator.clipboard.writeText(String(args.text ?? ''));
        return '已写入剪贴板';
      }
      case 'computer_clipboard_read': {
        try {
          const text = await navigator.clipboard.readText();
          return text || '（剪贴板为空）';
        } catch {
          return '错误：读取剪贴板被拒绝，请先在页面上点击一次授权';
        }
      }
      case 'computer_save_file': {
        const filename = String(args.filename ?? 'file.txt');
        const content = String(args.content ?? '');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return `已保存文件：${filename}（${content.length} 字符）`;
      }
      case 'computer_system_info': {
        const info = {
          时间: new Date().toLocaleString('zh-CN'),
          时区: Intl.DateTimeFormat().resolvedOptions().timeZone,
          屏幕: `${window.screen.width}×${window.screen.height}`,
          窗口: `${window.innerWidth}×${window.innerHeight}`,
          语言: navigator.language,
          平台: navigator.platform,
          在线: navigator.onLine ? '是' : '否',
          浏览器: navigator.userAgent,
        };
        return JSON.stringify(info, null, 2);
      }
      default:
        return `错误：电脑插件不支持工具 ${tool}`;
    }
  },
};

/* ---------------- phone-use ---------------- */

const phoneUse: Plugin = {
  id: 'phone-use',
  name: '手机使用',
  icon: 'smartphone',
  tagline: '手机状态 · 打开应用 · 发短信',
  description:
    '通过本地手机网关（如 ADB 网关服务）控制连接的安卓手机。预配置默认网关地址，启动网关后即可用。',
  version: '1.0.0',
  configFields: [
    {
      key: 'gateway',
      label: '手机网关地址',
      placeholder: 'http://127.0.0.1:8722',
      defaultValue: 'http://127.0.0.1:8722',
    },
  ],
  tools: [
    {
      name: 'phone_status',
      description: '获取已连接手机的状态：型号、电量、网络等。',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'phone_open_app',
      description: '在手机上打开指定应用。',
      parameters: {
        type: 'object',
        properties: { app: { type: 'string', description: '应用包名或名称，例如 com.tencent.mm' } },
        required: ['app'],
      },
    },
    {
      name: 'phone_send_sms',
      description: '通过手机发送短信。',
      parameters: {
        type: 'object',
        properties: {
          number: { type: 'string', description: '手机号' },
          message: { type: 'string', description: '短信内容' },
        },
        required: ['number', 'message'],
      },
    },
  ],
  async execute(tool, args, config) {
    const gateway = (config.gateway || 'http://127.0.0.1:8722').replace(/\/+$/, '');
    try {
      const res = await fetchWithTimeout(
        `${gateway}/command`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: tool, ...args }),
        },
        6000,
      );
      const text = await res.text();
      return text || `网关已执行 ${tool}`;
    } catch {
      return `手机网关未连接（${gateway}）。请先在电脑上启动手机网关服务（例如基于 ADB 的网关），或在「插件」页修改网关地址。`;
    }
  },
};

/* ---------------- agent-plan ---------------- */

const agentPlan: Plugin = {
  id: 'agent-plan',
  name: '任务计划',
  icon: 'list',
  tagline: '制定计划 · 跟踪进度',
  description:
    'Codex 式计划面板：面对多步骤任务时，大模型先制定计划清单，执行过程中实时勾选进度，你会在对话下方看到计划面板。',
  version: '1.0.0',
  tools: [
    {
      name: 'plan_update',
      description:
        '制定或更新任务计划。传入完整的计划项列表（含每项的完成状态），会替换当前计划并展示给用户。',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: '计划项数组，例如 [{"text":"搜索资料","done":true},{"text":"写总结","done":false}]',
          },
        },
        required: ['items'],
      },
    },
  ],
  async execute() {
    // 实际的状态更新由对话界面拦截处理
    return '计划已更新';
  },
};

/* ---------------- memory ---------------- */

const MEM_KEY = 'nexus.memory';

export function getMemories(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(MEM_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function setMemories(list: string[]) {
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

const memory: Plugin = {
  id: 'memory',
  name: '长期记忆',
  icon: 'brain',
  tagline: '记住偏好 · 跨对话生效',
  description:
    '类 ChatGPT 记忆：大模型可以把你的偏好、习惯、重要事实保存下来，之后的所有对话都会自动带上这些记忆。',
  version: '1.0.0',
  tools: [
    {
      name: 'memory_save',
      description: '保存一条长期记忆（用户偏好、习惯、重要事实）。用户明确要求记住时使用。',
      parameters: {
        type: 'object',
        properties: { fact: { type: 'string', description: '要记住的内容，一句话' } },
        required: ['fact'],
      },
    },
    {
      name: 'memory_forget',
      description: '删除一条包含指定关键词的长期记忆。',
      parameters: {
        type: 'object',
        properties: { keyword: { type: 'string', description: '要删除的记忆关键词' } },
        required: ['keyword'],
      },
    },
    {
      name: 'memory_list',
      description: '列出当前所有长期记忆。',
      parameters: { type: 'object', properties: {} },
    },
  ],
  async execute(tool, args) {
    switch (tool) {
      case 'memory_save': {
        const fact = String(args.fact ?? '').trim();
        if (!fact) return '错误：记忆内容为空';
        const list = getMemories();
        if (list.includes(fact)) return '这条记忆已存在';
        list.push(fact);
        setMemories(list);
        return `已记住：${fact}`;
      }
      case 'memory_forget': {
        const kw = String(args.keyword ?? '');
        const list = getMemories();
        const next = list.filter((m) => !m.includes(kw));
        setMemories(next);
        return `已删除 ${list.length - next.length} 条相关记忆`;
      }
      case 'memory_list': {
        const list = getMemories();
        return list.length ? list.map((m, i) => `${i + 1}. ${m}`).join('\n') : '（暂无记忆）';
      }
      default:
        return `错误：记忆插件不支持工具 ${tool}`;
    }
  },
};

/* ---------------- code-runner ---------------- */

/** 在 Web Worker 沙盒中执行 JavaScript，5 秒超时，捕获 console 输出 */
function runInSandbox(code: string): Promise<string> {
  const workerCode = `
    const logs = [];
    const fmt = (x) => { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch { return String(x); } };
    const console = { log: (...a) => logs.push(a.map(fmt).join(' ')), warn: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push(a.map(fmt).join(' ')) };
    self.onmessage = (e) => {
      try {
        const fn = new Function('console', e.data);
        Promise.resolve(fn(console))
          .then((r) => {
            if (r !== undefined) logs.push('=> ' + fmt(r));
            self.postMessage({ ok: true, logs });
          })
          .catch((err) => self.postMessage({ ok: false, error: String(err), logs }));
      } catch (err) {
        self.postMessage({ ok: false, error: String(err), logs });
      }
    };
  `;
  const url = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
  const w = new Worker(url);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      w.terminate();
      URL.revokeObjectURL(url);
      resolve('错误：执行超时（5 秒），已终止');
    }, 5000);
    w.onmessage = (e) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      const { ok, logs, error } = e.data as { ok: boolean; logs: string[]; error?: string };
      const out = logs.join('\n');
      resolve((out + (ok ? '' : `${out ? '\n' : ''}错误：${error}`)).trim() || '（无输出）');
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      resolve(`错误：${e.message}`);
    };
    w.postMessage(code);
  });
}

const codeRunner: Plugin = {
  id: 'code-runner',
  name: '代码执行',
  icon: 'terminal',
  tagline: 'JavaScript 沙盒 · 即时运行',
  description:
    '对标 Codex 的终端：在独立的 Web Worker 沙盒中运行 JavaScript 代码并返回输出，适合数据处理、算法验证、格式转换。5 秒超时保护。',
  version: '1.0.0',
  tools: [
    {
      name: 'run_javascript',
      description:
        '在沙盒中执行 JavaScript 代码并返回 console 输出和返回值。用于计算、数据处理、验证想法。不要写死循环（5 秒超时）。',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: '要执行的 JavaScript 代码' } },
        required: ['code'],
      },
    },
  ],
  async execute(tool, args) {
    if (tool !== 'run_javascript') return `错误：代码执行插件不支持工具 ${tool}`;
    return await runInSandbox(String(args.code ?? ''));
  },
};

/* ---------------- utilities ---------------- */

const utilities: Plugin = {
  id: 'utilities',
  name: '实用工具',
  icon: 'wrench',
  tagline: '当前时间 · 计算器',
  description: '基础工具集：获取当前日期时间、进行数学计算。',
  version: '1.0.0',
  tools: [
    {
      name: 'get_current_time',
      description: '获取当前的日期和时间。',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'calculator',
      description: '计算一个数学表达式，支持 + - * / % ^ 和括号。',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string', description: '数学表达式，例如 (3+5)*2^2' } },
        required: ['expression'],
      },
    },
  ],
  async execute(tool, args) {
    switch (tool) {
      case 'get_current_time':
        return new Date().toLocaleString('zh-CN', { hour12: false });
      case 'calculator': {
        const expr = String(args.expression ?? '');
        if (!/^[\d\s+\-*/().,%^]*$/.test(expr)) return '错误：表达式包含非法字符';
        try {
          const val = Function(
            `"use strict"; return (${expr.replace(/\^/g, '**').replace(/,/g, '')})`,
          )() as number;
          return `${expr} = ${val}`;
        } catch {
          return '错误：表达式无法计算';
        }
      }
      default:
        return `错误：实用工具不支持 ${tool}`;
    }
  },
};

/* ---------------- registry ---------------- */

export const PLUGINS: Plugin[] = [
  browserUse,
  workspace,
  codeRunner,
  computerUse,
  phoneUse,
  agentPlan,
  memory,
  utilities,
];

/** 写操作 / 执行类工具 —— 在「写操作需批准」模式下需要用户确认 */
export const WRITE_TOOLS = new Set([
  'fs_write',
  'fs_delete',
  'fs_mkdir',
  'run_javascript',
  'computer_save_file',
  'phone_send_sms',
  'phone_open_app',
  'memory_save',
  'memory_forget',
]);

export function needsApproval(toolName: string, mode: ApprovalMode): boolean {
  if (mode === 'auto') return false;
  if (mode === 'all') return true;
  return WRITE_TOOLS.has(toolName) || toolName.startsWith('mcp__');
}

export function findTool(name: string) {
  for (const p of PLUGINS) {
    const t = p.tools.find((t) => t.name === name);
    if (t) return { plugin: p, tool: t };
  }
  return null;
}

/** 工具所属插件/来源的显示名 */
export function toolSourceName(name: string): string {
  if (name.startsWith('mcp__')) {
    return findMcpTool(name)?.serverName ?? 'MCP';
  }
  return findTool(name)?.plugin.name ?? '未知插件';
}

export function buildToolSchemas(
  states: PluginStates,
  mcpServers: McpServer[] = [],
  filter?: string[],
) {
  const allow = (id: string) => !filter || filter.length === 0 || filter.includes(id);
  const builtin = PLUGINS.filter((p) => states[p.id]?.enabled && allow(p.id)).flatMap((p) =>
    p.tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  );
  const mcp = allow('mcp')
    ? getCachedMcpTools(mcpServers).map((t) => ({
        type: 'function' as const,
        function: {
          name: t.exposedName,
          description: `[${t.serverName}] ${t.description}`,
          parameters: t.inputSchema,
        },
      }))
    : [];
  return [...builtin, ...mcp];
}

export async function executeTool(
  name: string,
  argsJson: string,
  states: PluginStates,
  mcpServers: McpServer[] = [],
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}');
  } catch {
    return '错误：工具参数不是合法 JSON';
  }

  if (name.startsWith('mcp__')) {
    const info = findMcpTool(name);
    if (!info) return `错误：未知 MCP 工具 ${name}`;
    const server = mcpServers.find((s) => s.id === info.serverId);
    if (!server || !server.enabled) return `错误：MCP 服务器「${info.serverName}」已停用`;
    try {
      return await callMcpTool(server, info.name, args);
    } catch (e) {
      return `MCP 工具执行失败：${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const found = findTool(name);
  if (!found) return `错误：未知工具 ${name}`;
  if (!states[found.plugin.id]?.enabled) return `错误：插件「${found.plugin.name}」已停用`;
  try {
    return await found.plugin.execute(name, args, states[found.plugin.id]?.config || {});
  } catch (e) {
    return `工具执行失败：${e instanceof Error ? e.message : String(e)}`;
  }
}
