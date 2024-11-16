
const img = document.getElementById('album-art');
const colorThief = new ColorThief();

img.onload = () => {
    const dominantColor = colorThief.getColor(img);
    document.querySelector('.lyrics-overlay').style.backgroundColor = `rgba(${dominantColor.join(',')}, 0.5)`;
    document.querySelector('.lyrics-header .song-title').style.color = `rgb(${dominantColor.join(',')})`;
};

// Set the background image
document.getElementById('background').style.backgroundImage = `url(${img.src})`;

export function createDynamicBackground() {
    const container = document.createElement('div');
    container.className = 'dynamic-background-container';
    const grid = document.createElement('div');
    grid.className = 'color-grid';
    container.appendChild(grid);
    document.body.appendChild(container);

    // Create grid cells
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'color-cell';
        cell.style.setProperty('--delay', i);
        grid.appendChild(cell);
    }
}

export function initializeBackground() {
    // Add necessary CSS styles
    const styles = `
        .dynamic-background-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
            opacity: 0.3;
            transition: opacity 0.5s ease;
        }

        .color-grid {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            width: 120%;
            height: 120%;
            filter: blur(100px);
            transform: translate(-10%, -10%);
        }

        .color-cell {
            width: 100%;
            height: 100%;
            transition: background-color 1.5s ease;
            animation: colorPulse 8s infinite;
            animation-delay: calc(var(--delay) * 0.3s);
        }

        @keyframes colorPulse {
            0% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0.7; }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

export function updateBackground(colors) {
    const cells = document.querySelectorAll('.color-cell');
    cells.forEach((cell, index) => {
        const colorIndex = index % colors.length;
        cell.style.backgroundColor = colors[colorIndex];
    });
}

export function handleAlbumArtLoad(albumArtUrl) {
    if (!albumArtUrl) return;
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = function() {
        const colorThief = new ColorThief();
        try {
            // Get a larger palette for more variety
            const palette = colorThief.getPalette(img, 8);
            const colors = palette.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
            
            console.log('Extracted colors:', colors); // Debug log
            
            // Create the color grid first
            const colorGrid = document.querySelector('.lyrics-color-grid');
            if (colorGrid) {
                colorGrid.innerHTML = '';
                
                // Create 64 cells (8x8 grid)
                for (let i = 0; i < 64; i++) {
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
                    cell.style.animationDelay = `${(i * 0.1)}s`;
                    colorGrid.appendChild(cell);
                }
            }
        } catch (error) {
            console.error('Error extracting colors:', error);
        }
    };
    
    img.onerror = function() {
        console.error('Error loading image:', albumArtUrl);
    };
    
    img.src = albumArtUrl;
}