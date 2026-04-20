const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  openRegister: () => ipcRenderer.invoke('open:register'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
});
