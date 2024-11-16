import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';
import { createDynamicBackground, initializeBackground, updateBackground } from './backgroundEffect.mjs';
import { handleAlbumArtLoad } from './viz.js';  

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file

let essentia = null;
let essentiaAnalysis;
let featureExtractionWorker = null;
let inferenceWorkers = {};
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];
let inferenceResultPromises = [];

const resultsViz = new AnalysisResults(modelNames);
let wavesurfer;
let controls;

const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.style.display = 'none';
document.body.appendChild(dropInput);

dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
});

const dropArea = document.querySelector('#file-drop-area');

if (dropArea) {
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        processFileUpload(files);
    });

    dropArea.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropInput.click();
    });
}

let fileLoaded = false; // Track if a file has been loaded
window.currentSongMetadata = null;

// Add this helper function to parse file names
function parseFileName(fileName) {
    // Remove file extension and video indicators
    fileName = fileName.replace(/\.[^/.]+$/, "") // remove extension
                     .replace(/\(Official.*?\)/gi, "") // remove (Official...)
                     .replace(/\[Official.*?\]/gi, "") // remove [Official...]
                     .replace(/\(Lyric.*?\)/gi, "") // remove (Lyric...)
                     .replace(/\(Audio.*?\)/gi, "") // remove (Audio...)
                     .replace(/\(Music.*?\)/gi, "") // remove (Music...)
                     .replace(/\(Visualizer.*?\)/gi, "") // remove (Visualizer...)
                     .replace(/\(Official Music Video\)/gi, "")
                     .replace(/\(Official Video\)/gi, "")
                     .trim();

    // Try to split by common separators
    let parts;
    if (fileName.includes(" - ")) {
        parts = fileName.split(" - ");
    } else if (fileName.includes(" – ")) {  // en dash
        parts = fileName.split(" – ");
    } else if (fileName.includes(" — ")) {  // em dash
        parts = fileName.split(" — ");
    } else {
        return { title: fileName, artist: "Unknown Artist" };
    }

    // Clean up the parts
    const artist = parts[0].trim();
    const title = parts[1].trim();

    return { title, artist };
}

// Update processFileUpload function
function processFileUpload(files) {
    if (fileLoaded) {
        const userChoice = confirm("A file is already loaded. Would you like to refresh the page to load a new file?");
        if (userChoice) {
            location.reload();
        }
        return;
    }

    console.log('Processing file upload:', files);
    if (files.length > 1) {
        alert("Only single-file uploads are supported currently");
        throw Error("Multiple file upload attempted, cannot process.");
    } else if (files.length) {
        toggleLoader();
        const file = files[0];
        console.log('File type:', file.type);
        file.arrayBuffer().then((ab) => {
            // Parse the file name properly
            const metadata = parseFileName(file.name);
            window.currentSongMetadata = {
                title: metadata.title,
                artist: metadata.artist
            };
            
            if (window.currentSongMetadata) {
                fetchAlbumArt(window.currentSongMetadata.title, window.currentSongMetadata.artist);
            }
            
            console.log('Parsed metadata:', window.currentSongMetadata);
            console.log('ArrayBuffer obtained');
            decodeFile(ab);
            wavesurfer = toggleUploadDisplayHTML('display');
            wavesurfer.loadBlob(file);
            controls = new PlaybackControls(wavesurfer);
            controls.toggleEnabled(false);
            fileLoaded = true;
        }).catch(error => {
            console.error('Error converting file to ArrayBuffer:', error);
            toggleLoader();
        });
    }
}

function decodeFile(arrayBuffer) {
    audioCtx.resume().then(() => {
        audioCtx.decodeAudioData(arrayBuffer).then(async function handleDecodedAudio(audioBuffer) {
            console.info("Done decoding audio!");
            
            const prepocessedAudio = preprocess(audioBuffer);
            await audioCtx.suspend();

            if (essentia) {
                essentiaAnalysis = computeKeyBPM(prepocessedAudio);
            }

            // reduce amount of audio to analyse
            let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true);

            // send for feature extraction
            createFeatureExtractionWorker();

            featureExtractionWorker.postMessage({
                audio: audioData.buffer
            }, [audioData.buffer]);
            audioData = null;
        }).catch(error => {
            console.error('Error decoding audio:', error);
            toggleLoader();
        });
    });
}

function computeKeyBPM (audioSignal) {
    let vectorSignal = essentia.arrayToVector(audioSignal);
    const keyData = essentia.KeyExtractor(vectorSignal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 16000, 0.0001, 440, 'cosine', 'hann');
    const bpm = essentia.PercivalBpmEstimator(vectorSignal, 1024, 2048, 128, 128, 210, 50, 16000).bpm;
    
    // const bpm = essentia.RhythmExtractor(vectorSignal, 1024, 1024, 256, 0.1, 208, 40, 1024, 16000, [], 0.24, true, true).bpm;
    // const bpm = essentia.RhythmExtractor2013(vectorSignal, 208, 'multifeature', 40).bpm;

    return {
        keyData: keyData,
        bpm: bpm
    };
}

function createFeatureExtractionWorker() {
    featureExtractionWorker = new Worker('./src/featureExtraction.js');
    featureExtractionWorker.onmessage = function listenToFeatureExtractionWorker(msg) {
        // feed to models
        if (msg.data.features) {
            modelNames.forEach((n) => {
                // send features off to each of the models
                inferenceWorkers[n].postMessage({
                    features: msg.data.features
                });
            });
            msg.data.features = null;
        }
        // free worker resource until next audio is uploaded
        featureExtractionWorker.terminate();
    };
}

function createInferenceWorkers() {
    modelNames.forEach((n) => { 
        inferenceWorkers[n] = new Worker('./src/inference.js');
        inferenceWorkers[n].postMessage({
            name: n
        });
        inferenceWorkers[n].onmessage = function listenToWorker(msg) {
            // listen out for model output
            if (msg.data.predictions) {
                const preds = msg.data.predictions;
                // emmit event to PredictionCollector object
                inferenceResultPromises.push(new Promise((res) => {
                    res({ [n]: preds });
                }));
                collectPredictions();
                console.log(`${n} predictions: `, preds);
            }
        };
    });
}

function collectPredictions() {
    if (inferenceResultPromises.length == modelNames.length) {
        Promise.all(inferenceResultPromises).then((predictions) => {
            const allPredictions = {};
            Object.assign(allPredictions, ...predictions);
            resultsViz.updateMeters(allPredictions);
            resultsViz.updateValueBoxes(essentiaAnalysis);
            toggleLoader();
            controls.toggleEnabled(true)

            inferenceResultPromises = [] // clear array
        })
    }
}

function toggleLoader() {
    const loader = document.querySelector('#loader');
    loader.classList.toggle('disabled');
    loader.classList.toggle('active')
}


window.onload = () => {
    initializeBackground();
    createDynamicBackground();
    
    createInferenceWorkers();
    EssentiaWASM().then((wasmModule) => {
        essentia = new wasmModule.EssentiaJS(false);
        essentia.arrayToVector = wasmModule.arrayToVector;
    });

    // Add event listener to close lyrics overlay when clicking outside the lyrics content
    const lyricsOverlay = document.getElementById('lyrics-overlay');
    const lyricsContent = document.querySelector('.lyrics-content');

    lyricsOverlay.addEventListener('click', (event) => {
        if (!lyricsContent.contains(event.target)) {
            lyricsOverlay.classList.remove('active');
        }
    });

    // Retrieve the URL from localStorage and trigger download if it exists
    const storedURL = localStorage.getItem('youtubeURL');
    if (storedURL) {
        document.getElementById('youtube-url').value = storedURL;
        document.getElementById('download-youtube-audio').click();
        localStorage.removeItem('youtubeURL'); // Clear the stored URL after use
    }
};

// Update YouTube download event listener
document.getElementById('download-youtube-audio').addEventListener('click', async () => {
    const url = document.getElementById('youtube-url').value;
    if (!url) {
        alert('Please enter a YouTube URL.');
        return;
    }

    if (fileLoaded) {
        const userChoice = confirm("A file is already loaded. Would you like to refresh the page to load a new file?");
        if (userChoice) {
            localStorage.setItem('youtubeURL', url);
            location.reload();
        }
        return;
    }

    try {
        console.log('Starting download...');
        const { filePath, videoDetails } = await window.electronAPI.downloadYouTubeAudio(url);
        
        // Parse the video title
        const metadata = parseFileName(videoDetails.title);
        window.currentSongMetadata = {
            title: metadata.title,
            artist: metadata.artist || videoDetails.author.name
        };

        if (window.currentSongMetadata) {
            fetchAlbumArt(window.currentSongMetadata.title, window.currentSongMetadata.artist);
        }

        console.log('Parsed metadata:', window.currentSongMetadata);

        console.log('Download complete:', filePath);

        const fileBuffer = await window.electronAPI.readAudioFile(filePath);
        console.log('File read into buffer');

        const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });
        console.log('File converted to Blob');

        const file = new File([fileBlob], 'downloaded-audio.wav', { type: 'audio/wav' });

        const dropArea = document.querySelector('#file-drop-area');
        if (dropArea) {
            dropArea.remove();
        }

        processFileUpload([file]);
        console.log('File sent for processing');
    } catch (error) {
        console.error('Error processing YouTube download:', error);
        alert('Error processing YouTube download: ' + error.message);
    }
});

document.getElementById('reset-app').addEventListener('click', () => {
    // Refresh the page to reset the app
    location.reload();
});

async function fetchAlbumArt(songTitle, artistName) {
    const query = encodeURIComponent(`${songTitle} ${artistName}`);
    const url = `https://itunes.apple.com/search?term=${query}&limit=1&entity=musicTrack`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results.length > 0) {
            const albumArtUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
            handleAlbumArtLoad(albumArtUrl);
            applyDynamicColors(albumArtUrl);
            return albumArtUrl;
        }
    } catch (error) {
        console.error('Error fetching album art:', error);
    }
    return null;
}

function applyDynamicColors(albumArtUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = albumArtUrl;

    img.onload = () => {
        const colorThief = new ColorThief();
        const dominantColor = colorThief.getColor(img);
        const rgbaColor = `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.5)`;

        document.querySelector('.lyrics-overlay').style.backgroundColor = rgbaColor;
    };
}

// Call this function when the album art is loaded
handleAlbumArtLoad = (albumArtUrl) => {
    applyDynamicColors(albumArtUrl);
    // Existing code to handle album art
};
