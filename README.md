# NexusAI 智能体客户端

一个**本地优先**的 AI 智能体（Agent）客户端：接入任意 OpenAI 兼容的大模型 API，预装浏览器、工作区文件、代码执行、电脑、手机等插件，体验对标 Codex 桌面版，同时适配手机浏览器。

> 纯前端应用，数据（API Key、对话、记忆）全部保存在本机浏览器，不上传任何服务器。

## ✨ 功能

**Agent 工作流（对标 Codex）**
- 📁 工作区文件夹：绑定本地目录，AI 直接读写其中的文件（File System Access API）
- 🛡️ 工具审批三档：全自动 / 写操作需批准 / 全部需批准，写文件前显示行级 diff 预览
- 📋 任务计划面板：多步骤任务自动制定清单并实时勾选进度
- 💻 代码执行：Web Worker 沙盒中运行 JavaScript，5 秒超时保护
- 📜 活动日志：按时间线回看所有工具调用，点击跳转到对应消息

**插件生态（8 个预装 + MCP）**
- 浏览器使用（联网搜索、打开/读取网页）
- 工作区文件（fs_list / fs_read / fs_write / fs_delete / fs_mkdir）
- 代码执行（JS 沙盒）
- 电脑使用（通知、剪贴板、保存文件、系统信息）
- 手机使用（经本地 ADB 网关：状态、打开应用、发短信）
- 任务计划、长期记忆、实用工具
- 🔌 支持接入任意 MCP（Model Context Protocol）服务器，工具自动注册

**对话体验**
- 多助手系统（独立人设提示词 / 模型 / 温度 / 插件权限）
- 分支对话、编辑已发消息并重新生成、对话内搜索跳转
- Slash 命令（/new /plan /compact /export /clear）、@ 引用工作区文件
- 图片多模态输入、💬 语音输入（中文）、拖拽发图
- 长期记忆（跨对话）、Prompt 变量（{{date}} {{time}} {{model}}）
- 自动标题、token 用量显示、推理强度（minimal/low/medium/high）
- 流式输出、Markdown 渲染（代码高亮 / 表格 / 一键复制）
- 移动端响应式：抽屉侧栏、触屏友好的操作按钮

## 🚀 快速开始

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 产物在 dist/，可部署到任意静态托管
```

打开后进入「设置」页：

1. 选择服务商（Kimi / DeepSeek / OpenAI / 智谱 GLM / 通义千问 / Ollama）或填写任意 OpenAI 兼容接口
2. 填入 API Key，点「测试连接」
3. 回到「对话」开始聊天

## 🛠 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · File System Access API · Web Workers · Web Speech API

## 📄 License

MIT
