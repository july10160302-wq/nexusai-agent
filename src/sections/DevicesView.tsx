import { useState } from 'react';
import { Monitor, Smartphone, PlugZap, Copy } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { refreshMcpTools } from '@/lib/mcp';
import { uid } from '@/lib/store';
import type { AppSettings } from '@/types';
interface ServiceInfo { url: string; addresses: string[]; token: string; workspace: string }
declare global { interface Window { nexusDesktop?: { startService: (lan: boolean) => Promise<ServiceInfo | null>; stopService: () => Promise<void> }; } }
export default function DevicesView({ settings, setSettings }: { settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings>> }) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [lan, setLan] = useState(false);
  async function connect() {
    setBusy(true); setStatus('');
    try {
      const endpoint = new URL(url.trim());
      if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Use an HTTP(S) MCP URL');
      const existing = settings.mcpServers.find(s => s.url === endpoint.href);
      const server = { id: existing?.id || uid(), name: 'Desktop', url: endpoint.href, token: token.trim(), enabled: true };
      const tools = await refreshMcpTools(server);
      setSettings(s => ({ ...s, mcpServers: [...s.mcpServers.filter(item => item.id !== server.id), server] }));
      setStatus(t('连接成功，可用工具：', 'Connected. Available tools: ') + tools.length);
    } catch(e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function start() {
    setBusy(true);
    try { setInfo(await window.nexusDesktop!.startService(lan)); }
    catch(e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="h-full overflow-y-auto px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">{t('设备控制')}</h1><p className="mt-2 text-sm text-zinc-600">{t('同一个入口，分别连接手机与电脑的执行能力。', 'One workspace, with tools provided by each connected device.')}</p></div>
    <section className="nexus-card space-y-4">
      <h2 className="flex items-center gap-2 font-medium"><Monitor size={18}/>{t('连接电脑工作区', 'Connect a computer workspace')}</h2>
      <p className="text-sm text-zinc-600">{t('支持列出、读取和修改电脑文件。在智能体模式调用，MCP 操作遵循审批设置。', 'List, read and edit computer files in Agent mode. MCP actions follow your approval settings.')}</p>
      <label className="block text-sm">{t('电脑服务地址', 'Computer service URL')}<input className="nexus-input mt-2" value={url} onChange={e=>setUrl(e.target.value)} placeholder="http://192.168.1.10:8723/mcp"/></label>
      <label className="block text-sm">{t('配对密钥', 'Pairing token')}<input className="nexus-input mt-2" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label>
      <button className="nexus-button" disabled={busy || !url || !token} onClick={connect}><PlugZap size={16}/>{busy ? t('连接中') : t('连接并检查工具', 'Connect & check tools')}</button>
      {status && <p role="status" className="break-words text-sm text-amber-700">{status}</p>}
      {settings.mcpServers.filter(s=>s.name==='Desktop').map(s=><div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-zinc-100 p-3 text-sm"><span className="min-w-0 flex-1 break-all">{s.url}</span><span>{t('已配对，点击连接检查可用性', 'Paired; connect to verify availability')}</span><button onClick={()=>setSettings(v=>({...v,mcpServers:v.mcpServers.filter(x=>x.id!==s.id)}))}>{t('断开', 'Disconnect')}</button></div>)}
    </section>
    <section className="nexus-card space-y-4">
      <h2 className="flex items-center gap-2 font-medium"><Monitor size={18}/>{t('在电脑上启动服务', 'Start the desktop service')}</h2>
      {window.nexusDesktop ? <>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={lan} disabled={!!info} onChange={e=>setLan(e.target.checked)}/>{t('允许同一局域网的手机连接', 'Allow phones on the same local network')}</label>
        <p className="text-xs text-zinc-600">{t('局域网 HTTP 仅用于可信网络。远程连接请使用 HTTPS 或加密 VPN。', 'LAN HTTP is for trusted networks. Use HTTPS or an encrypted VPN for remote access.')}</p>
        {info ? <><p className="text-sm break-all">{info.workspace}</p>{[info.url,...info.addresses].map(u=><code className="block text-xs break-all" key={u}>{u}</code>)}<button className="nexus-button" onClick={()=>navigator.clipboard.writeText(info.token)}><Copy size={14}/>{t('复制配对密钥', 'Copy pairing token')}</button><button className="nexus-button" onClick={async()=>{await window.nexusDesktop!.stopService();setInfo(null)}}>{t('停止服务', 'Stop service')}</button></> : <button className="nexus-button" disabled={busy} onClick={start}>{t('选择文件夹并启动', 'Select folder & start')}</button>}
      </> : <><p className="text-sm text-zinc-600">{t('在新版桌面客户端打开此页面启动服务，也可在源码目录运行：', 'Open this page in the new desktop app, or run from the source directory:')}</p><code className="block overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs">node companion/server.cjs --workspace E:\my-project --host 0.0.0.0</code><p className="text-xs text-zinc-600">{t('手机填写电脑局域网 IP，不能填 127.0.0.1。', 'On your phone, use the computer’s LAN IP, not 127.0.0.1.')}</p></>}
    </section>
    <section className="nexus-card"><h2 className="flex items-center gap-2 font-medium"><Smartphone size={18}/>{t('手机本机与电脑控制', 'Phone & computer control')}</h2><p className="mt-3 text-sm leading-relaxed text-zinc-600">{t('电脑文件服务已实现。跨应用点击、滑动、截屏和终端尚未接入；手机控制需要 Android 原生无障碍与截屏授权，现有手机插件需另配网关。', 'The workspace service is implemented. Cross-app taps, swipes, screenshots and terminal execution are not connected yet. Native phone control needs Android accessibility and capture permissions; the existing phone tool needs a separate gateway.')}</p></section>
  </div></div>;
}
