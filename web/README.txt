NexusAI browser edition / Windows

1. Extract the entire ZIP into any writable folder (for example E:\NexusAI).
2. Open web/Start-Browser.cmd. No Node.js installation is needed on Windows.
3. Keep the launcher window open while using NexusAI. Closing it stops the local server.

Do not double-click index.html: browsers cannot load this application over file://.
On macOS/Linux, install Node.js 22+, then run: node web/server.cjs
Open the address printed by the server.

The desktop installer runs independently; the desktop App menu also offers Open in browser.
Keep the desktop app running when using that menu entry.
Browser and desktop app profiles store settings/chats separately. Configure your own API endpoint and key.
Different hostnames/ports also have separate browser storage. Keep using the same address.
The local server binds to this computer only. It does not publish a public website.
API providers must permit browser requests (CORS) for the browser edition.
