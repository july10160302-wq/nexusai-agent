const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const { startCompanion } = require('../companion/server.cjs');
const { startWebServer } = require('../web/server.cjs');
let browserService;
let browserServiceStarting;
async function openInBrowser() {
  try {
    if (!browserServiceStarting) browserServiceStarting = startWebServer().catch(error => { browserServiceStarting = null; throw error; });
    browserService = await browserServiceStarting;
    await shell.openExternal(browserService.url);
  } catch (error) {
    dialog.showErrorBox('NexusAI / Browser', `Cannot start browser mode. Close another NexusAI browser launcher and retry.\n${error.message}`);
  }
}
// A custom data path is useful for portable installations and small system disks.
if (process.env.NEXUSAI_DATA_DIR) app.setPath('userData', path.resolve(process.env.NEXUSAI_DATA_DIR));
let companion;
ipcMain.handle('companion:start', async (_event, lan) => {
  if (companion) throw new Error('Stop the existing service first.');
  const chosen = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (chosen.canceled) return null;
  companion = await startCompanion({ workspace: chosen.filePaths[0], host: lan ? '0.0.0.0' : '127.0.0.1' });
  const { server: _, ...info } = companion;
  return info;
});
ipcMain.handle('companion:stop', async () => {
  if (companion) await new Promise(resolve => companion.server.close(resolve));
  companion = null;
});
app.on('before-quit', () => { companion?.server.close(); browserService?.server.close(); });

const isDev = Boolean(process.env.ELECTRON_START_URL);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 400,
    minHeight: 640,
    backgroundColor: '#ffffff',
    title: 'NexusAI',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) void win.loadURL(process.env.ELECTRON_START_URL);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'NexusAI', submenu: [
      { label: 'Open in browser / 在浏览器打开', click: openInBrowser },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
