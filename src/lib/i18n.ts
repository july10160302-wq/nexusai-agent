import { useSyncExternalStore } from 'react';
type Locale = 'zh' | 'en';
let locale: Locale = (() => { try { return JSON.parse(localStorage.getItem('nexus.settings') || '{}').locale === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } })();
const listeners = new Set<() => void>();
export function setLanguage(next: Locale) {
  locale = next;
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach(fn => fn());
}
const dictionary: Record<string, string> = {
  'MCP 服务器工具':'MCP server tools',
  '对话':'Chats','助手':'Assistants','插件':'Tools','设置':'Settings',
  '智能体客户端':'Your AI workspace','新建对话':'New chat','新对话':'New chat','暂无历史对话':'Your chats appear here',
  '本地运行 · 数据不出本机':'History on device · Requests go to your API',
  '每个助手有独立的人设提示词、模型和插件权限，对话时一键切换':'Personalize instructions, models and tools for each assistant.',
  '新建助手':'New assistant','图标':'Icon','名称':'Name','例如：翻译官':'e.g. Translator',
  '模型（留空跟随全局）':'Model (empty = default)','跟随全局设置':'Use default settings','温度：':'Temperature: ',
  '改为跟随全局':'Use default','人设提示词（留空跟随全局，支持':'Instructions (empty = default; variables: ',
  '变量）':')','例如：你是一名专业翻译，把所有输入翻译成地道的英文……':'You are a professional translator. Translate input into natural English.',
  '插件权限（不选表示全部可用；MCP 工具单独在设置中管理）':'Allowed tools (none selected = all); manage MCP in Settings.',
  '保存':'Save','当前':'Active','设为当前':'Use assistant','复制代码':'Copy code','（新文件）':'(new file)',
  '此操作需要你的批准才会执行':'Review this action before it runs.','批准':'Approve','拒绝':'Reject','参数':'Arguments','结果':'Result',
  '快速切换模型':'Switch model','搜索对话内容':'Search chat','活动日志':'Activity','选择本对话可用的插件':'Choose tools for this chat',
  '导出为 Markdown':'Export Markdown','本对话可用插件':'Tools for this chat','重置':'Reset','搜索对话内容，Enter 跳转…':'Search chat; Enter to jump…',
  '还没有配置大模型 API。':'Connect a model provider to get started.','去设置':'Open settings',
  '工作区文件 · 工具审批 · 任务计划 · 代码执行 · MCP 生态':'Your models. Your tools. One workspace, on every screen.',
  '输入 / 呼出快捷命令 · 点击 @ 引用工作区文件 · 支持语音输入':'Type / for commands · @ for workspace files · Voice when supported',
  '取消':'Cancel','保存并重新生成':'Save & regenerate','编辑并重新生成':'Edit & regenerate','编辑':'Edit',
  '从这里分支新对话':'Branch from here','分支':'Branch','复制内容':'Copy message','复制':'Copy','重新生成':'Regenerate',
  '任务计划':'Task plan','搜索工作区文件…':'Search workspace files…','加载中…':'Loading…','工作区暂无文件':'No workspace files',
  '添加图片（需要视觉模型）':'Attach image (vision model required)','引用工作区文件':'Reference workspace file','停止（Esc）':'Stop (Esc)',
  '工具调用在本地执行 · 写操作需批准后执行':'Tools run on this device or a connected service · Review permissions in Settings',
  '次工具调用':'tool calls','本轮还没有工具活动':'No tool activity yet','插件中心':'Tools & integrations',
  '全部插件已预装并配置好，开关即可控制大模型能否调用':'Built-in tools and optional integrations. Availability depends on device permissions and connected services.',
  '已预装':'Built in','模型 API、审批模式、工作区与 MCP 服务器':'Providers, permissions, workspace and connected tools',
  '模型 API':'Model provider','API 地址（Base URL）':'API base URL',
  '密钥只保存在本机浏览器 localStorage，不会上传到任何服务器':'The key is stored on this device and sent to your configured API provider.',
  '模型名称':'Model ID','温度（Temperature）：':'Temperature: ', '推理强度（Reasoning Effort，仅推理模型生效）':'Reasoning effort (supported models only)',
  '系统提示词（支持':'System instructions (variables: ', '测试连接':'Test a real request','工具审批模式':'Tool permissions','工作区文件夹':'Workspace folder',
  '绑定一个本地文件夹后，大模型可以用工作区文件插件在里面读写代码和文档（Codex 式工作区）。出于浏览器安全限制，刷新页面后需要重新授权一次。':'Select a local folder in a supported desktop browser. For phone access to computer files, connect the desktop service in Devices.',
  '已绑定：':'Selected: ','MCP 服务器':'MCP servers','接入任何 MCP（Model Context Protocol）服务器，它的工具会自动出现在大模型的工具箱里。填写 Streamable HTTP 地址（本地或远程均可，需允许跨域）。':'Connect compatible Streamable HTTP MCP servers. The server must permit your app origin. Authentication is supported.',
  '连接并刷新工具列表':'Connect and refresh tools','名称，例如 filesystem':'Name, e.g. filesystem',
  '全自动':'Automatic','写操作需批准（推荐）':'Approve writes (recommended)','全部需批准':'Approve every action',
  '所有工具调用直接执行，无需确认':'Run tools without asking.','读操作自动执行，写文件、发短信、MCP 等操作需你批准':'Ask before writes and MCP calls.','每一次工具调用都要你点头，最严格':'Review every tool call.',
  '关闭':'Off','极简':'Minimal','低':'Low','中':'Medium','高':'High','重新选择文件夹':'Change folder','选择文件夹':'Choose folder',
  '正在聆听…':'Listening…','输入消息，/ 快捷命令，Enter 发送…':'Message NexusAI…','停止语音输入':'Stop dictation','语音输入':'Dictate',
  '通用助手':'General assistant','编程专家':'Coding assistant','研究员':'Research assistant','NexusAI 智能体':'NexusAI',
  '浏览器使用':'Web browsing','工作区文件':'Workspace files','电脑使用':'Device utilities','手机使用':'Android gateway',
  '长期记忆':'Memory','代码执行':'JavaScript sandbox','实用工具':'Utilities',
  '聊天':'Chat','智能体':'Agent','设备控制':'Devices','连接中':'Connecting','接收中':'Receiving','模型正在推理':'Model is reasoning','正在回复':'Responding',
  '今天想做些什么？':'What can I help with?',
  '帮我搜一下最近两天的 AI 行业新闻并总结':'Search and summarize recent AI news',
  '先制定一个计划，然后读取工作区根目录看看有什么文件':'Plan a task and explore my workspace',
  '用代码执行算一下 100 以内的所有素数':'Find all primes below 100 using JavaScript',
  '记住我喜欢简洁的回答风格，然后告诉我现在几点':'Remember that I prefer concise answers',
};
export function useT() {
  const lang = useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => locale);
  return (text: string, english?: string) => lang === 'en' ? english || dictionary[text] || text : text;
}
