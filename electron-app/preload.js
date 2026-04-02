const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rvAPI', {
  navigate: (k) => ipcRenderer.invoke('rv-navigate', k),
  reload: () => ipcRenderer.invoke('rv-reload'),
  togglePin: () => ipcRenderer.invoke('rv-toggle-pin'),
  setOpacity: (v) => ipcRenderer.invoke('rv-set-opacity', v),
  screenshot: (d) => ipcRenderer.invoke('rv-screenshot', d),
  clearData: () => ipcRenderer.invoke('rv-clear-data'),
});
