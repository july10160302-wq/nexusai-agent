import { useT } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Activity,
  PanelLeft,
  MoreHorizontal,
  SlidersHorizontal,
  SquarePen,
  Plus,
  ArrowUp,
  AtSign,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Copy,
  Download,
  GitBranch,
  ImagePlus,
  KeyRound,
  ListChecks,
  Loader2,
  Mic,
  Pencil,
  Puzzle,
  RotateCcw,
  Search,
  ShieldQuestion,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  AppSettings,
  Assistant,
  Attachment,
  ChatMessage,
  Conversation,
  PlanItem,
  PluginStates,
  TokenUsage,
  ToolCallRecord,
} from '@/types';
import {
  buildToolSchemas,
  executeTool,
  getMemories,
  needsApproval,
  PLUGINS,
  toolSourceName,
} from '@/lib/plugins';
import { refreshMcpTools } from '@/lib/mcp';
import { fsRead, fsWalk } from '@/lib/fs';
import { collapseDiff, diffLines, type DiffLine } from '@/lib/diff';
import { chatOnce, toApiMessages } from '@/lib/api';
import { expandPrompt, uid } from '@/lib/store';

/* ---------------- Markdown ---------------- */

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
 const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2">
      <pre
        className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 pr-10 text-[13px] leading-relaxed"
        {...props}
      />
      <button
        onClick={() => {
          void navigator.clipboard.writeText(extractText(props.children));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded bg-zinc-100 p-1 text-zinc-600 hover:text-zinc-800"
        title={t("复制代码")}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

const mdComponents = {
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => <CodeBlock {...props} />,
  code: (props: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isBlock = /language-/.test(props.className || '');
    return isBlock ? (
      <code className="text-emerald-700">{props.children}</code>
    ) : (
      <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] text-emerald-700">
        {props.children}
      </code>
    );
  },
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-zinc-700 underline underline-offset-2 hover:text-zinc-700"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props} />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-zinc-200 bg-zinc-100 px-2 py-1 text-left" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-zinc-200 px-2 py-1" {...props} />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-2 mt-3 text-lg font-bold" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-3 text-base font-bold" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-1.5 mt-2.5 text-sm font-bold" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="my-2 border-l-2 border-zinc-300 pl-3 text-zinc-600" {...props} />
  ),
};

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {text}
    </ReactMarkdown>
  );
}

/* ---------------- fs_write diff preview ---------------- */

function WriteDiffPreview({ argsJson }: { argsJson: string }) {
 const t = useT();
  const [diff, setDiff] = useState<(DiffLine | { type: 'gap' })[] | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = JSON.parse(argsJson || '{}');
        let old = '';
        try {
          old = await fsRead(String(p.path ?? ''));
        } catch {
          if (alive) setIsNew(true);
        }
        const d = collapseDiff(diffLines(old, String(p.content ?? '')), 2);
        if (alive) setDiff(d);
      } catch {
        if (alive) setDiff(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [argsJson]);

  if (!diff) return null;
  return (
    <div className="mb-2 max-h-48 overflow-auto rounded bg-white p-2 font-mono text-[11px] leading-relaxed">
      {isNew && <div className="mb-1 text-zinc-500">{t("（新文件）")}</div>}
      {diff.map((l, i) =>
        l.type === 'gap' ? (
          <div key={i} className="text-zinc-500">
            ⋮
          </div>
        ) : (
          <div
            key={i}
            className={
              l.type === 'add'
                ? 'whitespace-pre-wrap text-emerald-700'
                : l.type === 'del'
                  ? 'whitespace-pre-wrap text-red-700 line-through'
                  : 'whitespace-pre-wrap text-zinc-500'
            }
          >
            {l.type === 'add' ? '+ ' : l.type === 'del' ? '- ' : '  '}
            {l.text}
          </div>
        ),
      )}
    </div>
  );
}

/* ---------------- Tool call card ---------------- */

function ToolCallCard({
  tc,
  onResolve,
}: {
  tc: ToolCallRecord;
  onResolve: (id: string, ok: boolean) => void;
}) {
 const t = useT();
  const [open, setOpen] = useState(false);
  let prettyArgs = tc.args;
  try {
    prettyArgs = JSON.stringify(JSON.parse(tc.args), null, 2);
  } catch {
    /* keep raw */
  }
  return (
    <div
      className={`my-2 overflow-hidden rounded-lg border text-[13px] ${
        tc.status === 'pending'
          ? 'border-amber-700/60 bg-amber-50'
          : 'border-zinc-200 bg-zinc-50/70'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100/60"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        )}
        <Wrench className="h-3.5 w-3.5 shrink-0 text-zinc-700" />
        <span className="font-mono text-zinc-800">{tc.name}</span>
        <span className="hidden rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 sm:inline">
          {toolSourceName(tc.name)}
        </span>
        <span className="ml-auto shrink-0">
          {tc.status === 'pending' && <ShieldQuestion className="h-3.5 w-3.5 text-amber-700" />}
          {tc.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />}
          {tc.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />}
          {tc.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-700" />}
          {tc.status === 'rejected' && <XCircle className="h-3.5 w-3.5 text-zinc-500" />}
        </span>
      </button>

      {tc.status === 'pending' && (
        <div className="border-t border-amber-800/40 px-3 py-2">
          {tc.name === 'fs_write' && <WriteDiffPreview argsJson={tc.args} />}
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs text-amber-200/80">{t("此操作需要你的批准才会执行")}</span>
            <Button
              size="sm"
              className="h-7 bg-emerald-700 text-xs hover:bg-emerald-600"
              onClick={() => onResolve(tc.id, true)}
            >
              <Check className="mr-1 h-3 w-3" />{t("批准")}</Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-zinc-200 bg-transparent text-xs text-zinc-700 hover:bg-zinc-100"
              onClick={() => onResolve(tc.id, false)}
            >
              <X className="mr-1 h-3 w-3" />{t("拒绝")}</Button>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-2 border-t border-zinc-200 px-3 py-2">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{t("参数")}</div>
            <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-xs text-zinc-700">
              {prettyArgs}
            </pre>
          </div>
          {tc.result !== undefined && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{t("结果")}</div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-xs text-zinc-700">
                {tc.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- constants ---------------- */

const MODEL_SUGGESTIONS: [string, string[]][] = [
  ['api.moonshot.cn', ['kimi-k2-0905-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']],
  ['api.deepseek.com', ['deepseek-chat', 'deepseek-reasoner']],
  ['api.openai.com', ['gpt-4o', 'gpt-4o-mini', 'o4-mini']],
  ['open.bigmodel.cn', ['glm-4-flash', 'glm-4-plus', 'glm-4.5']],
  ['dashscope.aliyuncs.com', ['qwen-plus', 'qwen-turbo', 'qwen-max']],
  ['localhost:11434', ['llama3.1', 'qwen3', 'deepseek-r1']],
];

const COMMANDS = [
  { cmd: '/new', desc: '新建对话' },
  { cmd: '/clear', desc: '清空当前对话' },
  { cmd: '/export', desc: '导出为 Markdown' },
  { cmd: '/plan', desc: '让 AI 制定任务计划' },
  { cmd: '/compact', desc: '压缩对话历史，释放上下文' },
];

const ALL_PLUGIN_IDS = [...PLUGINS.map((p) => p.id), 'mcp'];

const VOICE_SUPPORTED =
  typeof window !== 'undefined' &&
  Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
  );

/* ---------------- Chat view ---------------- */

interface ChatViewProps {
  conversation: Conversation | null;
  onUpdate: (id: string, updater: (c: Conversation) => Conversation) => void;
  onCreate: (init?: { title?: string; messages?: ChatMessage[] }) => string;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  pluginStates: PluginStates;
  assistant: Assistant | null;
  onUpdateAssistant: (id: string, patch: Partial<Assistant>) => void;
  goSettings: () => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

export default function ChatView({
  conversation,
  onUpdate,
  onCreate,
  settings,
  setSettings,
  pluginStates,
  assistant,
  onUpdateAssistant,
  goSettings,
  onToggleSidebar,
  onNewChat,
}: ChatViewProps) {
 const t = useT();
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showReasoningPicker, setShowReasoningPicker] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(timer);
  }, [running]);
  const [planOpen, setPlanOpen] = useState(true);
  const [showPluginPicker, setShowPluginPicker] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionFiles, setMentionFiles] = useState<string[] | null>(null);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionError, setMentionError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningConversationRef = useRef<string | null>(null);
  const approvalResolvers = useRef(new Map<string, (ok: boolean) => void>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = inputRef.current;
    if (field) { field.style.height = 'auto'; field.style.height = Math.min(160, field.scrollHeight) + 'px'; }
  }, [input]);
  const recRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => {
    abortRef.current?.abort();
    approvalResolvers.current.forEach(resolve => resolve(false));
    approvalResolvers.current.clear();
  }, []);
  useEffect(() => {
    if (runningConversationRef.current && runningConversationRef.current !== conversation?.id) {
      abortRef.current?.abort();
      approvalResolvers.current.forEach(resolve => resolve(false));
      approvalResolvers.current.clear();
    }
  }, [conversation?.id]);
  const msgEls = useRef(new Map<string, HTMLDivElement>());

  const messages = conversation?.messages ?? [];
  const plan = conversation?.plan ?? [];
  const enabledCount = Object.values(pluginStates).filter((p) => p.enabled).length;
  const apiReady = Boolean(settings.baseUrl && settings.model);
  const effModel = assistant?.model || settings.model;

  const suggestions =
    MODEL_SUGGESTIONS.find(([h]) => settings.baseUrl.includes(h))?.[1] ?? [];
  const modelOptions = Array.from(new Set([effModel, 'gpt-6.1-sol', ...suggestions].filter(Boolean)));

  const cmdMatches =
    input.startsWith('/') && !input.includes(' ')
      ? COMMANDS.filter((c) => c.cmd.startsWith(input.trim()))
      : [];

  const visibleMessages = messages.filter((m) => m.role !== 'tool');
  const activityEvents = messages.flatMap((m) =>
    m.role === 'assistant' && m.toolCalls?.length
      ? m.toolCalls.map((tc) => ({ ...tc, msgId: m.id, ts: m.timestamp }))
      : [],
  );
  const searchMatches = searchQuery.trim()
    ? visibleMessages
        .filter((m) => m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .map((m) => m.id)
    : [];
  const currentMatchId = searchMatches.length
    ? searchMatches[Math.min(searchIdx, searchMatches.length - 1)]
    : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && running) stop();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* ---------- search ---------- */

  function jumpToMatch(i: number) {
    if (!searchMatches.length) return;
    const idx = ((i % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setSearchIdx(idx);
    msgEls.current.get(searchMatches[idx])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- approval ---------- */

  function requestApproval(tcId: string) {
    return new Promise<boolean>((resolve) => {
      approvalResolvers.current.set(tcId, resolve);
    });
  }

  function resolveApproval(tcId: string, ok: boolean) {
    approvalResolvers.current.get(tcId)?.(ok);
    approvalResolvers.current.delete(tcId);
  }

  function stop() {
    abortRef.current?.abort();
    approvalResolvers.current.forEach((r) => r(false));
    approvalResolvers.current.clear();
  }

  /* ---------- agent loop ---------- */

  function buildAgentConfig() {
    const effSettings: AppSettings = {
      ...settings,
      model: effModel,
      temperature: assistant?.temperature ?? settings.temperature,
    };
    const mems = getMemories();
    const sysPrompt =
      expandPrompt(assistant?.systemPrompt || settings.systemPrompt, effModel) + (settings.locale === 'en' ? '\nRespond in English. Only use tools provided in this request. Never claim an action succeeded without a tool result.' : '\n使用中文回答。仅使用当前请求提供的工具，未得到工具结果时不得声称执行成功。') +
      (mems.length ? `\n\n【长期记忆】\n${mems.map((m) => `- ${m}`).join('\n')}` : '');
    return { effSettings, sysPrompt };
  }

  function updatePlanFromArgs(convId: string, argsJson: string): string {
    try {
      const parsed = JSON.parse(argsJson || '{}');
      const raw = Array.isArray(parsed.items) ? parsed.items : [];
      const items: PlanItem[] = raw.map((it: unknown) => {
        if (typeof it === 'string') return { id: uid(), text: it, done: false };
        const o = it as Record<string, unknown>;
        return { id: uid(), text: String(o.text ?? ''), done: Boolean(o.done) };
      });
      onUpdate(convId, (c) => ({ ...c, plan: items }));
      setPlanOpen(true);
      return `计划已更新（${items.length} 项）`;
    } catch {
      return '错误：计划参数不是合法 JSON';
    }
  }

  async function agentLoop(convId: string, startHistory: ChatMessage[], pluginFilter?: string[]) {
    const signal = abortRef.current!.signal;
    if (settings.chatMode === 'agent') {
      setPhase(t('正在连接工具', 'Connecting tools'));
      const results = await Promise.allSettled(settings.mcpServers.filter(s => s.enabled).map(s => refreshMcpTools(s, true, signal)));
      signal.throwIfAborted();
      const errors = results.filter(r => r.status === 'rejected');
      if (errors.length) throw new Error(t('部分 MCP 无法连接，请检查设备或在设置中停用。', 'Some MCP servers could not connect. Check your devices or disable them in Settings.'));
    }
    const { effSettings, sysPrompt } = buildAgentConfig();
    const tools = settings.chatMode === 'agent' ? buildToolSchemas(
      pluginStates, settings.mcpServers,
      pluginFilter ?? (assistant?.pluginIds.length ? assistant.pluginIds : undefined),
    ) : [];
    let history = startHistory;

    for (let round = 0; round < settings.maxToolRounds; round++) {
      signal.throwIfAborted();
      const asstId = uid();
      onUpdate(convId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: asstId, role: 'assistant', content: '', toolCalls: [], timestamp: Date.now() },
        ],
      }));

      const { content, toolCalls, usage } = await chatOnce({
        settings: effSettings,
        messages: toApiMessages(history, sysPrompt),
        tools,
        signal,
        onPhase: value => setPhase(t(({ connecting: '连接中', receiving: '接收中', reasoning: '模型正在推理', streaming: '正在回复' })[value])),
        onDelta: (t) =>
          onUpdate(convId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === asstId ? { ...m, content: m.content + t } : m,
            ),
          })),
      });

      if (usage) setLastUsage(usage);

      const asstMsg: ChatMessage = {
        id: asstId,
        role: 'assistant',
        content,
        toolCalls: toolCalls.map((tc) => ({ ...tc, status: 'running' as const })),
        timestamp: Date.now(),
        usage,
      };
      history = [...history, asstMsg];

      if (!toolCalls.length) {
        onUpdate(convId, (c) => ({
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === asstId ? { ...m, toolCalls: undefined, usage } : m,
          ),
        }));
        if (startHistory.length === 1) onUpdate(convId, c => ({ ...c, title: startHistory[0].content.slice(0, 36) || c.title }));
        return;
      }

      onUpdate(convId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === asstId
            ? { ...m, toolCalls: toolCalls.map((tc) => ({ ...tc, status: 'running' as const })) }
            : m,
        ),
      }));

      for (const tc of toolCalls) {
        signal.throwIfAborted();
        let result = '';
        let status: ToolCallRecord['status'] = 'done';
        let approved = true;

        if (needsApproval(tc.name, settings.approvalMode)) {
          onUpdate(convId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    toolCalls: m.toolCalls?.map((t) =>
                      t.id === tc.id ? { ...t, status: 'pending' } : t,
                    ),
                  }
                : m,
            ),
          }));
          setPhase(t('等待批准', 'Waiting for approval'));
          approved = await requestApproval(tc.id);
          signal.throwIfAborted();
        }

        if (!approved) {
          result = '用户拒绝了这次工具调用';
          status = 'rejected';
        } else {
          onUpdate(convId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    toolCalls: m.toolCalls?.map((t) =>
                      t.id === tc.id ? { ...t, status: 'running' } : t,
                    ),
                  }
                : m,
            ),
          }));
          signal.throwIfAborted();
          setPhase(t('正在执行工具', 'Running tool') + ': ' + tc.name);
          result =
            tc.name === 'plan_update'
              ? updatePlanFromArgs(convId, tc.args)
              : await executeTool(tc.name, tc.args, pluginStates, settings.mcpServers);
          if (result.startsWith('错误') || result.includes('执行失败')) status = 'error';
        }

        onUpdate(convId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  toolCalls: m.toolCalls?.map((t) =>
                    t.id === tc.id ? { ...t, result, status } : t,
                  ),
                }
              : m,
          ),
        }));

        const toolMsg: ChatMessage = {
          id: uid(),
          role: 'tool',
          toolCallId: tc.id,
          name: tc.name,
          content: result,
          timestamp: Date.now(),
        };
        history = [...history, toolMsg];
        onUpdate(convId, (c) => ({ ...c, messages: [...c.messages, toolMsg] }));
      }
    }
    throw new Error(t('已达到本轮工具次数上限，可发送消息继续。', 'Tool round limit reached. Send a message to continue.'));
  }

  async function runAgent(convId: string, history: ChatMessage[], pluginFilter?: string[]) {
    runningConversationRef.current = convId;
    setRunning(true);
    setElapsed(0);
    setPhase(t('连接中'));
    abortRef.current = new AbortController();
    try {
      await agentLoop(convId, history, pluginFilter);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? t('⏹ 已停止生成', '⏹ Generation stopped')
          : `⚠️ ${e instanceof Error ? e.message : String(e)}`;
      onUpdate(convId, (c) => ({
        ...c,
        messages: c.messages.some(m => m.role === 'assistant' && !m.content && !m.toolCalls?.length)
          ? c.messages.map(m => m.role === 'assistant' && !m.content && !m.toolCalls?.length ? { ...m, content: msg } : m)
          : [...c.messages, { id: uid(), role: 'assistant', content: msg, timestamp: Date.now() }],
      }));
    } finally {
      runningConversationRef.current = null;
      setRunning(false);
      setPhase('');
      abortRef.current = null;
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('NexusAI 任务完成', { body: '智能体已完成本轮工作' });
      }
    }
  }

  /* ---------- user actions ---------- */

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && !attachments.length) || running) return;
    let convId = conversation?.id;
    if (!convId) convId = onCreate();

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments.length ? attachments : undefined,
    };
    onUpdate(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? (content || '图片对话').slice(0, 24) : c.title,
      messages: [...c.messages, userMsg],
      updatedAt: Date.now(),
    }));
    setInput('');
    setAttachments([]);
    await runAgent(convId, [...(conversation?.messages ?? []), userMsg], conversation?.pluginFilter);
  }

  function branchFrom(msgId: string) {
    if (!conversation || running) return;
    const idx = conversation.messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    onCreate({
      title: `${conversation.title}（分支）`,
      messages: conversation.messages.slice(0, idx + 1),
    });
  }

  function regenerate(asstId: string) {
    if (!conversation || running) return;
    const idx = conversation.messages.findIndex((m) => m.id === asstId);
    if (idx <= 0) return;
    const hist = conversation.messages.slice(0, idx);
    onUpdate(conversation.id, (c) => ({ ...c, messages: hist }));
    void runAgent(conversation.id, hist, conversation.pluginFilter);
  }

  function startEdit(m: ChatMessage) {
    setEditingId(m.id);
    setEditText(m.content);
  }

  function saveEdit(msgId: string) {
    if (!conversation || running || !editText.trim()) return;
    const idx = conversation.messages.findIndex((x) => x.id === msgId);
    if (idx < 0) return;
    const edited: ChatMessage = { ...conversation.messages[idx], content: editText.trim() };
    const hist = [...conversation.messages.slice(0, idx), edited];
    onUpdate(conversation.id, (c) => ({ ...c, messages: hist }));
    setEditingId(null);
    void runAgent(conversation.id, hist, conversation.pluginFilter);
  }

  function copyMessage(m: ChatMessage) {
    void navigator.clipboard.writeText(m.content);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleVoice() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onend: () => void;
          onerror: () => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;
    if (!SR) {
      alert('当前浏览器不支持语音输入（Chrome/Edge 支持）');
      return;
    }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  async function compactHistory() {
    if (!conversation || running || !conversation.messages.length) return;
    setRunning(true);
    try {
      const { effSettings, sysPrompt } = buildAgentConfig();
      const { content } = await chatOnce({
        settings: effSettings,
        messages: [
          ...toApiMessages(conversation.messages, sysPrompt),
          {
            role: 'user',
            content:
              '请用 300 字以内总结以上对话的关键信息（目标、结论、用户偏好、待办事项），供后续继续对话使用。',
          },
        ],
        tools: [],
        onDelta: () => undefined,
      });
      onUpdate(conversation.id, (c) => ({
        ...c,
        plan: undefined,
        messages: [
          { id: uid(), role: 'user', content: `【前情摘要】${content}`, timestamp: Date.now() },
        ],
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function runCommand(cmd: string) {
    setInput('');
    switch (cmd) {
      case '/new':
        onCreate();
        break;
      case '/export':
        exportMarkdown();
        break;
      case '/clear':
        if (conversation) onUpdate(conversation.id, (c) => ({ ...c, messages: [], plan: undefined }));
        break;
      case '/plan':
        void send('请先用 plan_update 为接下来的任务制定一个分步计划，然后等我确认再执行。');
        break;
      case '/compact':
        void compactHistory();
        break;
    }
  }

  function addImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('图片不能超过 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setAttachments((list) => [...list, { name: file.name, dataUrl: String(reader.result) }]);
    reader.readAsDataURL(file);
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) addImageFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) addImageFile(file);
  }

  async function openMention() {
    setShowMention(true);
    setMentionFilter('');
    setMentionError('');
    try {
      setMentionFiles(await fsWalk(3, 300));
    } catch (e) {
      setMentionFiles(null);
      setMentionError(e instanceof Error ? e.message : String(e));
    }
  }

  async function pickMention(path: string) {
    setShowMention(false);
    try {
      const content = await fsRead(path);
      setInput(
        (prev) =>
          `${prev}${prev.trim() ? '\n' : ''}【文件 ${path}】\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\`\n`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function exportMarkdown() {
    if (!conversation) return;
    const lines: string[] = [
      `# ${conversation.title}`,
      '',
      `> 导出时间：${new Date().toLocaleString('zh-CN')} · NexusAI`,
      '',
    ];
    for (const m of conversation.messages) {
      if (m.role === 'user') {
        lines.push('## 👤 用户', '', m.content, '');
      } else if (m.role === 'assistant') {
        lines.push('## 🤖 助手', '');
        if (m.toolCalls?.length) {
          for (const tc of m.toolCalls) lines.push(`- 🔧 \`${tc.name}\`（${tc.status}）`);
          lines.push('');
        }
        if (m.content) lines.push(m.content, '');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title || '对话'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleConvPlugin(pid: string) {
    if (!conversation) return;
    onUpdate(conversation.id, (c) => {
      const cur = c.pluginFilter ?? ALL_PLUGIN_IDS;
      const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
      return { ...c, pluginFilter: next };
    });
  }

  const convFilter = conversation?.pluginFilter;
  const pluginOn = (pid: string) => (convFilter ?? ALL_PLUGIN_IDS).includes(pid);
  const doneCount = plan.filter((p) => p.done).length;

  return (
    <div className={'nexus-chat relative flex h-full min-h-0 flex-col' + (messages.length ? '' : ' is-empty')}>
      <div className="nexus-chat-header relative flex h-16 shrink-0 items-center gap-2 px-4">
        <button className="nexus-icon-button" onClick={onToggleSidebar} aria-label={t('打开侧栏','Open sidebar')}><PanelLeft size={20}/></button>
        <span className="px-2 text-lg font-semibold tracking-tight">NexusAI</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="nexus-icon-button" onClick={onNewChat} disabled={running} aria-label={t('新建对话')}><SquarePen size={20}/></button>
          <button className="nexus-icon-button" aria-label={t('对话选项','Chat options')} aria-expanded={showHeaderMenu} onClick={()=>setShowHeaderMenu(v=>!v)}><MoreHorizontal size={21}/></button>
        </div>
        {showHeaderMenu && <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label={t('关闭菜单','Close menu')} onClick={()=>setShowHeaderMenu(false)}/>
          <div className="nexus-popover absolute right-4 top-14 z-20 w-56 p-2">
            <button className="nexus-menu-item" disabled={!messages.length} onClick={()=>{setSearchOpen(v=>!v);setShowHeaderMenu(false)}}><Search size={16}/>{t('搜索对话内容')}</button>
            <button className="nexus-menu-item" onClick={()=>{setShowActivity(true);setShowHeaderMenu(false)}}><Activity size={16}/>{t('活动日志')}</button>
            <button className="nexus-menu-item" onClick={()=>{if(!conversation)onCreate();setShowPluginPicker(true);setShowHeaderMenu(false)}}><Puzzle size={16}/>{t('本对话可用插件')}<span className="ml-auto text-xs text-zinc-400">{enabledCount}</span></button>
            <button className="nexus-menu-item" disabled={!messages.length} onClick={()=>{exportMarkdown();setShowHeaderMenu(false)}}><Download size={16}/>{t('导出为 Markdown')}</button>
          </div>
        </>}
        {/* plugin picker dropdown */}
        {showPluginPicker && conversation && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPluginPicker(false)} />
            <div className="absolute right-3 top-full z-20 mt-1 w-60 rounded-xl border border-zinc-200 bg-zinc-50 p-2 shadow-xl">
              <div className="mb-1 flex items-center justify-between px-2 py-1">
                <span className="text-xs text-zinc-600">{t("本对话可用插件")}</span>
                <button
                  className="text-[11px] text-zinc-700 hover:underline"
                  onClick={() => onUpdate(conversation.id, (c) => ({ ...c, pluginFilter: undefined }))}
                >{t("重置")}</button>
              </div>
              {[...PLUGINS.map((p) => ({ id: p.id, name: p.name })), { id: 'mcp', name: 'MCP 服务器工具' }].map(
                (p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleConvPlugin(p.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        pluginOn(p.id) ? 'border-zinc-400 bg-zinc-900' : 'border-zinc-300'
                      }`}
                    >
                      {pluginOn(p.id) && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {t(p.name)}
                  </button>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 sm:px-5">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') jumpToMatch(searchIdx + (e.shiftKey ? -1 : 0));
            }}
            placeholder={t("搜索对话内容，Enter 跳转…")}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500"
          />
          <span className="shrink-0 text-xs text-zinc-500">
            {searchMatches.length ? `${Math.min(searchIdx + 1, searchMatches.length)}/${searchMatches.length}` : '0/0'}
          </span>
          <button onClick={() => jumpToMatch(searchIdx - 1)} className="p-1 text-zinc-600 hover:text-zinc-800">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button onClick={() => jumpToMatch(searchIdx + 1)} className="p-1 text-zinc-600 hover:text-zinc-800">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            className="p-1 text-zinc-600 hover:text-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="nexus-messages min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        {!apiReady && (
          <div className="mx-auto mb-4 flex max-w-xl items-center gap-3 rounded-xl border border-amber-900/50 bg-amber-50 px-4 py-3 text-sm text-amber-200">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>{t("还没有配置大模型 API。")}</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto border-amber-700 bg-transparent text-amber-200 hover:bg-amber-50"
              onClick={goSettings}
            >{t("去设置")}</Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="nexus-welcome mx-auto max-w-3xl text-center"><h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{t('今天想做些什么？')}</h1></div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8 pb-6">
            {visibleMessages.map((m) => (
              <div
                key={m.id}
                ref={(el) => {
                  if (el) msgEls.current.set(m.id, el);
                }}
                className={currentMatchId === m.id ? 'rounded-xl ring-2 ring-zinc-400' : ''}
              >
                {m.role === 'user' ? (
                  <div className="group flex flex-col items-end">
                    {editingId === m.id ? (
                      <div className="w-full max-w-[85%] sm:max-w-[80%]">
                        <Textarea
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="border-zinc-400 bg-zinc-50 text-sm text-zinc-900"
                        />
                        <div className="mt-1.5 flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-zinc-200 bg-transparent text-xs text-zinc-700 hover:bg-zinc-100"
                            onClick={() => setEditingId(null)}
                          >{t("取消")}</Button>
                          <Button
                            size="sm"
                            className="h-7 bg-zinc-900 text-xs hover:bg-zinc-900"
                            onClick={() => saveEdit(m.id)}
                          >{t("保存并重新生成")}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[80%]">
                        {m.attachments?.map((a, i) => (
                          <img key={i} src={a.dataUrl} alt={t(a.name)} className="mb-2 max-h-48 rounded-lg" />
                        ))}
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                    )}
                    {editingId !== m.id && (
                      <div className="mt-1 flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(m)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          title={t("编辑并重新生成")}
                        >
                          <Pencil className="h-3 w-3" />{t("编辑")}</button>
                        <button
                          onClick={() => branchFrom(m.id)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          title={t("从这里分支新对话")}
                        >
                          <GitBranch className="h-3 w-3" />{t("分支")}</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="group flex gap-3">
                    <div className="nexus-assistant-message min-w-0 flex-1 text-[15px] leading-7 text-zinc-800">
                      {m.toolCalls?.map((tc) => (
                        <ToolCallCard key={tc.id} tc={tc} onResolve={resolveApproval} />
                      ))}
                      {m.content ? (
                        <Markdown text={m.content} />
                      ) : (
                        !m.toolCalls?.length && (running && m.id === visibleMessages.at(-1)?.id ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : <span className="text-zinc-500">{t('回复已中断，请重试', 'Response interrupted. Please retry.')}</span>)
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {m.usage && (
                          <span className="text-[11px] text-zinc-500">
                            tokens ↑{m.usage.prompt} ↓{m.usage.completion}
                          </span>
                        )}
                        <span className="flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                          <button
                            onClick={() => copyMessage(m)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                            title={t("复制内容")}
                          >
                            {copiedId === m.id ? (
                              <Check className="h-3 w-3 text-emerald-700" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}{t("复制")}</button>
                          <button
                            onClick={() => regenerate(m.id)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                            title={t("重新生成")}
                          >
                            <RotateCcw className="h-3 w-3" />{t("重新生成")}</button>
                          <button
                            onClick={() => branchFrom(m.id)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                            title={t("从这里分支新对话")}
                          >
                            <GitBranch className="h-3 w-3" />{t("分支")}</button>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* plan panel */}
      {plan.length > 0 && (
        <div className="border-t border-zinc-200 px-3 sm:px-5">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={() => setPlanOpen(!planOpen)}
              className="flex w-full items-center gap-2 py-2 text-xs text-zinc-600 hover:text-zinc-800"
            >
              <ListChecks className="h-3.5 w-3.5 text-zinc-700" />
              <span>{t("任务计划")}{doneCount}/{plan.length}
              </span>
              <span className="ml-auto">
                {planOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            </button>
            {planOpen && (
              <div className="space-y-1 pb-2">
                {plan.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-[13px]">
                    {p.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                    ) : (
                      <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-300" />
                    )}
                    <span className={p.done ? 'text-zinc-500 line-through' : 'text-zinc-700'}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* input */}
      <div
        className={`nexus-composer border-t px-3 py-3 sm:px-5 ${isDragging ? 'border-zinc-400 bg-zinc-100/20' : 'border-zinc-200'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="relative mx-auto max-w-3xl">
          {/* slash command palette */}
          {cmdMatches.length > 0 && (
            <div className="absolute bottom-full mb-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 shadow-xl">
              {cmdMatches.map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => runCommand(c.cmd)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                >
                  <span className="font-mono text-sm text-zinc-700">{c.cmd}</span>
                  <span className="text-xs text-zinc-500">{c.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* @ mention popup */}
          {showMention && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMention(false)} />
              <div className="absolute bottom-full z-20 mb-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2 shadow-xl">
                <Input
                  autoFocus
                  value={mentionFilter}
                  onChange={(e) => setMentionFilter(e.target.value)}
                  placeholder={t("搜索工作区文件…")}
                  className="mb-1.5 h-8 border-zinc-200 bg-white text-xs text-zinc-900"
                />
                <div className="max-h-48 overflow-y-auto">
                  {mentionError && <p className="px-2 py-1.5 text-xs text-amber-700">{mentionError}</p>}
                  {mentionFiles === null && !mentionError && (
                    <p className="px-2 py-1.5 text-xs text-zinc-500">{t("加载中…")}</p>
                  )}
                  {mentionFiles
                    ?.filter((f) => f.toLowerCase().includes(mentionFilter.toLowerCase()))
                    .slice(0, 50)
                    .map((f) => (
                      <button
                        key={f}
                        onClick={() => pickMention(f)}
                        className="block w-full truncate rounded-lg px-2 py-1.5 text-left font-mono text-xs text-zinc-700 hover:bg-zinc-100"
                      >
                        {f}
                      </button>
                    ))}
                  {mentionFiles?.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-zinc-500">{t("工作区暂无文件")}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  <img src={a.dataUrl} alt={t(a.name)} className="h-14 rounded-lg border border-zinc-200" />
                  <button
                    onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-200 p-0.5 text-zinc-700 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
            <div className="relative">
              <button className="nexus-icon-button" aria-label={t('添加附件与工具','Add attachments & tools')} aria-expanded={showAttachMenu} onClick={()=>setShowAttachMenu(v=>!v)}><Plus size={22}/></button>
              {showAttachMenu && <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label={t('关闭菜单','Close menu')} onClick={()=>setShowAttachMenu(false)}/>
                <div className="nexus-popover absolute bottom-full left-0 z-20 mb-3 w-60 p-2">
                  <button className="nexus-menu-item" onClick={()=>{setShowAttachMenu(false);fileRef.current?.click()}}><ImagePlus size={17}/>{t('添加图片','Attach image')}</button>
                  <button className="nexus-menu-item" onClick={()=>{setShowAttachMenu(false);void openMention()}}><AtSign size={17}/>{t('引用工作区文件')}</button>
                  <button className="nexus-menu-item" onClick={()=>{setShowAttachMenu(false);if(!conversation)onCreate();setShowPluginPicker(true)}}><Puzzle size={17}/>{t('本对话可用插件')}</button>
            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-3 text-sm text-zinc-600"><Wrench size={14}/><select aria-label={t('对话模式','Chat mode')} value={settings.chatMode} disabled={running} className="max-w-24 bg-transparent outline-none" onChange={e=>setSettings(v=>({...v,chatMode:e.target.value as 'chat'|'agent'}))}><option value="chat">{t('聊天')}</option><option value="agent">{t('智能体')}</option></select></div>
                </div>
              </>}
            </div>
        <div className="relative">
          <button className="nexus-composer-control" disabled={running} aria-label={t('选择模型','Choose model')} aria-expanded={showModelPicker} onClick={()=>setShowModelPicker(v=>!v)} title={effModel}><span className="max-w-[105px] truncate">{effModel}</span><ChevronDown size={16} className="text-zinc-400"/></button>
          {showModelPicker && <>
            <button className="fixed inset-0 z-10 cursor-default" aria-label={t('关闭模型菜单','Close model menu')} onClick={()=>setShowModelPicker(false)}/>
            <div className="nexus-model-popover nexus-popover absolute left-0 bottom-full z-20 mb-3 w-72 space-y-3 p-4">
              <label className="block text-xs font-medium text-zinc-500">{t('模型名称')}<input autoFocus aria-label={t('模型名称')} className="nexus-input mt-2 text-sm" list="nexus-model-options" value={effModel} disabled={running} onChange={e=>{if(assistant?.model)onUpdateAssistant(assistant.id,{model:e.target.value});else setSettings(v=>({...v,model:e.target.value}))}}/></label>
              <datalist id="nexus-model-options">{modelOptions.map(m=><option key={m} value={m}/>)}</datalist>
              <div className="max-h-48 overflow-y-auto">{modelOptions.map(m=><button key={m} disabled={running} className="nexus-menu-item" onClick={()=>{if(assistant?.model)onUpdateAssistant(assistant.id,{model:m});else setSettings(v=>({...v,model:m}));setShowModelPicker(false)}}><span className="min-w-0 flex-1 truncate">{m}</span>{m===effModel&&<Check size={16}/>}</button>)}</div>
              <button className="w-full border-t border-zinc-100 pt-3 text-left text-xs text-zinc-500" onClick={goSettings}>{t('管理 API 与模型','Manage API & models')}</button>
            </div>
          </>}
        </div>
            <div className="relative">
              <button className="nexus-composer-control" disabled={running} aria-label={t('推理强度','Reasoning effort')} aria-expanded={showReasoningPicker} onClick={()=>{setShowReasoningPicker(v=>!v);setShowModelPicker(false)}}><SlidersHorizontal size={15}/><span>{settings.reasoningEffort==='off' ? t('思考','Think') : t(({off:'默认',minimal:'极简',low:'低',medium:'中',high:'高'})[settings.reasoningEffort])}</span><ChevronDown size={12}/></button>
              {showReasoningPicker && <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label={t('关闭强度菜单','Close effort menu')} onClick={()=>setShowReasoningPicker(false)}/>
                <div className="nexus-popover absolute bottom-full right-0 z-20 mb-3 w-56 p-2" role="menu" aria-label={t('推理强度','Reasoning effort')}>
                  <p className="px-3 py-2 text-xs text-zinc-400">{t('推理强度 · 仅限支持的模型','Reasoning effort · Supported models only')}</p>
                  {([['off','默认','Default'],['minimal','极简','Minimal'],['low','低','Low'],['medium','中','Medium'],['high','高','High']] as const).map(([value,zh,en])=><button key={value} className="nexus-menu-item" role="menuitemradio" aria-checked={settings.reasoningEffort===value} onClick={()=>{setSettings(v=>({...v,reasoningEffort:value}));setShowReasoningPicker(false)}}><span className="flex-1">{t(zh,en)}</span>{settings.reasoningEffort===value&&<Check size={15}/>}</button>)}
                </div>
              </>}
            </div>

            <div className="flex-1"/>
            <Textarea
              ref={inputRef}
              aria-label={t('消息','Message')}
              enterKeyHint="send"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  const trimmed = input.trim();
                  if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
                    const m = COMMANDS.filter((c) => c.cmd.startsWith(trimmed));
                    if (m.length) {
                      runCommand(m[0].cmd);
                      return;
                    }
                  }
                  send();
                }
              }}
              placeholder={recording ? t('正在聆听…') : t('向 NexusAI 提问','Message NexusAI')}
              className="max-h-40 min-h-[44px] flex-1 resize-none border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              rows={1}
            />
            {VOICE_SUPPORTED && (
              <Button
                size="icon"
                variant="outline"
                className={`h-11 w-11 shrink-0 border-zinc-200 bg-zinc-50 hover:bg-zinc-100 ${
                  recording ? 'animate-pulse text-red-700' : 'text-zinc-600 hover:text-zinc-800'
                }`}
                title={t(recording ? '停止语音输入' : '语音输入')}
                onClick={toggleVoice}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            {running ? (
              <Button
                size="icon"
                variant="outline"
                className="h-11 w-11 shrink-0 border-zinc-200 bg-zinc-50 text-red-700 hover:bg-zinc-100"
                title={t("停止（Esc）")}
                onClick={stop}
              >
                <CircleStop className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-11 w-11 shrink-0 bg-zinc-900 hover:bg-zinc-900"
                aria-label={t('发送消息', 'Send message')}
                onClick={() => send()}
                disabled={!input.trim() && !attachments.length}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="mx-auto mt-3 max-w-3xl text-center text-[11px] text-zinc-400">{running ? phase+' · '+elapsed.toFixed(1)+'s' : t('重要结果请核实，工具操作请先审阅。','Verify important results and review tool actions.')}{lastUsage && !running ? ' · ↑'+lastUsage.prompt+' ↓'+lastUsage.completion : ''}</p>
      </div>

      {/* activity drawer */}
      {showActivity && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setShowActivity(false)}
          />
          <div className="absolute inset-y-0 right-0 z-30 flex w-80 max-w-[85vw] flex-col border-l border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
              <Activity className="h-4 w-4 text-zinc-700" />
              <span className="text-sm font-medium text-zinc-800">{t("活动日志")}</span>
              <span className="text-xs text-zinc-500">{activityEvents.length}{t("次工具调用")}</span>
              <button
                className="ml-auto text-zinc-500 hover:text-zinc-700"
                onClick={() => setShowActivity(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {activityEvents.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-zinc-500">{t("本轮还没有工具活动")}</p>
              ) : (
                <div className="space-y-2">
                  {activityEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() =>
                        msgEls.current.get(ev.msgId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5 text-left transition hover:border-zinc-300"
                    >
                      <div className="flex items-center gap-2">
                        {ev.status === 'done' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        ) : ev.status === 'error' ? (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-700" />
                        ) : ev.status === 'rejected' ? (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-700" />
                        )}
                        <span className="font-mono text-xs text-zinc-800">{ev.name}</span>
                        <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500">
                          {toolSourceName(ev.name)}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
                          {new Date(ev.ts).toLocaleTimeString('zh-CN', { hour12: false })}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">
                        {ev.args}
                      </div>
                      {ev.result && (
                        <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] text-zinc-500">
                          {ev.result}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
