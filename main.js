const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

function createWindow() {
    const win = new BrowserWindow({
        width: 1068,
        height: 720,
        minWidth: 1068,
        minHeight: 720,
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
    try {
        console.log('Received download request for URL:', url);

        const info = await ytdl.getInfo(url);
        const videoTitle = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, ''); // Remove invalid filename characters
        console.log('Video info fetched:', videoTitle);

        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        console.log('Chosen audio format:', audioFormat);

        const audioStream = ytdl.downloadFromInfo(info, {
            format: audioFormat,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            }
        });

        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Audio File',
            defaultPath: `${videoTitle}.wav`,
            filters: [{ name: 'Audio Files', extensions: ['wav'] }]
        });

        if (!filePath) {
            throw new Error('Save operation was canceled.');
        }

        console.log('Starting download and conversion...');
        return new Promise((resolve, reject) => {
            ffmpeg(audioStream)
                .audioCodec('pcm_s16le')
                .format('wav')
                .on('end', () => {
                    console.log('Conversion finished.');
                    resolve(filePath);
                })
                .on('error', (error) => {
                    console.error('Error during conversion:', error);
                    reject(error);
                })
                .save(filePath);
        });
    } catch (error) {
        console.error('Error downloading audio:', error);
        return Promise.reject(new Error(`Failed to download audio: ${error.message}`));
    }
});

// Add this new IPC handler
ipcMain.handle('read-audio-file', async (event, filePath) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    } catch (error) {
        console.error('Error reading audio file:', error);
        throw error;
    }
});