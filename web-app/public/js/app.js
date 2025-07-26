class ClipboardTTSApp {
    constructor() {
        this.currentRecord = null;
        this.currentAudio = null;
        this.audioElement = null;
        this.isPlaying = false;
        this.currentSpeed = 1.0;
        this.availableSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Clipboard TTS App...');
        
        // Initialize DOM elements
        this.initElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check system health
        await this.checkHealth();
        
        // Load records
        await this.loadRecords();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        console.log('✅ App initialized successfully');
    }

    initElements() {
        // Status elements
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        
        // Record list elements
        this.recordsList = document.getElementById('records-list');
        this.refreshBtn = document.getElementById('refresh-btn');
        
        // Content elements
        this.welcomeMessage = document.getElementById('welcome-message');
        this.recordContent = document.getElementById('record-content');
        this.recordId = document.getElementById('record-id');
        this.recordDate = document.getElementById('record-date');
        this.recordStatus = document.getElementById('record-status');
        this.questionText = document.getElementById('question-text');
        this.answerText = document.getElementById('answer-text');
        
        // Audio elements
        this.audioSection = document.getElementById('audio-section');
        this.audioElement = document.getElementById('audio-element');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.playIcon = document.querySelector('.play-icon');
        this.restartBtn = document.getElementById('restart-btn');
        this.speedBtn = document.getElementById('speed-btn');
        this.speedText = document.querySelector('.speed-text');
        
        // Progress elements
        this.progressBar = document.getElementById('progress-bar');
        this.progressFill = document.getElementById('progress-fill');
        this.progressHandle = document.getElementById('progress-handle');
        this.currentTime = document.getElementById('current-time');
        this.totalTime = document.getElementById('total-time');
        
        // Volume elements
        this.volumeBtn = document.getElementById('volume-btn');
        this.volumeIcon = document.querySelector('.volume-icon');
        this.volumeSlider = document.getElementById('volume-slider');
        
        // Control elements
        this.deleteBtn = document.getElementById('delete-btn');
        
        // Modal elements
        this.deleteModal = document.getElementById('delete-modal');
        this.deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        this.deleteCancelBtn = document.getElementById('delete-cancel-btn');
        
        // Error elements
        this.errorMessage = document.getElementById('error-message');
        this.errorText = document.getElementById('error-text');
        this.errorCloseBtn = document.getElementById('error-close-btn');
        
        // Loading elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
    }

    setupEventListeners() {
        // Refresh button
        this.refreshBtn.addEventListener('click', () => this.loadRecords());
        
        // Record list click delegation - THIS IS THE KEY FIX
        this.recordsList.addEventListener('click', (event) => {
            const recordItem = event.target.closest('.record-item');
            if (recordItem) {
                const recordId = parseInt(recordItem.getAttribute('data-id'));
                if (recordId) {
                    console.log(`🖱️ Clicked record ${recordId}`);
                    this.selectRecord(recordId);
                }
            }
        });
        
        // Audio controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.restartBtn.addEventListener('click', () => this.restartAudio());
        this.speedBtn.addEventListener('click', () => this.cycleSpeed());
        
        // Progress bar
        this.progressBar.addEventListener('click', (e) => this.seekAudio(e));
        
        // Volume control
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        
        // Delete controls
        this.deleteBtn.addEventListener('click', () => this.showDeleteModal());
        this.deleteConfirmBtn.addEventListener('click', () => this.confirmDelete());
        this.deleteCancelBtn.addEventListener('click', () => this.hideDeleteModal());
        
        // Error controls
        this.errorCloseBtn.addEventListener('click', () => this.hideError());
        
        // Audio events
        this.setupAudioEventListeners();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupAudioEventListeners() {
        if (this.audioElement) {
            this.audioElement.addEventListener('loadedmetadata', () => this.updateTotalTime());
            this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
            this.audioElement.addEventListener('ended', () => this.onAudioEnded());
            this.audioElement.addEventListener('error', (e) => this.onAudioError(e));
        }
    }

    async checkHealth() {
        try {
            const response = await fetch('/health');
            const result = await response.json();
            
            if (result.status === 'ok') {
                this.setStatus('online', 'System Online');
            } else {
                this.setStatus('offline', 'System Error');
            }
        } catch (error) {
            console.error('❌ Health check failed:', error);
            this.setStatus('offline', 'Connection Failed');
        }
    }

    setStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    async loadRecords() {
        try {
            console.log('📋 Loading records...');
            this.showLoading('Loading records...');
            
            const response = await fetch('/api/records');
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to load records');
            }
            
            console.log(`📋 Loaded ${result.data.length} records:`, result.data);
            this.displayRecords(result.data);
            
        } catch (error) {
            console.error('❌ Failed to load records:', error);
            this.showError(`Failed to load records: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    displayRecords(recordIds) {
        console.log('📋 Displaying records:', recordIds);
        
        if (!recordIds || recordIds.length === 0) {
            this.recordsList.innerHTML = `
                <div class="no-records">
                    <p>No records found</p>
                    <p style="font-size: 0.9rem; color: #718096; margin-top: 0.5rem;">
                        Use Ctrl+Alt+C to capture your first question
                    </p>
                </div>
            `;
            return;
        }

        // FIXED: Removed inline onclick handlers, using event delegation instead
        this.recordsList.innerHTML = recordIds.map(id => `
            <div class="record-item" data-id="${id}">
                <div class="record-id">Record #${id}</div>
                <div class="record-preview" id="preview-${id}">Loading...</div>
            </div>
        `).join('');
        
        // Load previews for each record
        recordIds.forEach(id => this.loadRecordPreview(id));
    }

    async loadRecordPreview(id) {
        try {
            const response = await fetch(`/api/records/${id}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const previewElement = document.getElementById(`preview-${id}`);
                if (previewElement) {
                    const question = result.data.question || 'No question';
                    previewElement.textContent = question.length > 80 
                        ? question.substring(0, 80) + '...' 
                        : question;
                }
            }
        } catch (error) {
            console.warn(`⚠️ Failed to load preview for record ${id}:`, error);
            const previewElement = document.getElementById(`preview-${id}`);
            if (previewElement) {
                previewElement.textContent = 'Error loading preview';
            }
        }
    }

    async selectRecord(id) {
        try {
            console.log(`🎯 Selecting record ${id}`);
            
            // Update UI to show selected
            document.querySelectorAll('.record-item').forEach(item => {
                item.classList.remove('active');
            });
            const selectedItem = document.querySelector(`[data-id="${id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
                console.log(`✅ Marked record ${id} as active`);
            }
            
            this.showLoading('Loading record...');
            
            const response = await fetch(`/api/records/${id}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to load record');
            }
            
            console.log(`📄 Loaded record ${id}:`, result.data);
            this.displayRecord(result.data);
            
        } catch (error) {
            console.error(`❌ Failed to load record ${id}:`, error);
            this.showError(`Failed to load record: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    displayRecord(record) {
        console.log(`🖥️ Displaying record:`, record);
        
        this.currentRecord = record;
        
        // Hide welcome message and show record content
        this.welcomeMessage.classList.add('hidden');
        this.recordContent.classList.remove('hidden');
        
        console.log(`👁️ Showing record content, hiding welcome message`);
        
        // Update record info
        this.recordId.textContent = record.id;
        this.recordDate.textContent = this.formatDate(record.created_at);
        
        // Update status
        let status = 'Processing...';
        let statusClass = 'processing';
        
        if (record.answer && record.mp3path) {
            status = 'Complete';
            statusClass = 'complete';
        } else if (record.answer) {
            status = 'Generating Audio...';
            statusClass = 'processing';
        } else {
            status = 'Processing Question...';
            statusClass = 'processing';
        }
        
        this.recordStatus.textContent = status;
        this.recordStatus.className = `record-status ${statusClass}`;
        
        // Display question
        this.questionText.textContent = record.question || 'No question text';
        console.log(`❓ Question: ${record.question}`);
        
        // Display answer
        if (record.answer) {
            this.answerText.textContent = record.answer;
            console.log(`💬 Answer: ${record.answer.substring(0, 100)}...`);
        } else {
            this.answerText.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; color: #718096;">
                    <div class="spinner"></div>
                    <span>AI is processing your question...</span>
                </div>
            `;
            console.log(`⏳ No answer yet, showing spinner`);
        }
        
        // Handle audio
        if (record.mp3path && !record.mp3path.startsWith('ERROR:')) {
            console.log(`🎵 Setting up audio: ${record.mp3path}`);
            this.setupAudio(record.mp3path);
        } else if (record.answer && !record.mp3path) {
            // Answer exists but no audio yet - show generating message
            console.log(`🎵 Audio being generated for answered question`);
            this.showAudioNotReady();
        } else if (record.mp3path && record.mp3path.startsWith('ERROR:')) {
            // There was an error generating audio
            console.log(`❌ Audio generation failed: ${record.mp3path}`);
            this.audioSection.classList.add('hidden');
            this.resetAudio();
        } else {
            console.log(`🔇 No audio available yet`);
            this.audioSection.classList.add('hidden');
            this.resetAudio();
        }
        
        console.log(`✅ Record display complete`);
    }

    setupAudio(mp3Path) {
        // Reset audio state
        this.resetAudio();
        
        // Check if file exists before setting source
        this.checkAudioFile(mp3Path).then(exists => {
            if (exists) {
                // Restore audio player if it was replaced with "generating" message
                this.restoreAudioPlayer();
                this.audioSection.classList.remove('hidden');
                
                // Set audio source
                this.audioElement.src = mp3Path;
                this.audioElement.load();
                
                // Reset controls
                this.currentSpeed = 1.0;
                this.speedText.textContent = '1x';
                this.audioElement.playbackRate = 1.0;
            } else {
                console.warn(`⚠️ Audio file not found: ${mp3Path}`);
                this.showAudioNotReady();
            }
        }).catch(error => {
            console.warn(`⚠️ Could not verify audio file: ${mp3Path}`, error);
            // Still try to load the file, but don't show errors immediately
            this.restoreAudioPlayer();
            this.audioSection.classList.remove('hidden');
            this.audioElement.src = mp3Path;
            this.audioElement.load();
            this.currentSpeed = 1.0;
            this.speedText.textContent = '1x';
            this.audioElement.playbackRate = 1.0;
        });
    }

    resetAudio() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement.src = '';
        }
        
        this.isPlaying = false;
        this.playIcon.textContent = '▶️';
        this.playPauseBtn.classList.remove('playing');
        this.progressFill.style.width = '0%';
        this.progressHandle.style.left = '0%';
        this.currentTime.textContent = '0:00';
        this.totalTime.textContent = '0:00';
    }

    togglePlayPause() {
        if (!this.audioElement.src) return;
        
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
            this.playIcon.textContent = '▶️';
            this.playPauseBtn.classList.remove('playing');
        } else {
            this.audioElement.play().then(() => {
                this.isPlaying = true;
                this.playIcon.textContent = '⏸️';
                this.playPauseBtn.classList.add('playing');
            }).catch(error => {
                console.error('❌ Audio play error:', error);
                this.showError('Failed to play audio');
            });
        }
    }

    restartAudio() {
        if (!this.audioElement.src) return;
        
        this.audioElement.currentTime = 0;
        this.updateProgress();
    }

    cycleSpeed() {
        const currentIndex = this.availableSpeeds.indexOf(this.currentSpeed);
        const nextIndex = (currentIndex + 1) % this.availableSpeeds.length;
        this.currentSpeed = this.availableSpeeds[nextIndex];
        
        this.audioElement.playbackRate = this.currentSpeed;
        this.speedText.textContent = `${this.currentSpeed}x`;
    }

    seekAudio(event) {
        if (!this.audioElement.src || !this.audioElement.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percentage = (event.clientX - rect.left) / rect.width;
        const newTime = percentage * this.audioElement.duration;
        
        this.audioElement.currentTime = newTime;
        this.updateProgress();
    }

    setVolume(value) {
        this.audioElement.volume = value / 100;
        this.updateVolumeIcon(value);
    }

    toggleMute() {
        if (this.audioElement.volume > 0) {
            this.audioElement.volume = 0;
            this.volumeSlider.value = 0;
            this.updateVolumeIcon(0);
        } else {
            this.audioElement.volume = 1;
            this.volumeSlider.value = 100;
            this.updateVolumeIcon(100);
        }
    }

    updateVolumeIcon(value) {
        if (value == 0) {
            this.volumeIcon.textContent = '🔇';
        } else if (value < 50) {
            this.volumeIcon.textContent = '🔉';
        } else {
            this.volumeIcon.textContent = '🔊';
        }
    }

    updateTotalTime() {
        if (this.audioElement.duration) {
            this.totalTime.textContent = this.formatTime(this.audioElement.duration);
        }
    }

    updateProgress() {
        if (!this.audioElement.duration) return;
        
        const percentage = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressHandle.style.left = `${percentage}%`;
        this.currentTime.textContent = this.formatTime(this.audioElement.currentTime);
    }

    onAudioEnded() {
        this.isPlaying = false;
        this.playIcon.textContent = '▶️';
        this.playPauseBtn.classList.remove('playing');
        this.audioElement.currentTime = 0;
        this.updateProgress();
    }

    async checkAudioFile(mp3Path) {
        try {
            const response = await fetch(mp3Path, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    showAudioNotReady() {
        // Show a message that audio is being generated
        this.audioSection.classList.remove('hidden');
        const audioPlayer = this.audioSection.querySelector('.audio-player');
        
        // Store original audio player HTML if not already stored
        if (!this.originalAudioPlayerHTML) {
            this.originalAudioPlayerHTML = audioPlayer.innerHTML;
        }
        
        audioPlayer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f7fafc; border-radius: 0.5rem; color: #4a5568;">
                <div class="spinner"></div>
                <span>🎵 Audio is being generated... Please wait.</span>
            </div>
        `;
    }

    restoreAudioPlayer() {
        if (this.originalAudioPlayerHTML) {
            const audioPlayer = this.audioSection.querySelector('.audio-player');
            audioPlayer.innerHTML = this.originalAudioPlayerHTML;
            
            // Re-initialize audio elements after restoring HTML
            this.audioElement = document.getElementById('audio-element');
            this.playPauseBtn = document.getElementById('play-pause-btn');
            this.playIcon = this.playPauseBtn.querySelector('.play-icon');
            this.restartBtn = document.getElementById('restart-btn');
            this.speedBtn = document.getElementById('speed-btn');
            this.speedText = this.speedBtn.querySelector('.speed-text');
            this.progressBar = document.getElementById('progress-bar');
            this.progressFill = document.getElementById('progress-fill');
            this.progressHandle = document.getElementById('progress-handle');
            this.currentTime = document.getElementById('current-time');
            this.totalTime = document.getElementById('total-time');
            this.volumeBtn = document.getElementById('volume-btn');
            this.volumeIcon = this.volumeBtn.querySelector('.volume-icon');
            this.volumeSlider = document.getElementById('volume-slider');
            
            // Re-attach event listeners for audio controls
            this.setupAudioEventListeners();
        }
    }

    onAudioError(event) {
        // Be more specific about the error and less noisy
        const errorType = event.target?.error?.code || 'unknown';
        console.warn(`⚠️ Audio loading issue (${errorType}):`, event);
        
        // Only show error to user if this isn't a "file not found" during processing
        if (this.audioElement.src && !this.audioElement.src.includes('blob:')) {
            // Try to reload the audio once after a short delay
            setTimeout(() => {
                if (this.audioElement.src) {
                    console.log('🔄 Retrying audio load...');
                    this.audioElement.load();
                }
            }, 2000);
        }
    }

    showDeleteModal() {
        if (!this.currentRecord) return;
        this.deleteModal.classList.remove('hidden');
    }

    hideDeleteModal() {
        this.deleteModal.classList.add('hidden');
    }

    async confirmDelete() {
        if (!this.currentRecord) return;
        
        try {
            this.hideDeleteModal();
            this.showLoading('Deleting record...');
            
            const response = await fetch(`/api/records/${this.currentRecord.id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete record');
            }
            
            // Reset UI
            this.currentRecord = null;
            this.recordContent.classList.add('hidden');
            this.welcomeMessage.classList.remove('hidden');
            this.resetAudio();
            
            // Reload records
            await this.loadRecords();
            
        } catch (error) {
            console.error('❌ Failed to delete record:', error);
            this.showError(`Failed to delete record: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    handleKeyboard(event) {
        if (event.target.tagName === 'INPUT') return;
        
        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'r':
                this.restartAudio();
                break;
            case 's':
                this.cycleSpeed();
                break;
            case 'Delete':
                if (this.currentRecord) {
                    this.showDeleteModal();
                }
                break;
            case 'Escape':
                this.hideDeleteModal();
                this.hideError();
                break;
        }
    }

    handleResize() {
        // Handle any responsive adjustments if needed
    }

    formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    showLoading(text = 'Loading...') {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    // Auto-refresh functionality
    startAutoRefresh() {
        setInterval(async () => {
            if (document.hidden) return; // Don't refresh when tab is not visible
            
            try {
                await this.checkHealth();
                
                // If we have a current record that's still processing, refresh it
                if (this.currentRecord && (!this.currentRecord.answer || !this.currentRecord.mp3path)) {
                    await this.selectRecord(this.currentRecord.id);
                }
            } catch (error) {
                console.warn('⚠️ Auto-refresh error:', error);
            }
        }, 10000); // Refresh every 10 seconds
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ClipboardTTSApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app) {
        // Page became visible, check health and refresh if needed
        setTimeout(() => {
            window.app.checkHealth();
        }, 1000);
    }
}); 