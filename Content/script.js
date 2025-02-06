let videos = [];
let audios = [];

// Add debug configuration at the top
const DEBUG = {
    enabled: true,
    logVideoState: true,
    logMediaEvents: true,
    slowPlayback: false
};

// Add debugVideoState as a global function
function debugVideoState() {
    return {
        display: videoPlayer.style.display,
        visibility: videoPlayer.style.visibility,
        opacity: videoPlayer.style.opacity,
        width: videoPlayer.offsetWidth,
        height: videoPlayer.offsetHeight,
        muted: videoPlayer.muted,
        readyState: videoPlayer.readyState,
        networkState: videoPlayer.networkState,
        paused: videoPlayer.paused,
        currentTime: videoPlayer.currentTime,
        duration: videoPlayer.duration,
        playbackRate: videoPlayer.playbackRate,
        error: videoPlayer.error
    };
}

// Load media files dynamically
async function loadMediaFiles() {
    try {
        const response = await fetch('/media-files');
        const data = await response.json();
        videos = data.videos;
        audios = data.audios;

        console.log(`Loaded ${videos.length} videos and ${audios.length} audio files`);
    } catch (error) {
        console.error('Failed to load media files:', error);
        document.body.classList.add('error');
        alert('Failed to load media files. Please add media files to the appropriate folders.');
    }
}

// Add server check
if (window.location.protocol === 'file:') {
    alert('This page needs to be run on a web server for media playback to work.');
}

// Validate media files
async function validateMedia() {
    try {
        if (videos.length > 0 && audios.length > 0) {
            // Change HEAD requests to GET for more reliable validation
            await Promise.all([
                fetch(videos[0]).then(response => {
                    if (!response.ok) throw new Error(`Video HTTP error! status: ${response.status}`);
                }),
                fetch(audios[0]).then(response => {
                    if (!response.ok) throw new Error(`Audio HTTP error! status: ${response.status}`);
                })
            ]);
        } else {
            throw new Error("Media files not loaded. Make sure you have the video and audio files set up.");
        }
    } catch (error) {
        console.error('Media files not found. Check your media folder setup. Error:', error.message);
        document.body.classList.add('error');
    }
}

// Update path validation to be async
async function validatePaths() {
    if (videos.length === 0 || audios.length === 0) {
        throw new Error('No media files configured');
    }
}

// Add debug logging
function logError(error, context) {
    console.error(`[${context}] ${error.message}`, error);
    document.body.classList.add('error');
}

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
    if (mediaCache.has(url)) {
        console.log(`Using cached media: ${url}`);
        return Promise.resolve(url); // Fix: Return a Promise for cached media
    }

    return new Promise((resolve, reject) => {
        const elem = url.endsWith('mp4') ? document.createElement('video') : document.createElement('audio');
        console.log(`Preloading media: ${url}`);
        
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
    }).catch((error) => {
        logError(error, 'Media Preload failed');
        throw error;
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
    console.group('Media Change Operation');
    try {
        // Hide the click button on first playback
        if (!playbackStarted) {
            clickLink.parentElement.style.opacity = '0';
            // Wait for fade out animation
            await new Promise(resolve => setTimeout(resolve, 300));
            clickLink.parentElement.style.display = 'none';
            playbackStarted = true;
            console.log('Click button hidden - first playback started');
        }

        const randomVideo = getRandomMedia(videos);
        const randomAudio = getRandomMedia(audios);
        
        console.log('Starting media change:', {
            video: randomVideo,
            audio: randomAudio
        });

        // Reset both players
        videoPlayer.pause();
        audioPlayer.pause();
        videoPlayer.currentTime = 0;
        audioPlayer.currentTime = 0;

        // Reset media state
        videoPlayer.style.display = 'block';
        videoPlayer.style.visibility = 'visible';
        videoPlayer.style.opacity = '1';
        videoPlayer.muted = true;

        // Set new sources
        videoPlayer.src = randomVideo;
        audioPlayer.src = randomAudio;

        // Wait for both media to be ready
        await Promise.all([
            new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), MEDIA_TIMEOUT);
                
                const onCanPlay = () => {
                    clearTimeout(timeoutId);
                    videoPlayer.removeEventListener('canplaythrough', onCanPlay);
                    resolve();
                };
                
                videoPlayer.addEventListener('canplaythrough', onCanPlay);
                videoPlayer.addEventListener('error', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Video load failed'));
                }, { once: true });
            }),
            new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Audio load timeout')), MEDIA_TIMEOUT);
                
                const onCanPlay = () => {
                    clearTimeout(timeoutId);
                    audioPlayer.removeEventListener('canplaythrough', onCanPlay);
                    resolve();
                };
                
                audioPlayer.addEventListener('canplaythrough', onCanPlay);
                audioPlayer.addEventListener('error', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Audio load failed'));
                }, { once: true });
            })
        ]);

        // Synchronize playback start
        try {
            videoPlayer.currentTime = 0;
            audioPlayer.currentTime = 0;
            
            // Start both media elements simultaneously
            await Promise.all([
                videoPlayer.play().catch(e => {
                    console.warn('Video autoplay failed:', e);
                    return videoPlayer.play();
                }),
                audioPlayer.play().catch(e => {
                    console.warn('Audio autoplay failed:', e);
                    return audioPlayer.play();
                })
            ]);

            // Set up sync check interval
            const syncInterval = setInterval(() => {
                const timeDiff = Math.abs(videoPlayer.currentTime - audioPlayer.currentTime);
                if (timeDiff > 0.1) {
                    console.log('Resynchronizing media, drift:', timeDiff);
                    audioPlayer.currentTime = videoPlayer.currentTime;
                }
            }, 1000);

            // Clean up sync interval when media ends or errors
            videoPlayer.addEventListener('ended', () => clearInterval(syncInterval), { once: true });
            videoPlayer.addEventListener('error', () => clearInterval(syncInterval), { once: true });

        } catch (e) {
            console.warn('Playback start failed:', e);
            throw e;
        }

        currentVideo = randomVideo;
        currentAudio = randomAudio;
        
        // Update cache and preload next
        Array.from(mediaCache.keys())
            .filter(url => url !== currentVideo && url !== currentAudio)
            .forEach(url => mediaCache.delete(url));
            
        preloadNextMedia();
    } catch (error) {
        // If error on first play, show the button again
        if (!playbackStarted) {
            clickLink.parentElement.style.display = 'block';
            clickLink.parentElement.style.opacity = '1';
        }
        logError(error, 'Media change failed');
        videoPlayer.style.opacity = '0';
        await fadeVolume(audioPlayer, 0, VOLUME_FADE_DURATION);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Enhanced event listeners for debugging
if (DEBUG.logMediaEvents) {
    const videoEvents = ['loadstart', 'progress', 'suspend', 'abort', 'error', 
                        'emptied', 'stalled', 'loadedmetadata', 'loadeddata', 
                        'canplay', 'canplaythrough', 'playing', 'waiting', 
                        'seeking', 'seeked', 'ended', 'durationchange', 
                        'timeupdate', 'play', 'pause', 'ratechange', 
                        'resize', 'volumechange'];
    
    videoEvents.forEach(event => {
        videoPlayer.addEventListener(event, () => {
            console.log(`Video event: ${event}`, debugVideoState());
        });
    });
}

// Add a check to ensure button stays hidden after first click
clickLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!playbackStarted) {
        clickLink.parentElement.style.pointerEvents = 'none';
    }
    startRandomPlayback();
});

document.addEventListener('click', (e) => {
    if (playbackStarted && e.target !== clickLink) {
        startRandomPlayback();
    }
});

// Handle video loading events
videoPlayer.addEventListener('playing', () => {
    console.log('Video playing - ensuring visibility');
    videoPlayer.style.display = 'block';
    videoPlayer.style.visibility = 'visible';
    videoPlayer.style.opacity = '1';
});

videoPlayer.addEventListener('waiting', () => {
    console.log('Video is waiting/buffering');
    videoPlayer.style.opacity = '0';
});

// Add new error logging
videoPlayer.addEventListener('stalled', () => {
    console.log('Video stalled - attempting to resume');
    if (!videoPlayer.paused) {
        videoPlayer.play().catch(e => console.warn('Resume failed:', e));
    }
});

videoPlayer.addEventListener('suspend', () => {
    console.log('Video suspended - attempting to resume');
    if (!videoPlayer.paused) {
        videoPlayer.play().catch(e => console.warn('Resume failed:', e));
    }
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

// Update event listeners at the end of the file
async function init() {
    try {
        await loadMediaFiles();
        await validatePaths();
        await validateMedia();
    } catch (error) {
        logError(error, 'Initialization failed');
    }
}

// Start the application
init();
