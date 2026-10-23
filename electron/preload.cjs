const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nexusDesktop', {
  startService: (lan) => ipcRenderer.invoke('companion:start', Boolean(lan)),
  stopService: () => ipcRenderer.invoke('companion:stop'),
});
