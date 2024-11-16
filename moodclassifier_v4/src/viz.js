import { createDynamicBackground, initializeBackground, updateBackground } from './backgroundEffect.mjs';

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
            mute: document.querySelector('#file-select-area #mute'),
            volumeSlider: document.querySelector('#file-select-area #volume-slider'),
            lyricsButton: document.querySelector('#lyrics-button')
        };

        // Set up lyrics overlay elements
        this.lyricsOverlay = document.querySelector('#lyrics-overlay');
        this.songTitle = document.querySelector('.song-title');
        this.songArtist = document.querySelector('.song-artist');
        this.lyricsText = document.querySelector('.lyrics-text');

        // Add click event listener to the lyrics overlay for closing
        this.lyricsOverlay.addEventListener('click', (e) => {
            if (!e.target.closest('.lyrics-content')) {
                this.lyricsOverlay.classList.remove('active');
            }
        });

        // Set up lyrics button click handler
        this.controls.lyricsButton.addEventListener('click', async () => {
            if (window.currentSongMetadata) {
                await this.showLyrics(window.currentSongMetadata);
            }
        });

        // Set initial volume to 30%
        const defaultVolume = 0.3;
        this.wavesurfer.setVolume(defaultVolume);
        this.controls.volumeSlider.value = defaultVolume;
        
        // Set initial gradient
        this.controls.volumeSlider.style.setProperty('--volume-percentage', '30%');

        // Set click handlers for playback controls
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
            this.wavesurfer.toggleMute();
            this.updateMuteButtonText();
        };

        this.controls.volumeSlider.oninput = (e) => {
            const volume = parseFloat(e.target.value);
            this.wavesurfer.setVolume(volume);
            this.updateVolumeSlider(volume);
        };

        // Add lyrics button handler
        const lyricsButton = this.controls.lyricsButton;
        if (lyricsButton) {
            lyricsButton.addEventListener('click', async () => {
                await this.showLyrics();
            });
        }
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

    async showLyrics({ title, artist }) {
        try {
            this.songTitle.textContent = title;
            this.songArtist.textContent = artist;

            const lyrics = await window.electronAPI.getLyrics({ artist, title });
            if (lyrics) {
                // Split lyrics into lines and filter out empty lines
                const lines = lyrics.split('\n').filter(line => line.trim());
                
                // Create formatted lyrics HTML
                this.lyricsText.innerHTML = lines
                    .map(line => `<div class="lyrics-line">${line.trim()}</div>`)
                    .join('');

                // Add intersection observer for lyrics animation
                const lyricsLines = this.lyricsText.querySelectorAll('.lyrics-line');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('active');
                        } else {
                            entry.target.classList.remove('active');
                        }
                    });
                }, {
                    threshold: 0.8,
                    rootMargin: '-10% 0px'
                });

                lyricsLines.forEach(line => observer.observe(line));
            } else {
                this.lyricsText.innerHTML = '<div class="lyrics-line active">No lyrics available</div>';
            }

            this.lyricsOverlay.classList.add('active');
        } catch (error) {
            console.error('Error showing lyrics:', error);
            this.lyricsText.innerHTML = '<div class="lyrics-line active">Failed to load lyrics</div>';
            this.lyricsOverlay.classList.add('active');
        }
    }

    async showLyrics() {
        if (!window.currentSongMetadata) {
            console.error('No song metadata available');
            return;
        }

        const overlay = document.querySelector('.lyrics-overlay');
        const songTitle = overlay.querySelector('.song-title');
        const songArtist = overlay.querySelector('.song-artist');
        const lyricsContent = overlay.querySelector('.lyrics-content');

        try {
            // Show loading state
            overlay.classList.add('active');
            songTitle.textContent = window.currentSongMetadata.title;
            songArtist.textContent = window.currentSongMetadata.artist;
            lyricsContent.innerHTML = '<div class="lyrics-line">Loading lyrics...</div>';

            // Fetch lyrics
            const lyrics = await window.electronAPI.getLyrics({
                artist: window.currentSongMetadata.artist,
                title: window.currentSongMetadata.title
            });

            if (lyrics) {
                // Format lyrics with line breaks
                const formattedLyrics = lyrics.split('\n')
                    .map(line => `<div class="lyrics-line">${line || '&nbsp;'}</div>`)
                    .join('');
                lyricsContent.innerHTML = formattedLyrics;

                // Add click handler to close overlay
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        overlay.classList.remove('active');
                    }
                });
            } else {
                lyricsContent.innerHTML = '<div class="lyrics-line">No lyrics found</div>';
            }
        } catch (error) {
            console.error('Error fetching lyrics:', error);
            lyricsContent.innerHTML = '<div class="lyrics-line">Error loading lyrics</div>';
        }
    }
}

async function fetchAlbumArt(songTitle, artistName) {
    const query = encodeURIComponent(`${songTitle} ${artistName}`);
    const url = `https://itunes.apple.com/search?term=${query}&limit=1&entity=musicTrack`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results.length > 0) {
            return data.results[0].artworkUrl100.replace('100x100', '600x600');
        }
    } catch (error) {
        console.error('Error fetching album art:', error);
    }
    return null;
}

export function handleAlbumArtLoad(albumArtUrl) {
    if (!albumArtUrl) return;
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = function() {
        try {
            // ColorThief is available globally from the script tag
            const colorThief = new ColorThief();
            const palette = colorThief.getPalette(img, 8);
            const colors = palette.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
            
            console.log('Extracted colors:', colors); // Debug log
            
            // Create the color grid first
            const colorGrid = document.querySelector('.lyrics-color-grid');
            if (colorGrid) {
                colorGrid.innerHTML = '';
                
                // Create 40 cells (8x5 grid) instead of 64
                for (let i = 0; i < 40; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'color-cell';
                    
                    const colorIndex = i % colors.length;
                    const color = colors[colorIndex];
                    
                    const variation = Math.random() * 20 - 10;
                    const [r, g, b] = color.match(/\d+/g).map(Number);
                    const newR = Math.min(255, Math.max(0, r + variation));
                    const newG = Math.min(255, Math.max(0, g + variation));
                    const newB = Math.min(255, Math.max(0, b + variation));
                    
                    cell.style.backgroundColor = `rgb(${newR}, ${newG}, ${newB})`;
                    cell.style.animationDelay = `${(i * 0.08)}s`; // Slightly faster delay between cells
                    colorGrid.appendChild(cell);
                }
            }
            
            // Then update the background
            updateBackground(colors);
        } catch (error) {
            console.error('Error extracting colors:', error);
        }
    };
    
    img.onerror = function() {
        console.error('Error loading image:', albumArtUrl);
    };
    
    img.src = albumArtUrl;
}

function updateColors(albumArtUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = function() {
        const colorThief = new ColorThief();
        try {
            // Get the color palette
            const palette = colorThief.getPalette(img, 5);
            const dominantColor = colorThief.getColor(img);
            
            // Apply colors to lyrics overlay
            const overlay = document.querySelector('.lyrics-overlay');
            if (overlay) {
                const [r, g, b] = dominantColor;
                const [r2, g2, b2] = palette[1] || dominantColor;
                
                overlay.style.background = `linear-gradient(to bottom, 
                    rgba(${r}, ${g}, ${b}, 0.95),
                    rgba(${r2}, ${g2}, ${b2}, 0.85))`;
                
                // Add blur effect
                overlay.style.backdropFilter = 'blur(30px)';
                overlay.style.WebkitBackdropFilter = 'blur(30px)';
            }
            
            // Update lyrics text color based on brightness
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            const textColor = brightness > 128 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            
            document.querySelectorAll('.lyrics-line').forEach(line => {
                line.style.color = textColor;
            });
            
        } catch (error) {
            console.error('Error extracting colors:', error);
        }
    };
    
    img.onerror = function() {
        console.error('Error loading image:', albumArtUrl);
    };
    
    img.src = albumArtUrl;
}

export { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls };