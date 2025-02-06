const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Directory setup
const mediaPath = path.join(__dirname, 'Content', 'media');
const videoPath = path.join(mediaPath, 'video');
const audioPath = path.join(mediaPath, 'audio');

// Create folders if they don't exist
[mediaPath, videoPath, audioPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Serve the media files list dynamically
app.get('/media-files', (req, res) => {
    try {
        const videos = fs.readdirSync(videoPath)
            .filter(file => file.match(/\.(mp4|webm|mov)$/i))
            .map(file => `/media/video/${file}`);
            
        const audios = fs.readdirSync(audioPath)
            .filter(file => file.match(/\.(mp3|wav|ogg)$/i))
            .map(file => `/media/audio/${file}`);

        res.json({ videos, audios });
    } catch (error) {
        console.error('Error scanning media directories:', error);
        res.status(500).json({ error: 'Failed to scan media directories' });
    }
});

// Check if media files exist
const hasVideo = fs.existsSync(path.join(videoPath, 'test.mp4'));
const hasAudio = fs.existsSync(path.join(audioPath, 'test.mp3'));

if (!hasVideo || !hasAudio) {
    console.error('\nMissing media files:');
    if (!hasVideo) console.error('- Need test.mp4 in Content/media/video/');
    if (!hasAudio) console.error('- Need test.mp3 in Content/media/audio/');
    console.error('\nPlease add the required media files and restart the server.');
}

// Log available media files
console.log('\nAvailable media files:');
console.log('Videos:', fs.readdirSync(videoPath));
console.log('Audio:', fs.readdirSync(audioPath));

app.use(express.static('Content'));

// Add better error handling for missing files
app.use((req, res, next) => {
    if (req.url.includes('/media/')) {
        const filePath = path.join(__dirname, 'Content', req.url);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${req.url}`);
            return res.status(404).send('Media file not found');
        }
    }
    next();
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:3000`);
});
