import { useState } from 'react';
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { Assistant } from '@/types';
import { PLUGINS } from '@/lib/plugins';
import { uid } from '@/lib/store';

interface AssistantsViewProps {
  assistants: Assistant[];
  setAssistants: React.Dispatch<React.SetStateAction<Assistant[]>>;
  activeId: string;
  setActiveId: (id: string) => void;
}

const EMPTY: Omit<Assistant, 'id'> = {
  name: '',
  emoji: '✨',
  systemPrompt: '',
  model: '',
  temperature: null,
  pluginIds: [],
};

export default function AssistantsView({
  assistants,
  setAssistants,
  activeId,
  setActiveId,
}: AssistantsViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Assistant, 'id'>>(EMPTY);

  function startEdit(a?: Assistant) {
    if (a) {
      const { id: _id, ...rest } = a;
      setDraft(rest);
      setEditingId(a.id);
    } else {
      setDraft(EMPTY);
      setEditingId('__new__');
    }
  }

  function save() {
    if (!draft.name.trim()) return;
    if (editingId === '__new__') {
      const a: Assistant = { id: uid(), ...draft, name: draft.name.trim() };
      setAssistants((list) => [...list, a]);
      setActiveId(a.id);
    } else if (editingId) {
      setAssistants((list) =>
        list.map((a) => (a.id === editingId ? { ...a, ...draft, name: draft.name.trim() } : a)),
      );
    }
    setEditingId(null);
  }

  function remove(id: string) {
    setAssistants((list) => list.filter((a) => a.id !== id));
    if (activeId === id && assistants.length > 1) {
      const rest = assistants.filter((a) => a.id !== id);
      if (rest.length) setActiveId(rest[0].id);
    }
  }

  function togglePlugin(pid: string) {
    setDraft((d) => ({
      ...d,
      pluginIds: d.pluginIds.includes(pid)
        ? d.pluginIds.filter((x) => x !== pid)
        : [...d.pluginIds, pid],
    }));
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-100">助手</h1>
            <p className="text-sm text-zinc-500">
              每个助手有独立的人设提示词、模型和插件权限，对话时一键切换
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => startEdit()}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            <Plus className="mr-1 h-4 w-4" />
            新建助手
          </Button>
        </div>

        {/* editor */}
        {editingId && (
          <div className="mb-5 space-y-4 rounded-2xl border border-indigo-800/60 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">
                {editingId === '__new__' ? '新建助手' : '编辑助手'}
              </span>
              <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <div className="w-20">
                <Label className="mb-1.5 block text-xs text-zinc-500">图标</Label>
                <Input
                  value={draft.emoji}
                  onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
                  className="border-zinc-800 bg-zinc-950 text-center text-lg"
                  maxLength={4}
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs text-zinc-500">名称</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="例如：翻译官"
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs text-zinc-500">
                  模型（留空跟随全局）
                </Label>
                <Input
                  value={draft.model}
                  onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  placeholder="跟随全局设置"
                  className="border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-100"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">
                温度：{draft.temperature === null ? '跟随全局' : draft.temperature.toFixed(1)}
                {draft.temperature !== null && (
                  <button
                    className="ml-2 text-indigo-400 hover:underline"
                    onClick={() => setDraft((d) => ({ ...d, temperature: null }))}
                  >
                    改为跟随全局
                  </button>
                )}
              </Label>
              <Slider
                value={[draft.temperature ?? 0.6]}
                onValueChange={([v]) => setDraft((d) => ({ ...d, temperature: v }))}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">
                人设提示词（留空跟随全局，支持 {'{{date}}'} {'{{time}}'} {'{{model}}'} 变量）
              </Label>
              <Textarea
                value={draft.systemPrompt}
                onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
                rows={4}
                placeholder="例如：你是一名专业翻译，把所有输入翻译成地道的英文……"
                className="border-zinc-800 bg-zinc-950 text-sm text-zinc-100"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">
                插件权限（不选表示全部可用；MCP 工具单独在设置中管理）
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PLUGINS.map((p) => {
                  const on = draft.pluginIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlugin(p.id)}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        on
                          ? 'border-indigo-600 bg-indigo-600/15 text-indigo-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-600'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={save} disabled={!draft.name.trim()} className="bg-indigo-600 hover:bg-indigo-500">
              <Check className="mr-1 h-4 w-4" />
              保存
            </Button>
          </div>
        )}

        {/* cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assistants.map((a) => {
            const active = a.id === activeId;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 transition ${
                  active ? 'border-indigo-600 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="text-2xl">{a.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-zinc-100">{a.name}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-500">
                      {a.model || '跟随全局模型'}
                    </div>
                  </div>
                  {active && (
                    <Badge className="bg-indigo-600/20 text-[10px] text-indigo-300 hover:bg-indigo-600/20">
                      当前
                    </Badge>
                  )}
                </div>
                <p className="mb-3 line-clamp-2 min-h-[2.5em] text-xs leading-relaxed text-zinc-500">
                  {a.systemPrompt || '使用全局系统提示词'}
                </p>
                <div className="flex gap-1.5">
                  {!active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 border-zinc-700 bg-transparent text-xs text-zinc-300 hover:bg-zinc-800"
                      onClick={() => setActiveId(a.id)}
                    >
                      设为当前
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-zinc-700 bg-transparent text-xs text-zinc-400 hover:bg-zinc-800"
                    onClick={() => startEdit(a)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {assistants.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-zinc-700 bg-transparent text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
