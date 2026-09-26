# NexusAI

**A local-first, Codex-inspired AI agent client for desktop and mobile.**

[简体中文](./README.zh-CN.md)

NexusAI connects OpenAI-compatible providers to a practical agent workspace with approvals, plans, files, MCP tools, browser access, and mobile-friendly conversations.

## What it does

- **Multi-provider chat:** Kimi, DeepSeek, OpenAI, GLM, Qwen, Ollama, and custom OpenAI-compatible endpoints.
- **Codex-style workflow:** workspaces, tool approvals, task plans, activity logs, branches, edit-and-regenerate, slash commands, and reasoning effort controls.
- **Built-in tools:** browser search/read/open, workspace files, JavaScript sandbox, clipboard and notifications, phone gateway, memory, utilities, and MCP servers.
- **Local-first storage:** API keys, conversations, assistants, and memories stay in the browser or local app profile.
- **One codebase, three targets:** web, desktop installers, and Android APK builds from the same React app.

## Download

Download the latest desktop installers and Android APK from the [Releases](https://github.com/july10160302-wq/nexusai-agent/releases) page. Release builds are produced by GitHub Actions for Windows, macOS, Linux, and Android.

## Quick start in the browser

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, then open **Settings** and configure an OpenAI-compatible base URL, API key, and model.

## Build locally

```bash
npm run build                 # web build
npm run desktop:build         # current desktop platform
npm run mobile:sync           # sync web build into an existing Android project
```

Android release builds are generated in CI because they require the Android SDK and signing configuration. The public debug APK is attached to GitHub releases for testing.

## Security and scope

NexusAI runs tools in the current browser or app environment. File access is limited to a user-selected workspace, write actions can require approval, and phone actions require a local gateway. Browser and phone integrations depend on the permissions and services available on the host.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS · Electron · Capacitor · Web Workers · File System Access API · Web Speech API · MCP over HTTP

## License

NexusAI is released under the [MIT License](./LICENSE). MIT is an open-source usage license, not a certification or endorsement by MIT.
