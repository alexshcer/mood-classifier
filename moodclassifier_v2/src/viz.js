class AnalysisResults {
    constructor(classifierNames) {
        this.analysisMeters = {};
        this.bpmBox = document.querySelector('#bpm-value');
        this.keyBox = document.querySelector('#key-value');
        if (classifierNames instanceof Array) {
            this.names = classifierNames;
            classifierNames.forEach((n) => {
                this.analysisMeters[n] = document.querySelector(`#${n} > .classifier-meter`);
            });
        } else {
            throw TypeError("List of classifier names provided is not of type Array");
        }
    }

    updateMeters(values) {
        this.names.forEach((n) => {
            this.analysisMeters[n].style.setProperty('--meter-width', values[n]*100);
        });
    }

    updateValueBoxes(essentiaAnalysis) {
        const stringBpm = essentiaAnalysis.bpm.toString();
        const formattedBpm = stringBpm.slice(0, stringBpm.indexOf('.') + 2); // keep 1 decimal places only
        this.bpmBox.textContent = formattedBpm;
        this.keyBox.textContent = `${essentiaAnalysis.keyData.key} ${essentiaAnalysis.keyData.scale}`;
    }
}

function toggleUploadDisplayHTML(mode) {
    switch (mode) {
        case 'display':
            const fileDropArea = document.querySelector('#file-drop-area');
            const fileSelectArea = document.querySelector('#file-select-area');
            if (fileDropArea) {
                fileDropArea.remove();
            }
            const waveformDiv = document.createElement('div');
            waveformDiv.setAttribute('id', 'waveform');

            const controlsTemplate = document.querySelector('#playback-controls');

            fileSelectArea.appendChild(waveformDiv);
            fileSelectArea.appendChild(controlsTemplate.content.cloneNode(true));

            return WaveSurfer.create({
                container: '#waveform',
                progressColor: '#3a3a3a',
                waveColor: '#fff2f2'
            });
        
        case 'upload':
            // remove #waveform
            // insert file-drop-area into file-select-area
    
        default:
            break;
    }
}

class PlaybackControls {
    constructor(wavesurferInstance) {
        this.wavesurfer = wavesurferInstance;
        this.controls = {
            backward: document.querySelector('#file-select-area #backward'),
            play: document.querySelector('#file-select-area #play'),
            forward: document.querySelector('#file-select-area #forward'),
            mute: document.querySelector('#file-select-area #mute')
        };

        // Set click handlers
        this.controls.backward.onclick = () => {
            const currentTime = this.wavesurfer.getCurrentTime();
            const newTime = Math.max(currentTime - 0.5, 0);
            this.wavesurfer.seekTo(newTime / this.wavesurfer.getDuration());
        };

        this.controls.play.onclick = () => {
            this.wavesurfer.playPause();
            this.updatePlayButtonText();
        };

        this.controls.forward.onclick = () => {
            const currentTime = this.wavesurfer.getCurrentTime();
            const duration = this.wavesurfer.getDuration();
            const newTime = Math.min(currentTime + 0.5, duration);
            this.wavesurfer.seekTo(newTime / duration);
        };

        this.controls.mute.onclick = () => {
            const isMuted = this.wavesurfer.getVolume() === 0;
            this.wavesurfer.setVolume(isMuted ? 1 : 0);
            this.updateMuteButtonIcon();
        };

        // Update button text and icon initially
        this.updatePlayButtonText();
        this.updateMuteButtonIcon();
    }

    updatePlayButtonText() {
        const isPlaying = this.wavesurfer.isPlaying();
        this.controls.play.innerHTML = isPlaying ? '<i class="pause icon"></i> pause' : '<i class="play icon"></i> play';
    }

    updateMuteButtonIcon() {
        const isMuted = this.wavesurfer.getVolume() === 0;
        this.controls.mute.innerHTML = isMuted ? '<i class="volume off icon"></i> mute' : '<i class="volume up icon"></i> mute';
    }

    toggleEnabled(isEnabled) {
        if (isEnabled) {
            for (let c in this.controls) {
                this.controls[c].removeAttribute('disabled');
            }
        } else {
            for (let c in this.controls) {
                this.controls[c].setAttribute('disabled', '');
            }
        }
    }
}

export { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls };