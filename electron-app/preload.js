const { contextBridge, ipcRenderer } = require('electron');

const VALID_PLATFORMS = ['fb', 'tt', 'yt'];

contextBridge.exposeInMainWorld('rvAPI', {
  // Validate platform key before sending to main process
  navigate: (k) => {
    if (typeof k !== 'string' || !VALID_PLATFORMS.includes(k)) return Promise.resolve(null);
    return ipcRenderer.invoke('rv-navigate', k);
  },
  reload: () => ipcRenderer.invoke('rv-reload'),
  togglePin: () => ipcRenderer.invoke('rv-toggle-pin'),
  // Validate opacity is a number in range
  setOpacity: (v) => {
    if (typeof v !== 'number' || isNaN(v)) return Promise.resolve(1.0);
    return ipcRenderer.invoke('rv-set-opacity', Math.max(0.1, Math.min(1.0, v)));
  },
  // Validate screenshot data is a string starting with expected prefix
  screenshot: (d) => {
    if (typeof d !== 'string' || !d.startsWith('data:image/png;base64,')) return Promise.resolve('invalid');
    return ipcRenderer.invoke('rv-screenshot', d);
  },
  clearData: () => ipcRenderer.invoke('rv-clear-data'),
});
