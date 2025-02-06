// File paths configuration
const videos = [
    '../media/video/video1.mp4',
    '../media/video/video2.mp4'
    // Add more video paths
];

const audios = [
    '../media/audio/audio1.mp3',
    '../media/audio/audio2.mp3'
    // Add more audio paths
];

// DOM elements
const clickLink = document.getElementById('clickLink');
const videoPlayer = document.getElementById('videoPlayer');
const audioPlayer = document.getElementById('audioPlayer');

let playbackStarted = false;
let isChanging = false;
let currentVideo = null;
let currentAudio = null;

let retryCount = 0;
const MAX_RETRIES = 3;
const DEFAULT_VOLUME = 0.7;

const FADE_DURATION = 300;
let mediaCache = new Map();
let isPreloading = false;

function getRandomMedia(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function preloadMedia(url) {
    if (mediaCache.has(url)) return mediaCache.get(url);
    
    return new Promise((resolve, reject) => {
        const elem = url.endsWith('mp4') ? document.createElement('video') : document.createElement('audio');
        elem.src = url;
        elem.preload = 'auto';
        
        elem.onloadeddata = () => {
            mediaCache.set(url, url);
            resolve(url);
        };
        elem.onerror = reject;
    });
}

async function preloadNextMedia() {
    if (isPreloading) return;
    isPreloading = true;
    
    try {
        const nextVideo = getRandomMedia(videos);
        const nextAudio = getRandomMedia(audios);
        await Promise.all([
            preloadMedia(nextVideo),
            preloadMedia(nextAudio)
        ]);
    } catch (error) {
        console.warn('Preload failed:', error);
    } finally {
        isPreloading = false;
    }
}

async function startRandomPlayback() {
    if (isChanging) return;
    isChanging = true;
    document.body.classList.add('loading');

    try {
        await changeMedia();
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            await startRandomPlayback();
            return;
        }
        console.error('Failed after retries:', error);
        alert('Media playback failed. Please try again.');
    } finally {
        document.body.classList.remove('loading');
        isChanging = false;
        retryCount = 0;
    }
}

async function changeMedia() {
    if (!playbackStarted) {
        clickLink.parentElement.style.display = 'none';
        playbackStarted = true;
    }

    // Fade out current media
    videoPlayer.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, FADE_DURATION));

    // Stop and reset current media
    videoPlayer.pause();
    audioPlayer.pause();
    
    try {
        const randomVideo = getRandomMedia(videos);
        const randomAudio = getRandomMedia(audios);
        
        // Set new sources
        videoPlayer.src = randomVideo;
        audioPlayer.src = randomAudio;
        audioPlayer.volume = DEFAULT_VOLUME;
        
        // Start playback
        videoPlayer.style.display = 'block';
        await Promise.all([
            videoPlayer.play(),
            audioPlayer.play()
        ]);
        
        videoPlayer.style.opacity = '1';
        currentVideo = randomVideo;
        currentAudio = randomAudio;
        
        // Preload next media
        preloadNextMedia();
    } catch (error) {
        throw new Error(`Media change failed: ${error.message}`);
    }
}

// Update event listeners
clickLink.addEventListener('click', (e) => {
    e.preventDefault();
    startRandomPlayback();
});

document.addEventListener('click', (e) => {
    if (playbackStarted && e.target !== clickLink) {
        startRandomPlayback();
    }
});

// Handle video loading events
videoPlayer.addEventListener('playing', () => {
    videoPlayer.style.opacity = '1';
});

videoPlayer.addEventListener('waiting', () => {
    videoPlayer.style.opacity = '0';
});

// Update error handling
function handleMediaError(error, type) {
    console.error(`${type} playback error:`, error);
    if (mediaCache.has(currentVideo)) mediaCache.delete(currentVideo);
    if (mediaCache.has(currentAudio)) mediaCache.delete(currentAudio);
}

videoPlayer.addEventListener('error', (e) => handleMediaError(e, 'Video'));
audioPlayer.addEventListener('error', (e) => handleMediaError(e, 'Audio'));

// Add keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && playbackStarted) {
        e.preventDefault();
        startRandomPlayback();
    }
});

// Clean up resources when page is hidden/closed
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        videoPlayer.pause();
        audioPlayer.pause();
    }
});

window.addEventListener('beforeunload', () => {
    mediaCache.clear();
});
