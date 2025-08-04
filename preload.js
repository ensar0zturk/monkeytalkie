const { contextBridge, ipcRenderer } = require('electron');

// MonkeyTalkie Güncelleme bildirimleri
contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});

console.log('🐵 MonkeyTalkie Preload Script Yüklendi v1.0.0 - Omgg Ekibinin Monkeylerine Özel!');