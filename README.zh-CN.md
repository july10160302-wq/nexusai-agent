# NexusAI 智能体客户端

**一个本地优先、参考 Codex 工作流、同时适配桌面和手机的 AI Agent 客户端。**

[English](./README.md)

NexusAI 将 OpenAI 兼容接口接入一个可实际工作的智能体工作区，提供审批、计划、文件、MCP、浏览器和手机端体验。

## 功能

- **多模型接入：** Kimi、DeepSeek、OpenAI、智谱 GLM、通义千问、Ollama，以及任意 OpenAI 兼容接口。
- **Codex 式工作流：** 工作区、工具审批、任务计划、活动日志、分支对话、编辑重生成、Slash 命令和推理强度。
- **内置工具：** 浏览器搜索/读取/打开、工作区文件、JavaScript 沙盒、剪贴板和通知、手机网关、长期记忆、实用工具和 MCP 服务器。
- **本地优先：** API Key、对话、助手和记忆保存在浏览器或本地应用数据中。
- **一套代码三个目标：** 网页、桌面安装包和 Android APK 使用同一套 React 应用构建。

## 下载

前往 [Releases](https://github.com/july10160302-wq/nexusai-agent/releases) 下载 Windows、macOS、Linux 安装包和 Android APK。发布包由 GitHub Actions 自动构建。

## 浏览器开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，进入「设置」，填写 OpenAI 兼容接口地址、API Key 和模型。

## 本地构建

```bash
npm run build                 # 构建网页
npm run desktop:build         # 构建当前桌面平台
npm run mobile:sync           # 将网页构建同步到 Android 工程
```

Android 发布构建需要 Android SDK，默认由 CI 完成；公开的 debug APK 会附在 GitHub Release 中，方便测试。

## 安全和边界

NexusAI 在当前浏览器或应用环境中执行工具。文件访问限制在用户选择的工作区，写操作可以要求审批，手机操作需要本地网关。浏览器和手机能力取决于主机权限及对应服务是否可用。

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Electron · Capacitor · Web Worker · File System Access API · Web Speech API · HTTP MCP

## 许可证

NexusAI 使用 [MIT License](./LICENSE) 开源。MIT 是开源使用授权协议，不是麻省理工学院的认证或背书。
