import { useT } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { setLanguage } from '@/lib/i18n';
import DevicesView from '@/sections/DevicesView';
import { Bot, Menu, MessageSquare, Plus, Puzzle, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import ChatView from '@/sections/ChatView';
import PluginsView from '@/sections/PluginsView';
import SettingsView from '@/sections/SettingsView';
import AssistantsView from '@/sections/AssistantsView';
import {
  DEFAULT_ASSISTANTS,
  DEFAULT_PLUGIN_STATES,
  DEFAULT_SETTINGS,
  uid,
  useLocalStorage,
} from '@/lib/store';
import { pickWorkspace } from '@/lib/fs';
import type { AppSettings, Assistant, ChatMessage, Conversation, PluginStates } from '@/types';

type Tab = 'chat' | 'assistants' | 'plugins' | 'devices' | 'settings';

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'assistants', label: '助手', icon: Sparkles },
  { id: 'plugins', label: '插件', icon: Puzzle },
  { id: 'devices', label: '设备控制', icon: Bot },
  { id: 'settings', label: '设置', icon: Settings2 },
];

export default function App() {
 const t = useT();
  const [tab, setTab] = useState<Tab>('chat');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings, setSettings] = useLocalStorage<AppSettings>('nexus.settings', DEFAULT_SETTINGS);
  useEffect(() => setLanguage(settings.locale), [settings.locale]);
  const [pluginStates, setPluginStates] = useLocalStorage<PluginStates>(
    'nexus.plugins',
    DEFAULT_PLUGIN_STATES,
  );
  const [conversations, setConversations] = useLocalStorage<Conversation[]>(
    'nexus.conversations',
    [],
  );
  const [assistants, setAssistants] = useLocalStorage<Assistant[]>(
    'nexus.assistants',
    DEFAULT_ASSISTANTS,
  );
  const [activeAssistantId, setActiveAssistantId] = useLocalStorage<string>(
    'nexus.activeAssistant',
    'default',
  );
  const [activeId, setActiveId] = useLocalStorage<string | null>('nexus.activeConversation', null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const assistant = assistants.find((a) => a.id === activeAssistantId) ?? assistants[0] ?? null;

  function createConversation(init?: { title?: string; messages?: ChatMessage[] }): string {
    const id = uid();
    setConversations((list) => [
      {
        id,
        title: init?.title || t('新对话'),
        messages: init?.messages || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...list,
    ]);
    setActiveId(id);
    setDrawerOpen(false);
    return id;
  }

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((list) => list.map((c) => (c.id === id ? updater(c) : c)));
  }

  function deleteConversation(id: string) {
    setConversations((list) => list.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function updateAssistant(id: string, patch: Partial<Assistant>) {
    setAssistants((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function handlePickWorkspace() {
    const name = await pickWorkspace();
    setWorkspaceName(name);
  }

  function goTab(t: Tab) {
    setTab(t);
    setDrawerOpen(false);
  }

  return (
    <div className="nexus-app flex w-full overflow-hidden text-zinc-900">
      {/* mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* sidebar — 移动端为抽屉 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 md:static md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">NexusAI</div>
            <div className="text-[11px] leading-tight text-zinc-500">{t("智能体客户端")}</div>
          </div>
          <button
            aria-label={t('关闭侧栏', 'Close sidebar')}
            className="ml-auto text-zinc-500 hover:text-zinc-700 md:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 px-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => goTab(n.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  on
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(n.label)}
              </button>
            );
          })}
        </nav>

        {tab === 'chat' && (
          <>
            <div className="px-3 pb-1 pt-4">
              <button
                onClick={() => createConversation()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-700"
              >
                <Plus className="h-4 w-4" />{t("新建对话")}</button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition ${
                    c.id === activeId
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                  onClick={() => {
                    setActiveId(c.id);
                    setDrawerOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className="shrink-0 text-zinc-500 hover:text-red-700 md:hidden md:group-hover:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-500">{t("暂无历史对话")}</p>
              )}
            </div>
          </>
        )}

        <div className="mt-auto border-t border-zinc-200 px-4 py-3 text-[11px] text-zinc-500">{t('历史保存在本机 · 请求发送至配置的 API', 'History on device · Requests go to your API')}
          <select aria-label="Language" value={settings.locale} onChange={e=>setSettings(s=>({...s,locale:e.target.value as 'zh'|'en'}))} className="mt-3 block w-full rounded-lg bg-zinc-100 p-2 text-xs text-zinc-800"><option value="zh">简体中文</option><option value="en">English</option></select>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3 md:hidden">
          <button
            aria-label={t('打开侧栏', 'Open sidebar')}
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">NexusAI</span>
          {assistant && (
            <span className="ml-auto text-lg" title={assistant.name}>
              {assistant.emoji}
            </span>
          )}
        </div>

        <main className="min-h-0 min-w-0 flex-1">
          {tab === 'devices' && <DevicesView settings={settings} setSettings={setSettings}/>}
          {tab === 'chat' && (
            <ChatView
              conversation={active}
              onUpdate={updateConversation}
              onCreate={createConversation}
              settings={settings}
              setSettings={setSettings}
              pluginStates={pluginStates}
              assistant={assistant}
              onUpdateAssistant={updateAssistant}
              goSettings={() => setTab('settings')}
            />
          )}
          {tab === 'assistants' && (
            <AssistantsView
              assistants={assistants}
              setAssistants={setAssistants}
              activeId={assistant?.id ?? ''}
              setActiveId={setActiveAssistantId}
            />
          )}
          {tab === 'plugins' && (
            <PluginsView pluginStates={pluginStates} setPluginStates={setPluginStates} />
          )}
          {tab === 'settings' && (
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              workspaceName={workspaceName}
              onPickWorkspace={handlePickWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
}
