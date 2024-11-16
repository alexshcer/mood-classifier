require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { Client } = require('genius-lyrics');
const genius = new Client(process.env.GENIUS_ACCESS_TOKEN);
const axios = require('axios');
const https = require('https');

// Defer requiring modules until they are needed
let ytdl, ffmpeg;

// Create a custom axios instance with longer timeout and keep-alive
const axiosInstance = axios.create({
  timeout: 30000, // 30 seconds timeout
  httpsAgent: new https.Agent({ 
    keepAlive: true,
    rejectUnauthorized: false // Only if you're having SSL issues
  }),
  headers: {
    'Authorization': `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
  }
});

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

    win.loadFile('moodclassifier_v4/index.html');
    
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
                .on('end', () => resolve({
                    filePath,
                    videoDetails: {
                        title: info.videoDetails.title,
                        author: info.videoDetails.author.name
                    }
                }))
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

async function fetchLyrics(artist, title) {
    try {
        const songs = await genius.songs.search(`${title} ${artist}`);
        if (!songs || songs.length === 0) {
            throw new Error('No lyrics found');
        }
        
        const lyrics = await songs[0].lyrics();
        return lyrics;
    } catch (error) {
        console.error('Error fetching lyrics:', error);
        throw error;
    }
}

// Update your IPC handler
ipcMain.handle('get-lyrics', async (event, { artist, title }) => {
    try {
        const lyrics = await fetchLyrics(artist, title);
        return lyrics;
    } catch (error) {
        console.error('Error occurred in handler for get-lyrics:', error);
        throw error;
    }
});