// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  saveState: (key, data) => ipcRenderer.invoke('save-state', { key, data })
});
