// Main JavaScript for CINEBOX Dashboard

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    loadUserPreferences();
});

// Initialize Dashboard Features
function initializeDashboard() {
    console.log('🎬 CINEBOX Dashboard initialized');
    
    // Animate elements on scroll
    observeScrollAnimations();
    
    // Load watch progress from localStorage
    loadAllWatchProgress();
    
    // Setup video card clicks
    setupVideoCards();
    
    // Initialize search functionality if exists
    setupSearch();
}

// Setup Event Listeners
function setupEventListeners() {
    // Watchlist buttons
    document.querySelectorAll('.add-to-watchlist').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const videoId = this.dataset.videoId;
            addToWatchlist(videoId);
        });
    });
    
    // Play buttons
    document.querySelectorAll('.play-button').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const videoId = this.dataset.videoId;
            playVideo(videoId);
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Press '?' for help
        if (e.key === '?') {
            showKeyboardShortcuts();
        }
        // Press 'F' for fullscreen (if video player exists)
        if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        }
    });
}

// Load Watch Progress for All Videos
function loadAllWatchProgress() {
    const videoCards = document.querySelectorAll('.video-card, .movie-item');
    videoCards.forEach(card => {
        const videoId = card.dataset.videoId;
        if (videoId) {
            const progress = localStorage.getItem(`progress_${videoId}`);
            if (progress && parseFloat(progress) > 0) {
                const progressBadge = card.querySelector('.progress-badge');
                if (progressBadge) {
                    progressBadge.textContent = `${Math.round(progress)}% watched`;
                    progressBadge.style.display = 'inline-block';
                }
            }
        }
    });
}

// Add to Watchlist Function
async function addToWatchlist(videoId) {
    try {
        const response = await fetch(`/api/watchlist/add/${videoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            showToast('Added to watchlist!', 'success');
            updateWatchlistCount();
        } else {
            showToast('Already in watchlist', 'info');
        }
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        showToast('Error adding to watchlist', 'error');
    }
}

// Remove from Watchlist
async function removeFromWatchlist(videoId) {
    try {
        const response = await fetch(`/api/watchlist/remove/${videoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            showToast('Removed from watchlist', 'success');
            // Remove element from DOM
            const watchlistItem = document.querySelector(`.watchlist-item[data-video-id="${videoId}"]`);
            if (watchlistItem) {
                watchlistItem.remove();
            }
            updateWatchlistCount();
        }
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        showToast('Error removing from watchlist', 'error');
    }
}

// Update Watchlist Count
async function updateWatchlistCount() {
    try {
        const response = await fetch('/api/watchlist/count');
        const data = await response.json();
        const watchlistBadge = document.querySelector('.watchlist-count');
        if (watchlistBadge) {
            watchlistBadge.textContent = data.count;
        }
    } catch (error) {
        console.error('Error updating watchlist count:', error);
    }
}

// Play Video
function playVideo(videoId) {
    window.location.href = `/video/${videoId}`;
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterVideos(searchTerm);
        }, 300));
    }
}

// Filter Videos Based on Search Term
function filterVideos(searchTerm) {
    const videoCards = document.querySelectorAll('.video-card');
    let visibleCount = 0;
    
    videoCards.forEach(card => {
        const title = card.querySelector('h5')?.textContent.toLowerCase() || '';
        const genre = card.querySelector('small')?.textContent.toLowerCase() || '';
        
        if (title.includes(searchTerm) || genre.includes(searchTerm)) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show no results message
    const noResultsMsg = document.getElementById('no-results');
    if (noResultsMsg) {
        noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Get Toast Icon Based on Type
function getToastIcon(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Scroll Animation Observer
function observeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all section cards
    document.querySelectorAll('.section-card, .stat-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.5s ease-out';
        observer.observe(el);
    });
}

// Load User Preferences from LocalStorage
function loadUserPreferences() {
    // Load theme preference
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Load autoplay preference
    const autoplay = localStorage.getItem('autoplay');
    if (autoplay === 'false') {
        // Disable autoplay for video player
        const video = document.querySelector('video');
        if (video) {
            video.autoplay = false;
        }
    }
}

// Save User Preference
function saveUserPreference(key, value) {
    localStorage.setItem(key, value);
    showToast('Preference saved!', 'success');
}

// Toggle Theme
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    saveUserPreference('theme', isLight ? 'light' : 'dark');
}

// Show Keyboard Shortcuts Modal
function showKeyboardShortcuts() {
    const shortcuts = `
        🎬 Keyboard Shortcuts:
        • Space - Play/Pause
        • F - Fullscreen
        • M - Mute/Unmute
        • ← → - Seek backward/forward
        • ↑ ↓ - Volume control
        • ? - Show this help
    `;
    showToast(shortcuts, 'info');
}

// Toggle Fullscreen
function toggleFullscreen() {
    const videoPlayer = document.querySelector('video');
    if (!videoPlayer) return;
    
    if (!document.fullscreenElement) {
        videoPlayer.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Video Player Controls Enhancement
function enhanceVideoPlayer(videoElement) {
    if (!videoElement) return;
    
    // Add keyboard controls
    videoElement.addEventListener('keydown', function(e) {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                this.paused ? this.play() : this.pause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.currentTime -= 5;
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.currentTime += 5;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.volume = Math.min(1, this.volume + 0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.volume = Math.max(0, this.volume - 0.1);
                break;
        }
    });
    
    // Save progress periodically
    let saveInterval;
    videoElement.addEventListener('play', () => {
        saveInterval = setInterval(() => {
            const progress = (videoElement.currentTime / videoElement.duration) * 100;
            localStorage.setItem(`progress_${videoElement.dataset.videoId}`, videoElement.currentTime);
            
            // Send to server
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_id: videoElement.dataset.videoId,
                    progress: Math.floor(progress)
                })
            });
        }, 5000);
    });
    
    videoElement.addEventListener('pause', () => {
        clearInterval(saveInterval);
    });
    
    videoElement.addEventListener('ended', () => {
        clearInterval(saveInterval);
        localStorage.removeItem(`progress_${videoElement.dataset.videoId}`);
    });
}

// Export functions for global use
window.CINEBOX = {
    addToWatchlist,
    removeFromWatchlist,
    playVideo,
    showToast,
    toggleTheme,
    enhanceVideoPlayer
};

// Initialize video players on page load
if (document.querySelector('video')) {
    enhanceVideoPlayer(document.querySelector('video'));
}

// Add CSS animation for toast removal
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
