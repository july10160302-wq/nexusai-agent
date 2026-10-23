# Tools and platform capabilities / 工具与平台能力

The local Codex plugin cache was inspected for package names and descriptions only. Cache entries are not proof that a plugin is enabled. NexusAI does not load these proprietary host plugins.

| Capability / 能力 | NexusAI implementation / 当前实现 | Remaining work / 尚缺能力 |
| --- | --- | --- |
| Browser / 浏览器 | Public web search/read through an external proxy; open URL | DOM interaction, authenticated sessions, screenshot execution |
| Computer Use / 电脑操作 | Clipboard, notifications, downloads, device metadata | Native screen capture, input executor, permission lifecycle |
| Phone Use / 手机操作 | Optional external gateway adapter | Bundled Android accessibility service, gestures, screen capture authorization, stop control |
| Desktop workspace / 电脑文件 | Authenticated MCP companion with confined list/read/write | Physical phone connectivity validation |
| MCP integrations / 外部工具 | HTTP MCP servers configured in Settings | Per-service installation, credentials and platform compatibility |
| Visualization / 可视化 | Markdown and existing message rendering | Interactive artifact runtime |
| LaTeX / 文档编译 | No bundled compiler | Independent compiler service and document workflow |
| Desktop host tools / 客户端工具 | NexusAI chat, settings and device management | Host-specific tools require independent implementation |

Codex cache metadata included browser, chrome, unified-computer-use, computer-use, visualize, latex and codex-app-tools packages. Their desktop integration cannot be recreated by copying manifest files into an APK.

插件中心提供搜索、MCP 设置入口和电脑工作区连接入口。开关只控制智能体调用权限，不保证网关在线或设备授权完成。Phone Use 标为外部网关接口，不能将它理解为已安装原生手机控制服务。

For native Android control, implement and validate a separate Android executor, request accessibility and screen-capture authorization through Android's own flows, and expose only the actions actually supported by that executor. Desktop plugin metadata is a capability reference, not an Android implementation.
