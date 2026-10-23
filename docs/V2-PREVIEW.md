# NexusAI 0.2 preview / v2 预览

Preview 2 reorganizes the sidebar, adds history search and sidebar collapse, consolidates the header, moves model and reasoning controls into the composer, groups attachments and agent mode in the plus menu, and simplifies empty and message views. These controls update settings without making an inference request.

This preview shares one responsive React client across web, Electron and Android.
It is an independent API client, not an official ChatGPT app or a copy of its private tools.

## Included

- Chinese/English interface switching; chat history and active conversation stay on device.
- A white interface with a light-gray sidebar and composer, safe-area support, and a desktop sidebar with a mobile drawer. The model picker accepts custom model IDs, including `gpt-6.1-sol`.
- Chat mode sends no tool schemas and skips MCP initialization. Agent mode enables configured tools and approvals.
- Streaming handles `[DONE]`, JSON fallback, final events without a newline, provider errors and cancellation. Requests have a configurable timeout and show phase and elapsed time.
- Connection testing performs a real, potentially billable model request. Model discovery uses `/models` and does not run inference.
- An authenticated desktop MCP workspace service supports list/read/write. Writes require the hash from the last read and reject stale edits. Paths and symlink targets must remain within the selected workspace.
- Electron starts the workspace service from **Devices** after folder selection. LAN access is opt-in and tokens are generated per service start. Stop the service from the same page or quit the desktop app.

## 手机连接电脑

1. 新版桌面客户端 → 设备控制 → 勾选局域网连接 → 选择文件夹并启动。
2. 手机与电脑连接同一可信网络；在手机“设备控制”输入桌面显示的局域网地址及配对密钥。
3. 点击连接检查，再切换“智能体”模式，要求列出或读取文件。
4. 修改文件时先读取，再审阅工具参数并批准。默认每次 MCP 调用都需要批准。

The companion uses HTTP on a trusted LAN. For remote access use HTTPS with a reverse proxy or an encrypted VPN. Do not forward its plain HTTP port to the public internet. An HTTPS web deployment may block HTTP LAN access; use an HTTPS companion endpoint. The Android preview permits HTTP for LAN pairing. Actual phone connectivity still needs testing on a physical device.

For source users:

```sh
npm ci
npm test
npm run dev
node companion/server.cjs --workspace /path/to/project --host 0.0.0.0
```

The CLI prints the pairing details. It binds loopback by default without `--host`.
For portable desktop storage, set `NEXUSAI_DATA_DIR` to a writable folder on the chosen disk before launching.

## Explicit limits / 当前限制

- Android cross-app tapping, swiping, screen capture and accessibility services are **not implemented**. The old phone plugin still requires a separately installed gateway and is disabled by default on new profiles.
- Desktop screen control and terminal execution are **not implemented**. The JavaScript tool is a worker sandbox, not a terminal.
- Tool availability depends on platform permissions and service connectivity. Public web browsing uses an external proxy and may fail.
- Only OpenAI-compatible Chat Completions APIs are supported. Responses and Anthropic-native protocols are not included.
- API keys and pairing tokens are stored in localStorage, not an OS credential vault. Chat/API content is sent to the configured provider; data is not confined to the device.
- Phone and desktop histories are separate. Pairing shares workspace tools, not chat storage.
- The preview APK uses a separate application ID, so it can coexist with the older APK. This avoids falsely promising in-place updates from builds signed with an ephemeral CI debug key. It is a debug APK, not a store release.
- Packaged installers and physical Android behavior require runtime validation beyond compilation. Preview builds are not a claim of full ChatGPT feature parity.

## Verification

`npm test` checks Electron entry syntax and eight streaming/MCP/workspace scenarios without calling a model API. `npm run build` type-checks and builds the web client. Release CI runs tests before building installers and the APK.
