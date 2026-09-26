import { useState } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AppSettings, ApprovalMode, McpServer } from '@/types';
import { testConnection } from '@/lib/api';
import { refreshMcpTools } from '@/lib/mcp';
import { uid } from '@/lib/store';

const PRESETS = [
  { name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2-0905-preview' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Ollama（本地）', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
];

const APPROVAL_OPTIONS: { value: ApprovalMode; label: string; desc: string }[] = [
  { value: 'auto', label: '全自动', desc: '所有工具调用直接执行，无需确认' },
  { value: 'writes', label: '写操作需批准（推荐）', desc: '读操作自动执行，写文件、发短信、MCP 等操作需你批准' },
  { value: 'all', label: '全部需批准', desc: '每一次工具调用都要你点头，最严格' },
];

interface SettingsViewProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  workspaceName: string | null;
  onPickWorkspace: () => Promise<void>;
}

export default function SettingsView({
  settings,
  setSettings,
  workspaceName,
  onPickWorkspace,
}: SettingsViewProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [wsError, setWsError] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpStatus, setMcpStatus] = useState<Record<string, string>>({});
  const [mcpBusy, setMcpBusy] = useState<Record<string, boolean>>({});

  const patch = (p: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...p }));

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const text = await testConnection(settings);
      setTestResult({ ok: true, text });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function pickWs() {
    setWsError('');
    try {
      await onPickWorkspace();
    } catch (e) {
      setWsError(e instanceof Error ? e.message : String(e));
    }
  }

  function addMcpServer() {
    if (!mcpName.trim() || !mcpUrl.trim()) return;
    const server: McpServer = {
      id: uid(),
      name: mcpName.trim(),
      url: mcpUrl.trim(),
      enabled: true,
    };
    patch({ mcpServers: [...settings.mcpServers, server] });
    setMcpName('');
    setMcpUrl('');
  }

  function patchServer(id: string, p: Partial<McpServer>) {
    patch({ mcpServers: settings.mcpServers.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  }

  async function probeServer(server: McpServer) {
    setMcpBusy((b) => ({ ...b, [server.id]: true }));
    setMcpStatus((s) => ({ ...s, [server.id]: '' }));
    try {
      const tools = await refreshMcpTools(server);
      setMcpStatus((s) => ({ ...s, [server.id]: `✅ 已连接，发现 ${tools.length} 个工具` }));
    } catch (e) {
      setMcpStatus((s) => ({
        ...s,
        [server.id]: `❌ ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      setMcpBusy((b) => ({ ...b, [server.id]: false }));
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-indigo-400" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">设置</h1>
            <p className="text-sm text-zinc-500">模型 API、审批模式、工作区与 MCP 服务器</p>
          </div>
        </div>

        {/* API */}
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">模型 API</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = settings.baseUrl === p.baseUrl;
              return (
                <button
                  key={p.name}
                  onClick={() => patch({ baseUrl: p.baseUrl, model: p.model })}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
                    active
                      ? 'border-indigo-600 bg-indigo-600/15 text-indigo-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">API 地址（Base URL）</Label>
            <Input
              value={settings.baseUrl}
              onChange={(e) => patch({ baseUrl: e.target.value })}
              placeholder="https://api.moonshot.cn/v1"
              className="border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">API Key</Label>
            <Input
              type="password"
              value={settings.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              密钥只保存在本机浏览器 localStorage，不会上传到任何服务器
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">模型名称</Label>
            <Input
              value={settings.model}
              onChange={(e) => patch({ model: e.target.value })}
              placeholder="kimi-k2-0905-preview"
              className="border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">
              温度（Temperature）：{settings.temperature.toFixed(1)}
            </Label>
            <Slider
              value={[settings.temperature]}
              onValueChange={([v]) => patch({ temperature: v })}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">
              推理强度（Reasoning Effort，仅推理模型生效）
            </Label>
            <div className="flex gap-2">
              {(
                [
                  ['off', '关闭'],
                  ['minimal', '极简'],
                  ['low', '低'],
                  ['medium', '中'],
                  ['high', '高'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => patch({ reasoningEffort: v })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] transition ${
                    settings.reasoningEffort === v
                      ? 'border-indigo-600 bg-indigo-600/15 text-indigo-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm text-zinc-300">
              系统提示词（支持 {'{{date}}'} {'{{time}}'} {'{{model}}'} 变量）
            </Label>
            <Textarea
              value={settings.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              rows={6}
              className="border-zinc-800 bg-zinc-950 text-sm text-zinc-100"
            />
          </div>
          <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
            <Button
              onClick={runTest}
              disabled={testing || !settings.baseUrl}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" />
              )}
              测试连接
            </Button>
            {testResult && (
              <span
                className={`flex items-center gap-1.5 text-sm ${
                  testResult.ok ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.text}
              </span>
            )}
          </div>
        </section>

        {/* approval mode */}
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            工具审批模式
          </h2>
          <div className="space-y-2">
            {APPROVAL_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => patch({ approvalMode: o.value })}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  settings.approvalMode === o.value
                    ? 'border-indigo-600 bg-indigo-600/10'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
                }`}
              >
                <div
                  className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    settings.approvalMode === o.value
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-zinc-600'
                  }`}
                />
                <div>
                  <div className="text-sm text-zinc-200">{o.label}</div>
                  <div className="text-xs text-zinc-500">{o.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* workspace */}
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <FolderOpen className="h-4 w-4 text-indigo-400" />
            工作区文件夹
          </h2>
          <p className="text-xs leading-relaxed text-zinc-500">
            绑定一个本地文件夹后，大模型可以用工作区文件插件在里面读写代码和文档（Codex
            式工作区）。出于浏览器安全限制，刷新页面后需要重新授权一次。
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={pickWs}
              variant="outline"
              className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {workspaceName ? '重新选择文件夹' : '选择文件夹'}
            </Button>
            {workspaceName && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                已绑定：{workspaceName}
              </span>
            )}
          </div>
          {wsError && <p className="text-xs text-red-400">{wsError}</p>}
        </section>

        {/* MCP servers */}
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Server className="h-4 w-4 text-indigo-400" />
            MCP 服务器
          </h2>
          <p className="text-xs leading-relaxed text-zinc-500">
            接入任何 MCP（Model Context Protocol）服务器，它的工具会自动出现在大模型的工具箱里。填写
            Streamable HTTP 地址（本地或远程均可，需允许跨域）。
          </p>

          {settings.mcpServers.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => patchServer(s.id, { enabled: v })}
                />
                <span className="text-sm font-medium text-zinc-200">{s.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500">
                  {s.url}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
                  title="连接并刷新工具列表"
                  disabled={mcpBusy[s.id]}
                  onClick={() => probeServer(s)}
                >
                  {mcpBusy[s.id] ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-zinc-500 hover:text-red-400"
                  onClick={() =>
                    patch({ mcpServers: settings.mcpServers.filter((x) => x.id !== s.id) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {mcpStatus[s.id] && (
                <p className="mt-1.5 pl-11 text-xs text-zinc-400">{mcpStatus[s.id]}</p>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
              placeholder="名称，例如 filesystem"
              className="h-9 border-zinc-800 bg-zinc-950 text-sm text-zinc-100"
            />
            <Input
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="http://127.0.0.1:3000/mcp"
              className="h-9 flex-1 border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
            <Button
              onClick={addMcpServer}
              disabled={!mcpName.trim() || !mcpUrl.trim()}
              className="h-9 bg-indigo-600 hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
