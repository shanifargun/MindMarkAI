// MindMarkAI - Onboarding Script
// Handles first-time setup and AI model download

// Analytics helper - sends events to background script
function trackEvent(eventName, eventParams = {}) {
  chrome.runtime.sendMessage({
    type: 'TRACK_ANALYTICS',
    eventName: eventName,
    eventParams: eventParams
  }).catch(err => console.error('[Analytics] Failed to send event:', err));
}

(async function init() {
  // Track onboarding viewed
  trackEvent('onboarding_viewed');

  // DOM Elements
  const statusChecking = document.getElementById('status-checking');
  const statusDownload = document.getElementById('status-download');
  const statusReady = document.getElementById('status-ready');
  const statusUnavailable = document.getElementById('status-unavailable');
  const downloadBtn = document.getElementById('download-btn');
  const startBtn = document.getElementById('start-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Show specific status section
  function showStatus(status) {
    statusChecking.classList.add('hidden');
    statusDownload.classList.add('hidden');
    statusReady.classList.add('hidden');
    statusUnavailable.classList.add('hidden');

    if (status === 'checking') statusChecking.classList.remove('hidden');
    if (status === 'download') statusDownload.classList.remove('hidden');
    if (status === 'ready') statusReady.classList.remove('hidden');
    if (status === 'unavailable') statusUnavailable.classList.remove('hidden');
  }

  // Check AI model status
  async function checkModelStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_MODEL_STATUS' });

      // Official Prompt API return values:
      // - 'available' = Model is ready to use immediately
      // - 'downloadable' = Model needs to be downloaded first
      // - 'downloading' = Download is currently in progress
      // - 'unavailable' = Not supported (device/options not compatible)

      if (response.status === 'unavailable') {
        showStatus('unavailable');
        trackEvent('model_unavailable');
      } else if (response.status === 'downloadable') {
        showStatus('download');
      } else if (response.status === 'downloading') {
        // Already downloading - show download screen
        showStatus('download');
      } else if (response.status === 'available') {
        showStatus('ready');
      } else {
        // Unknown status, show unavailable to be safe
        showStatus('unavailable');
      }
    } catch (error) {
      console.error('[MindMark Onboarding] Error checking status:', error);
      showStatus('unavailable');
    }
  }

  // Download AI model
  async function downloadModel() {
    const startTime = Date.now();
    try {
      // Track download started
      trackEvent('model_download_started');

      // Disable button and show progress
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Downloading...';
      progressContainer.classList.remove('hidden');

      // Listen for progress updates
      const progressListener = (msg) => {
        if (msg.type === 'DOWNLOAD_PROGRESS') {
          const progress = msg.progress;
          progressBar.value = progress;
          progressText.textContent = `Downloading... ${progress}%`;
        } else if (msg.type === 'DOWNLOAD_COMPLETE') {
          chrome.runtime.onMessage.removeListener(progressListener);

          // Track download completed with duration
          const duration = Date.now() - startTime;
          trackEvent('model_download_completed', { duration_ms: duration });

          showStatus('ready');
        }
      };

      chrome.runtime.onMessage.addListener(progressListener);

      // Trigger download
      const response = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_MODEL' });

      if (!response.success) {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      console.error('[MindMark Onboarding] Download error:', error);

      // Track download failed
      trackEvent('model_download_failed', { error_message: error.message });

      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Retry Download';
      progressText.textContent = `Error: ${error.message}. Please try again.`;
      progressText.style.color = '#ef4444';
    }
  }

  // Get started - close onboarding
  function getStarted() {
    window.close();
  }

  // Event listeners
  downloadBtn.addEventListener('click', downloadModel);
  startBtn.addEventListener('click', getStarted);

  // Start by checking status
  checkModelStatus();
})();
