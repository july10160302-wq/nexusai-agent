export interface ToolCallRecord {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'rejected';
}

export interface Attachment {
  name: string;
  dataUrl: string;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallRecord[];
  toolCallId?: string;
  name?: string;
  timestamp: number;
  attachments?: Attachment[];
  usage?: TokenUsage;
}

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  plan?: PlanItem[];
  /** 从哪条对话分支而来（源对话 id） */
  branchedFrom?: string;
  /** 本对话允许使用的插件 id；undefined 或空数组表示不限制 */
  pluginFilter?: string[];
}

export type ApprovalMode = 'auto' | 'writes' | 'all';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export type ReasoningEffort = 'off' | 'minimal' | 'low' | 'medium' | 'high';

export interface AppSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  maxToolRounds: number;
  approvalMode: ApprovalMode;
  mcpServers: McpServer[];
  reasoningEffort: ReasoningEffort;
}

export interface Assistant {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  /** 为空字符串表示跟随全局设置 */
  model: string;
  /** null 表示跟随全局设置 */
  temperature: number | null;
  /** 允许使用的插件 id 列表；空数组表示全部插件 */
  pluginIds: string[];
}

export interface PluginState {
  enabled: boolean;
  config: Record<string, string>;
}

export type PluginStates = Record<string, PluginState>;
