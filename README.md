<div align="center">
  <img src="icon.png" alt="Mood Classifier Logo" width="120"/>
  <h1>Mood Classifier</h1>
  <p>An elegant desktop application for music mood analysis and classification using deep learning</p>
  
  ![License](https://img.shields.io/badge/license-CC--BY--NC--ND%204.0-blue)
  ![Electron](https://img.shields.io/badge/Electron-25.3.0-47848F)
  ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
</div>

## 🎵 Overview

<div align="center">
  <img src="https://raw.githubusercontent.com/alexshcer/mood-classifier/refs/heads/main/Screenshot%202024-11-14%20at%207.06.17%E2%80%AFAM.png" alt="Mood Classifier Interface" width="800"/>
</div>

Mood Classifier is a sophisticated desktop application that analyzes music to determine various emotional and rhythmic characteristics. Using advanced deep learning models and audio processing techniques, it provides insights into:

- 💃 Danceability
- 😊 Happiness
- 😢 Sadness
- 😌 Relaxation
- 😠 Aggressiveness
- 🎼 Musical Key
- ⚡ BPM (Beats Per Minute)

## ✨ Features

- **YouTube Integration**: Download and analyze music directly from YouTube URLs
- **Drag & Drop**: Easy file upload interface
- **Real-time Visualization**: Beautiful waveform display of audio
- **Playback Controls**: Full audio playback functionality with play, pause, and seek
- **Modern UI**: Sleek, dark-themed interface with intuitive controls
- **Cross-Platform**: Works on macOS, Windows, and Linux

## 🛠 Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Electron.js
- **Audio Processing**: Essentia.js
- **Deep Learning**: TensorFlow.js
- **UI Framework**: Semantic UI
- **Audio Visualization**: WaveSurfer.js

## 🚀 Getting Started

1. Clone the repository

```bash
git clone https://github.com/alexshcer/mood-classifier.git
```
2. Install dependencies
```
npm install
```
3. Start the application
```
npm start
```
## 🎯 Usage

1. Launch the application
2. Either:
   - Drag and drop an audio file into the interface
   - Paste a YouTube URL and click "dna" to analyze
3. Wait for the analysis to complete
4. View the detailed mood classification results and audio controls

## 🧠 How It Works

The application uses a combination of signal processing and deep learning models to analyze audio features. It processes the audio through multiple neural networks trained on vast music datasets to classify different emotional characteristics.

## 👨‍💻 Author

**Alex Shcer**
- GitHub: [@alexshcer](https://github.com/alexshcer)

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License - see the [LICENSE](LICENSE) file for details.

### Model Licenses
- TempoCNN architecture models are derived from work licensed under the AGPL-3.0 license terms.
- Original TempoCNN models by Hendrik Schreiber: [tempo-cnn](https://github.com/hendriks73/tempo-cnn)

## 🙏 Acknowledgments

- Essentia.js for audio analysis capabilities
- Music Technology Group for research contributions
- TempoCNN project for tempo detection models

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/alexshcer">Alex Shcer</a>
</div>

