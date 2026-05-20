// Advanced Video Player Controls
class VideoPlayer {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.options = {
            autoSaveProgress: true,
            keyboardControls: true,
            ...options
        };
        
        this.progressSaveInterval = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSavedProgress();
        if (this.options.keyboardControls) {
            this.setupKeyboardControls();
        }
    }
    
    setupEventListeners() {
        // Play/Pause toggle on click
        this.video.addEventListener('click', () => this.togglePlay());
        
        // Save progress on timeupdate
        if (this.options.autoSaveProgress) {
            this.video.addEventListener('play', () => this.startProgressSaving());
            this.video.addEventListener('pause', () => this.stopProgressSaving());
            this.video.addEventListener('ended', () => this.onVideoEnd());
        }
        
        // Update UI on play/pause
        this.video.addEventListener('play', () => this.updatePlayButton(true));
        this.video.addEventListener('pause', () => this.updatePlayButton(false));
        
        // Update progress bar
        this.video.addEventListener('timeupdate', () => this.updateProgressBar());
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            // Prevent default for media keys
            const mediaKeys = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'f', 'F', 'm', 'M'];
            if (mediaKeys.includes(e.key)) {
                e.preventDefault();
            }
            
            switch(e.key) {
                case ' ':
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    this.seek(-5);
                    break;
                case 'ArrowRight':
                    this.seek(5);
                    break;
                case 'ArrowUp':
                    this.changeVolume(0.1);
                    break;
                case 'ArrowDown':
                    this.changeVolume(-0.1);
                    break;
                case 'f':
                case 'F':
                    this.toggleFullscreen();
                    break;
                case 'm':
                case 'M':
                    this.toggleMute();
                    break;
            }
        });
    }
    
    togglePlay() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }
    
    seek(seconds) {
        this.video.currentTime += seconds;
        this.showSeekNotification(seconds);
    }
    
    changeVolume(delta) {
        this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
        this.showVolumeNotification();
    }
    
    toggleMute() {
        this.video.muted = !this.video.muted;
        this.showVolumeNotification();
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.video.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    loadSavedProgress() {
        const videoId = this.video.dataset.videoId;
        const savedTime = localStorage.getItem(`progress_${videoId}`);
        if (savedTime && parseFloat(savedTime) > 0) {
            const resume = confirm(`Resume from ${Math.floor(savedTime / 60)}:${Math.floor(savedTime % 60)}?`);
            if (resume) {
                this.video.currentTime = parseFloat(savedTime);
            }
        }
    }
    
    startProgressSaving() {
        this.progressSaveInterval = setInterval(() => {
            this.saveProgress();
        }, 5000);
    }
    
    stopProgressSaving() {
        if (this.progressSaveInterval) {
            clearInterval(this.progressSaveInterval);
            this.saveProgress(); // Final save
        }
    }
    
    saveProgress() {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        const videoId = this.video.dataset.videoId;
        
        // Save to localStorage
        localStorage.setItem(`progress_${videoId}`, this.video.currentTime);
        
        // Save to server
        fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_id: videoId,
                progress: Math.floor(progress)
            })
        }).catch(err => console.error('Error saving progress:', err));
    }
    
    onVideoEnd() {
        const videoId = this.video.dataset.videoId;
        localStorage.removeItem(`progress_${videoId}`);
        
        // Show next episode/recommendation
        this.showNextVideoRecommendation();
    }
    
    updateProgressBar() {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        const progressBar = document.querySelector('.video-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    updatePlayButton(isPlaying) {
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            playButton.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        }
    }
    
    showSeekNotification(seconds) {
        const notification = document.createElement('div');
        notification.className = 'seek-notification';
        notification.textContent = `${seconds > 0 ? '+' : ''}${seconds} sec`;
        notification.style.cssText = `
            position: fixed;
            bottom: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: fadeOut 1s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 1000);
    }
    
    showVolumeNotification() {
        const volume = Math.round(this.video.volume * 100);
        const notification = document.createElement('div');
        notification.className = 'volume-notification';
        notification.innerHTML = `
            <i class="fas ${this.video.muted ? 'fa-volume-mute' : 'fa-volume-up'}"></i>
            <span>${volume}%</span>
        `;
        notification.style.cssText = `
            position: fixed;
            bottom: 20%;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            z-index: 1000;
            animation: fadeOut 1s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 1000);
    }
    
    showNextVideoRecommendation() {
        // Get next video from playlist or recommendations
        const nextVideo = document.querySelector('.related-card:first-child');
        if (nextVideo) {
            const notification = document.createElement('div');
            notification.className = 'next-video-notification';
            notification.innerHTML = `
                <div style="background: rgba(0,0,0,0.9); padding: 15px; border-radius: 12px; text-align: center;">
                    <p>Next video in 5 seconds...</p>
                    <h4>${nextVideo.querySelector('h5')?.textContent || 'Next Video'}</h4>
                    <button onclick="window.location.href='${nextVideo.dataset.url}'">Play Now</button>
                </div>
            `;
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                window.location.href = nextVideo.dataset.url;
            }, 5000);
        }
    }
}

// Initialize video player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
        window.player = new VideoPlayer(videoElement, {
            autoSaveProgress: true,
            keyboardControls: true
        });
    }
});

// Add animations to stylesheet
const playerStyles = document.createElement('style');
playerStyles.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; transform: translateX(-50%) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) scale(0.9); }
    }
    
    .seek-notification, .volume-notification {
        pointer-events: none;
    }
    
    .next-video-notification button {
        background: linear-gradient(135deg, #FFD966, #FF8C42);
        border: none;
        padding: 8px 20px;
        border-radius: 20px;
        color: white;
        cursor: pointer;
        margin-top: 10px;
        font-weight: 600;
    }
    
    .next-video-notification button:hover {
        transform: scale(1.05);
    }
`;
document.head.appendChild(playerStyles);
