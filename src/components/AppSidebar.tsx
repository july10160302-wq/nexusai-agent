import { useState } from 'react';
import { PanelLeft, SquarePen, Search, Puzzle, Monitor, Sparkles, Settings2, Trash2, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { Conversation } from '@/types';
export type AppTab = 'chat' | 'assistants' | 'plugins' | 'devices' | 'settings';
interface Props {
  open: boolean; collapsed: boolean; tab: AppTab; conversations: Conversation[]; activeId: string | null;
  locale: 'zh' | 'en'; onLocale: (locale: 'zh' | 'en') => void;
  onClose: () => void; onNew: () => void; onSelect: (id: string) => void;
  onDelete: (id: string) => void; onTab: (tab: AppTab) => void;
}
const NAV = [
  { id: 'assistants', zh: '助手', en: 'Assistants', icon: Sparkles },
  { id: 'plugins', zh: '工具与插件', en: 'Tools & integrations', icon: Puzzle },
  { id: 'devices', zh: '已连接设备', en: 'Connected devices', icon: Monitor },
] as const;
export default function AppSidebar(props: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const chats = [...props.conversations].sort((a,b)=>b.updatedAt-a.updatedAt).filter(c=>(c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes(query.toLowerCase()));
  return <>
    {props.open && <button className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-label={t('关闭侧栏','Close sidebar')} onClick={props.onClose}/>}
    <aside className={'nexus-sidebar fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col transition-transform duration-200 md:static ' + (props.open ? 'translate-x-0 ' : '-translate-x-full ') + (props.collapsed ? 'md:hidden' : 'md:translate-x-0')}>
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <span className="nexus-wordmark text-base font-semibold tracking-tight">NexusAI<span className="ml-1 text-zinc-400">·</span></span>
        <button onClick={props.onClose} className="nexus-icon-button" aria-label={t('收起侧栏','Collapse sidebar')}><PanelLeft size={19}/></button>
      </div>
      <div className="space-y-1 px-3">
        <button className="nexus-nav-button" onClick={props.onNew}><SquarePen size={18}/>{t('新建对话')}</button>
        <button className="nexus-nav-button" onClick={()=>setSearching(v=>!v)}><Search size={18}/>{t('搜索聊天','Search chats')}</button>
        {searching && <div className="relative py-1"><input autoFocus aria-label={t('搜索历史','Search history')} className="nexus-input !rounded-lg !p-2 !pr-8 text-sm" placeholder={t('搜索标题或内容…','Search titles or messages…')} value={query} onChange={e=>setQuery(e.target.value)}/><button className="absolute right-2 top-3 text-zinc-500" aria-label={t('取消')} onClick={()=>{setQuery('');setSearching(false)}}><X size={15}/></button></div>}
      </div>
      <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 px-3 text-xs font-medium text-zinc-500">{query ? t('搜索结果','Search results') : t('你的聊天','Your chats')}</p>
        {chats.map(c=><div key={c.id} className={'group flex items-center rounded-lg '+(props.activeId===c.id&&props.tab==='chat'?'bg-[#eaeaea]':'hover:bg-[#ededed]')}>
          <button className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[13px]" onClick={()=>props.onSelect(c.id)}>{c.title}</button>
          <button className="mr-2 rounded p-1.5 text-zinc-400 opacity-100 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100" aria-label={t('删除聊天','Delete chat')+': '+c.title} onClick={()=>{if(window.confirm(t('确定删除这条本机聊天记录？','Delete this chat from this device?')))props.onDelete(c.id)}}><Trash2 size={13}/></button>
        </div>)}
        {!chats.length && <p className="px-3 text-xs leading-relaxed text-zinc-400">{query?t('没有匹配的聊天','No matching chats'):t('暂无历史对话')}</p>}
      </div>
      <div className="space-y-1 border-t border-zinc-200/60 p-3">
        {NAV.map(n=><button key={n.id} className={'nexus-nav-button '+(props.tab===n.id?'bg-[#eaeaea]':'')} onClick={()=>props.onTab(n.id)}><n.icon size={17}/>{t(n.zh,n.en)}</button>)}
        <button className={'nexus-nav-button '+(props.tab==='settings'?'bg-[#eaeaea]':'')} onClick={()=>props.onTab('settings')}><Settings2 size={17}/>{t('设置')}</button>
        <div className="flex items-center gap-2 px-3 pt-3 text-[11px] text-zinc-500"><span className="min-w-0 flex-1">{t('使用自己的 API','Your API · Your workspace')}</span><select aria-label="Language" className="max-w-24 bg-transparent text-xs outline-none" value={props.locale} onChange={e=>props.onLocale(e.target.value as 'zh'|'en')}><option value="zh">简体中文</option><option value="en">English</option></select></div>
      </div>
    </aside>
  </>;
}
