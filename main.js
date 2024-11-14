const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Defer requiring modules until they are needed
let ytdl, ffmpeg;

function createWindow() {
    const win = new BrowserWindow({
        width: 1068,
        height: 720,
        minWidth: 1068,
        minHeight: 720,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false
        }
    });

    win.loadFile('moodclassifier_v3/index.html');
    
    /*
    // Add resize event listener
    win.on('resize', () => {
        const [width, height] = win.getSize();
        console.log(`Window size: ${width}x${height}`);
    });
    */
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle YouTube download request
ipcMain.handle('download-youtube-audio', async (event, url) => {
    if (!ytdl) ytdl = require('@distube/ytdl-core');
    if (!ffmpeg) ffmpeg = require('fluent-ffmpeg');
    
    try {
        const info = await ytdl.getInfo(url);
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });

        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Audio File',
            defaultPath: `${info.videoDetails.title}.wav`,
            filters: [{ name: 'Audio Files', extensions: ['wav'] }]
        });

        if (!filePath) throw new Error('Save operation was canceled.');

        return new Promise((resolve, reject) => {
            ffmpeg(audioStream)
                .audioCodec('pcm_s16le')
                .format('wav')
                .on('end', () => resolve(filePath))
                .on('error', reject)
                .save(filePath);
        });
    } catch (error) {
        console.error('Error downloading audio:', error);
        throw new Error(`Failed to download audio: ${error.message}`);
    }
});

// Asynchronous file reading using streams
ipcMain.handle('read-audio-file', async (event, filePath) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    } catch (error) {
        console.error('Error reading audio file:', error);
        throw error;
    }
});