const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    downloadYouTubeAudio: (url) => ipcRenderer.invoke('download-youtube-audio', url),
    readAudioFile: (filePath) => ipcRenderer.invoke('read-audio-file', filePath)
}); 