import { useT } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { setLanguage } from '@/lib/i18n';
import DevicesView from '@/sections/DevicesView';
import { PanelLeft } from 'lucide-react';
import AppSidebar, { type AppTab } from '@/components/AppSidebar';
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

type Tab = AppTab;

export default function App() {
 const t = useT();
  const [tab, setTab] = useState<Tab>('chat');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  function toggleSidebar() {
    if (window.matchMedia('(min-width: 768px)').matches) setSidebarCollapsed(v=>!v);
    else setDrawerOpen(v=>!v);
  }
  function newChat() { setTab('chat'); setActiveId(null); setDrawerOpen(false); }
  return <div className="nexus-app flex w-full overflow-hidden text-zinc-900">
    <AppSidebar open={drawerOpen} collapsed={sidebarCollapsed} tab={tab} conversations={conversations} activeId={activeId}
      locale={settings.locale} onLocale={locale=>setSettings(s=>({...s,locale}))}
      onClose={()=>{setDrawerOpen(false);setSidebarCollapsed(true)}} onNew={newChat}
      onSelect={id=>{setActiveId(id);goTab('chat')}} onDelete={deleteConversation} onTab={goTab}/>
    <div className="flex min-w-0 flex-1 flex-col">
      {tab!=='chat' && <header className="flex h-16 shrink-0 items-center gap-3 px-4"><button className="nexus-icon-button" aria-label={t('打开侧栏','Open sidebar')} onClick={toggleSidebar}><PanelLeft size={20}/></button><span className="text-sm font-medium">NexusAI</span><button className="ml-auto text-sm text-zinc-500 hover:text-zinc-900" onClick={()=>goTab('chat')}>{t('返回对话','Back to chat')}</button></header>}
      <main className="min-h-0 min-w-0 flex-1">
        {tab==='chat' && <ChatView conversation={active} onUpdate={updateConversation} onCreate={createConversation} settings={settings} setSettings={setSettings} pluginStates={pluginStates} assistant={assistant} onUpdateAssistant={updateAssistant} goSettings={()=>goTab('settings')} onToggleSidebar={toggleSidebar} onNewChat={newChat}/>}
        {tab==='devices' && <DevicesView settings={settings} setSettings={setSettings}/>}
        {tab==='plugins' && <PluginsView pluginStates={pluginStates} setPluginStates={setPluginStates}/>}
        {tab==='assistants' && <AssistantsView assistants={assistants} setAssistants={setAssistants} activeId={assistant?.id??''} setActiveId={setActiveAssistantId}/>}
        {tab==='settings' && <SettingsView settings={settings} setSettings={setSettings} workspaceName={workspaceName} onPickWorkspace={handlePickWorkspace}/>}
      </main>
    </div>
  </div>;
}
