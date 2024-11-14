import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';

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
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
})

const dropArea = document.querySelector('#file-drop-area');
dropArea.addEventListener('dragover', (e) => { e.preventDefault() });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
})
dropArea.addEventListener('click', () => {
    dropInput.click();
})

let fileLoaded = false; // Track if a file has been loaded

function processFileUpload(files) {
    if (fileLoaded) {
        // Show dialog and refresh option
        const userChoice = confirm("A file is already loaded. Would you like to refresh the page to load a new file?");
        if (userChoice) {
            location.reload(); // Refresh the page
        }
        return; // Exit the function
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
            console.log('ArrayBuffer obtained');
            decodeFile(ab);
            wavesurfer = toggleUploadDisplayHTML('display');
            wavesurfer.loadBlob(file);
            controls = new PlaybackControls(wavesurfer);
            controls.toggleEnabled(false);
            fileLoaded = true; // Set fileLoaded to true after successful load
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
    createInferenceWorkers();
    EssentiaWASM().then((wasmModule) => {
        essentia = new wasmModule.EssentiaJS(false);
        essentia.arrayToVector = wasmModule.arrayToVector;
    })

    // Retrieve the URL from localStorage and trigger download if it exists
    const storedURL = localStorage.getItem('youtubeURL');
    if (storedURL) {
        document.getElementById('youtube-url').value = storedURL;
        document.getElementById('download-youtube-audio').click();
        localStorage.removeItem('youtubeURL'); // Clear the stored URL after use
    }
};

document.getElementById('download-youtube-audio').addEventListener('click', async () => {
    const url = document.getElementById('youtube-url').value;
    if (!url) {
        alert('Please enter a YouTube URL.');
        return;
    }

    // Check if a file is already loaded
    if (fileLoaded) {
        const userChoice = confirm("A file is already loaded. Would you like to refresh the page to load a new file?");
        if (userChoice) {
            // Store the URL in localStorage
            localStorage.setItem('youtubeURL', url);
            location.reload(); // Refresh the page
        }
        return;
    }

    try {
        console.log('Starting download...');
        const filePath = await window.electronAPI.downloadYouTubeAudio(url);
        console.log('Download complete:', filePath);

        // Read the file using the new IPC handler
        const fileBuffer = await window.electronAPI.readAudioFile(filePath);
        console.log('File read into buffer');

        // Create a blob from the buffer
        const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });
        console.log('File converted to Blob');

        // Create a File object
        const file = new File([fileBlob], 'downloaded-audio.wav', { type: 'audio/wav' });
        
        // Remove the drop area and process the file
        const dropArea = document.querySelector('#file-drop-area');
        if (dropArea) {
            dropArea.remove();
        }

        // Process the file
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
