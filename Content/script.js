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

const MEDIA_TIMEOUT = 10000; // 10 seconds timeout for media loading
const mediaLoadTimers = new Map();

const VOLUME_FADE_DURATION = 200;
const MIN_LOAD_TIME = 100;

function getRandomMedia(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function clearMediaLoadTimer(url) {
    if (mediaLoadTimers.has(url)) {
        clearTimeout(mediaLoadTimers.get(url));
        mediaLoadTimers.delete(url);
    }
}

function preloadMedia(url) {
    if (mediaCache.has(url)) return mediaCache.get(url);
    
    return new Promise((resolve, reject) => {
        const elem = url.endsWith('mp4') ? document.createElement('video') : document.createElement('audio');
        
        const timeoutId = setTimeout(() => {
            elem.remove();
            reject(new Error('Media load timeout'));
        }, MEDIA_TIMEOUT);
        
        mediaLoadTimers.set(url, timeoutId);
        
        elem.onloadeddata = () => {
            clearMediaLoadTimer(url);
            mediaCache.set(url, url);
            resolve(url);
        };
        
        elem.onerror = () => {
            clearMediaLoadTimer(url);
            elem.remove();
            reject(new Error('Media load failed'));
        };
        
        elem.src = url;
        elem.preload = 'auto';
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

function fadeVolume(element, targetVolume, duration) {
    const startVolume = element.volume;
    const startTime = performance.now();
    
    return new Promise(resolve => {
        function updateVolume() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            element.volume = startVolume + (targetVolume - startVolume) * progress;
            
            if (progress < 1) {
                requestAnimationFrame(updateVolume);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(updateVolume);
    });
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
        
        // Cancel any ongoing media operations
        if (currentVideo) clearMediaLoadTimer(currentVideo);
        if (currentAudio) clearMediaLoadTimer(currentAudio);
        
        // Reset media state
        videoPlayer.style.display = 'block';
        videoPlayer.style.opacity = '0';
        await fadeVolume(audioPlayer, 0, VOLUME_FADE_DURATION);
        
        // Ensure minimum loading time for UI feedback
        await Promise.all([
            new Promise(resolve => setTimeout(resolve, MIN_LOAD_TIME)),
            preloadMedia(randomVideo).catch(() => randomVideo),
            preloadMedia(randomAudio).catch(() => randomAudio)
        ]);
        
        // Set new sources
        videoPlayer.src = randomVideo;
        audioPlayer.src = randomAudio;
        
        // Start playback with volume fade-in
        const playPromises = await Promise.all([
            videoPlayer.play().catch(() => {
                throw new Error('Video playback failed');
            }),
            audioPlayer.play().catch(() => {
                throw new Error('Audio playback failed');
            })
        ]);
        
        await fadeVolume(audioPlayer, DEFAULT_VOLUME, VOLUME_FADE_DURATION);
        videoPlayer.style.opacity = '1';
        currentVideo = randomVideo;
        currentAudio = randomAudio;
        
        // Clean up old cached media
        Array.from(mediaCache.keys())
            .filter(url => url !== currentVideo && url !== currentAudio)
            .forEach(url => mediaCache.delete(url));
            
        preloadNextMedia();
    } catch (error) {
        videoPlayer.style.opacity = '0';
        await fadeVolume(audioPlayer, 0, VOLUME_FADE_DURATION);
        throw error;
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
    document.body.classList.remove('loading');
    videoPlayer.style.opacity = '0';
    fadeVolume(audioPlayer, 0, VOLUME_FADE_DURATION);
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
    mediaLoadTimers.forEach(timerId => clearTimeout(timerId));
    mediaLoadTimers.clear();
});
