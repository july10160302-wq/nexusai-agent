const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { startCompanion } = require('../companion/server.cjs');
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
app.on('before-quit', () => companion?.server.close());

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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
