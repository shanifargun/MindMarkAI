// MindMark AI - Content Script
// Floating button and side panel for smart bookmarks

// Analytics helper - sends events to background script
function trackEvent(eventName, eventParams = {}) {
  chrome.runtime.sendMessage({
    type: 'TRACK_ANALYTICS',
    eventName: eventName,
    eventParams: eventParams
  }).catch(err => console.error('[Analytics] Failed to send event:', err));
}

// Wrapper functions for easy tracking
function trackBookmarkSaved(type) {
  trackEvent('bookmark_saved', { bookmark_type: type });
}
function trackCollectionOpened() {
  trackEvent('collection_opened');
}
function trackScreenshotCaptured() {
  trackEvent('screenshot_captured');
}
function trackLinkedInPostSaved() {
  trackEvent('linkedin_post_saved');
}
function trackFloatingButtonClicked() {
  trackEvent('floating_button_clicked');
}

(function init() {
  let floatingButton = null;
  let menuPanel = null;
  let sidePanel = null;
  let detailPanel = null;
  let bookmarks = [];

  // CSS Styles
  function createCss() {
    return `
      :host { all: initial; }
      .mm-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
      .mm-hidden { display: none !important; }

      /* Floating Button */
      .mm-float {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483646;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
        font-size: 24px;
        transition: transform 0.2s;
      }
      .mm-float:hover {
        transform: scale(1.1);
      }
      .mm-float:active {
        transform: scale(0.95);
      }
      .mm-float.dragging {
        cursor: grabbing;
        transform: scale(1.05);
      }
      .mm-float.dragging:active {
        transform: scale(1.05);
      }

      /* Drag Grip */
      .mm-drag-grip {
        position: absolute;
        left: -18px;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 16px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: 2px;
        align-items: center;
        justify-items: center;
        opacity: 0;
        transition: opacity 0.2s;
        cursor: grab;
        z-index: 1;
        padding: 3px;
        background: rgba(102, 126, 234, 0.9);
        border-radius: 4px;
      }
      .mm-float:hover .mm-drag-grip {
        opacity: 1;
      }
      .mm-drag-grip span {
        width: 2px;
        height: 2px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        display: block;
      }

      /* Close Button */
      .mm-close-btn {
        position: absolute;
        right: -6px;
        top: -6px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ef4444;
        color: white;
        border: 2px solid white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        z-index: 2;
        line-height: 1;
      }
      .mm-float:hover .mm-close-btn {
        opacity: 1;
      }
      .mm-close-btn:hover {
        transform: scale(1.1);
        background: #dc2626;
      }
      .mm-close-btn:active {
        transform: scale(0.95);
      }

      /* Main Icon */
      .mm-float-icon {
        position: relative;
        z-index: 0;
      }

      /* Menu Panel */
      .mm-menu {
        position: fixed;
        right: 20px;
        bottom: 90px;
        z-index: 2147483646;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(74, 144, 226, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 6px;
        min-width: 170px;
        border: 1px solid #e9ecef;
      }
      .mm-menu-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: transparent;
        color: #333;
        text-align: left;
        cursor: pointer;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      }
      .mm-menu-btn:hover {
        background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
        color: #4a90e2;
        transform: translateX(-2px);
      }
      .mm-menu-btn:active {
        transform: translateX(0);
      }

      /* Side Panel */
      .mm-panel {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: 50%;
        background: white;
        z-index: 2147483647;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      .mm-panel.open {
        transform: translateX(0);
      }

      /* Panel Header */
      .mm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .mm-title {
        font-size: 20px;
        font-weight: 700;
      }
      .mm-close {
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-size: 24px;
        cursor: pointer;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .mm-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Panel Content */
      .mm-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      /* Bookmark Cards */
      .mm-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .mm-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: #667eea;
      }
      .mm-card-img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 12px;
        background: #f3f4f6;
      }
      .mm-card-title {
        font-size: 16px;
        font-weight: 600;
        color: #111;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .mm-card-summary {
        font-size: 14px;
        color: #666;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .mm-card-date {
        font-size: 12px;
        color: #999;
        margin-top: 8px;
      }

      /* Detail View */
      .mm-detail-img {
        width: 100%;
        max-height: 300px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 20px;
        background: #f3f4f6;
      }
      .mm-detail-title {
        font-size: 24px;
        font-weight: 700;
        color: #111;
        margin-bottom: 16px;
      }
      .mm-detail-summary {
        font-size: 16px;
        color: #333;
        line-height: 1.8;
        margin-bottom: 20px;
        white-space: pre-wrap;
      }
      .mm-btn {
        display: inline-block;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: transform 0.2s;
      }
      .mm-btn:hover {
        transform: translateY(-2px);
      }
      .mm-back-btn {
        background: #e5e7eb;
        color: #333;
        margin-right: 12px;
      }

      /* Loading State */
      .mm-loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }

      /* Empty State */
      .mm-empty {
        text-align: center;
        padding: 60px 20px;
        color: #999;
      }
      .mm-empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }

      /* LinkedIn Save Button */
      .mm-linkedin-save-btn {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        border-radius: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        z-index: 100;
        transition: all 0.2s ease;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Fira Sans', Ubuntu, Oxygen, 'Oxygen Sans', Cantarell, 'Droid Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Lucida Grande', Helvetica, Arial, sans-serif;
        white-space: nowrap;
        min-width: 160px;
      }
      .mm-linkedin-save-btn:hover {
        transform: translateX(-50%) translateY(-2px);
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
        background: linear-gradient(135deg, #7b8ffb 0%, #8a5cb8 100%);
      }
      .mm-linkedin-save-btn:active {
        transform: translateX(-50%) translateY(0);
      }
      .mm-linkedin-icon {
        font-size: 16px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .mm-linkedin-text {
        line-height: 1;
        display: inline-flex;
        align-items: center;
      }
      .mm-linkedin-save-btn.loading {
        background: #f59e0b;
        pointer-events: none;
      }
      .mm-linkedin-save-btn.loading .mm-linkedin-icon {
        animation: spin 1s linear infinite;
      }
      .mm-linkedin-save-btn.success {
        background: #10b981;
      }
      .mm-linkedin-save-btn.error {
        background: #ef4444;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
  }

  // Storage helpers using chrome.storage.local
  async function getBookmarks() {
    const result = await chrome.storage.local.get(['bookmarks']);
    return result.bookmarks || [];
  }

  async function saveBookmark(bookmark) {
    const bookmarks = await getBookmarks();

    // Generate ID
    const maxId = bookmarks.length > 0 ? Math.max(...bookmarks.map(b => b.id)) : 0;
    bookmark.id = maxId + 1;

    bookmarks.push(bookmark);
    await chrome.storage.local.set({ bookmarks });

    return bookmark.id;
  }

  async function updateBookmark(id, updates) {
    const bookmarks = await getBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);

    if (index !== -1) {
      Object.assign(bookmarks[index], updates);
      await chrome.storage.local.set({ bookmarks });
      return bookmarks[index];
    }
    throw new Error('Bookmark not found');
  }

  async function getAllBookmarks() {
    return await getBookmarks();
  }

  // Extract page content - aggressive extraction
  function extractPageContent(silent = false) {
    let text = '';

    // Strategy 1: Get ALL visible text from body, remove only scripts/styles
    try {
      const body = document.body.cloneNode(true);
      // Only remove truly useless elements
      body.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
      text = body.innerText || body.textContent || '';
    } catch (e) {
      if (!silent) console.error('[MindMark] Body clone failed:', e);
    }

    // Strategy 2: If still too short, just grab everything
    if (text.length < 500) {
      text = document.body.innerText || document.body.textContent || '';
    }

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double newline
      .trim();

    if (!silent) {
      if (text.length < 500) {
      }
    }

    return text;
  }

  // Extract first large image
  function extractPageImage() {
    // Try Open Graph image first
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) return ogImage.getAttribute('content');

    // Try to find large images
    const images = Array.from(document.querySelectorAll('img'));
    for (const img of images) {
      if (img.naturalWidth >= 400 && img.naturalHeight >= 200) {
        return img.src;
      }
    }

    // Fallback to first image
    if (images.length > 0) return images[0].src;

    return '';
  }

  // Type detection is done by AI in background.js during summarization
  // We just set a placeholder here that will be updated by the AI

  // Update status message
  function updateStatus(message) {
    menuPanel.innerHTML = `<div class="mm-loading">${message}</div>`;
  }

  // Wait for content to be available (for dynamic sites)
  async function waitForContent(maxWait = 2000) {
    const startTime = Date.now();
    let attempts = 0;
    while (Date.now() - startTime < maxWait) {
      attempts++;
      const content = extractPageContent(true); // Silent mode during wait
      if (content.length > 100) {
        return content;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return extractPageContent(false); // Final attempt with logging
  }

  // Save current page (Instant save + queue for background processing)
  async function savePage() {
    const startTime = Date.now();

    try {
      // Show loading in menu
      showMenu();
      updateStatus('📄 Extracting page data...');

      // Extract everything (with wait for dynamic content)
      const pageTitle = document.title;
      const pageUrl = window.location.href;
      const pageContent = await waitForContent(2000); // Wait up to 2 seconds for content
      const pageImage = extractPageImage();

      // Type will be detected by AI during summarization (default to "Pending")
      const type = 'Pending';

      // Save immediately to DB with pending status
      updateStatus('💾 Saving bookmark...');
      const bookmark = {
        title: pageTitle,
        url: pageUrl,
        summary: null, // Will be filled by queue processor
        image: pageImage,
        rawContent: pageContent, // Temporary - will be deleted after summarization
        status: 'pending',
        type: type,
        tags: [], // Will be filled by AI during summarization (2-3 tags max)
        timestamp: Date.now(),
        isRead: false, // Track read/unread status
        readAt: null,   // Timestamp when marked as read
        isStarred: false // Track starred/favorite status
      };

      const bookmarkId = await saveBookmark(bookmark);

      // Track bookmark saved
      trackBookmarkSaved('page');

      // Show instant success and update menu
      menuPanel.innerHTML = `<div class="mm-loading" style="color: #10b981;">✓ Saved! (Queued for summarization)</div>`;

      // After 1 second, show the menu with Unsave option
      setTimeout(async () => {
        await renderMenu();
      }, 1000);

      // Add to processing queue with full data (non-blocking)
      const bookmarkData = {
        id: bookmarkId,
        title: pageTitle,
        url: pageUrl,
        rawContent: pageContent,
        image: pageImage
      };

      chrome.runtime.sendMessage({
        type: "MINDMARK_ADD_TO_QUEUE",
        bookmarkId: bookmarkId,
        bookmarkData: bookmarkData
      }).then(response => {
        if (response && response.success) {
        } else {
          console.error(`[MindMark] Failed to add bookmark ${bookmarkId} to queue. Response:`, response);
        }
      }).catch(err => {
        console.error('[MindMark] Failed to add to queue (exception):', err);
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('[MindMark] Save failed:', error);
      menuPanel.innerHTML = `<div class="mm-loading" style="color: #ef4444;">Error: ${error.message}</div>`;
      setTimeout(() => hideMenu(), 3000);
    }
  }

  // Show bookmark list - open full page
  async function showList() {
    hideMenu();

    // Track collection opened
    trackCollectionOpened();

    // Open bookmarks page in new tab
    chrome.runtime.sendMessage({ type: 'MINDMARK_OPEN_BOOKMARKS' });
  }

  // Render bookmark list
  function renderList() {
    const shadowRoot = sidePanel.getRootNode();
    const listPanel = shadowRoot.getElementById('list-panel');
    const detailPanel = shadowRoot.getElementById('detail-panel');

    listPanel.classList.remove('mm-hidden');
    detailPanel.classList.add('mm-hidden');

    const content = shadowRoot.getElementById('list-content');

    if (bookmarks.length === 0) {
      content.innerHTML = `
        <div class="mm-empty">
          <div class="mm-empty-icon">📚</div>
          <div>No bookmarks saved yet</div>
          <div style="margin-top: 8px; font-size: 14px;">Click the floating button and choose "Save" to bookmark a page</div>
        </div>
      `;
      return;
    }

    let html = '';
    bookmarks.forEach((bookmark) => {
      const date = new Date(bookmark.timestamp).toLocaleDateString();
      const isPending = bookmark.status === 'pending';
      const summaryText = isPending
        ? '🤖 Summarizing... (Refresh to see summary)'
        : (bookmark.summary || 'No summary available');

      html += `
        <div class="mm-card" data-id="${bookmark.id}" ${isPending ? 'style="border-color: #667eea; background: #f8f9ff;"' : ''}>
          ${bookmark.image ? `<img src="${bookmark.image}" class="mm-card-img" alt="">` : ''}
          <div class="mm-card-title">${bookmark.title}</div>
          <div class="mm-card-summary" ${isPending ? 'style="color: #667eea; font-style: italic;"' : ''}>${summaryText}</div>
          <div class="mm-card-date">${date}</div>
        </div>
      `;
    });

    content.innerHTML = html;

    // Add click listeners
    content.querySelectorAll('.mm-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'));
        showDetail(id);
      });
    });
  }

  // Show bookmark detail
  async function showDetail(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    const shadowRoot = sidePanel.getRootNode();
    const listPanel = shadowRoot.getElementById('list-panel');
    const detailPanel = shadowRoot.getElementById('detail-panel');

    listPanel.classList.add('mm-hidden');
    detailPanel.classList.remove('mm-hidden');

    const content = shadowRoot.getElementById('detail-content');
    const date = new Date(bookmark.timestamp).toLocaleDateString();

    const isPending = bookmark.status === 'pending';

    let summaryText = bookmark.summary || 'No summary available';
    let statusInfo = '';

    // If pending, get queue status
    if (isPending) {
      try {
        const queueData = await chrome.storage.local.get(['processingQueue']);
        const queue = queueData.processingQueue || [];

        // Ensure bookmark.id is compared as same type (convert both to numbers)
        const bookmarkId = Number(bookmark.id);
        const position = queue.findIndex(id => Number(id) === bookmarkId);

        if (position === -1) {
          statusInfo = '🤖 Summary generation starting soon... (Not in queue yet)';
        } else if (position === 0) {
          statusInfo = '🤖 Generating summary right now... (~30 seconds)';
        } else {
          statusInfo = `🤖 In queue (position ${position + 1} of ${queue.length}). ${position} article${position > 1 ? 's' : ''} ahead.`;
        }
      } catch (err) {
        console.error('[MindMark] Queue status check failed:', err);
        statusInfo = '🤖 Summary is being generated in the background...';
      }

      summaryText = `${statusInfo}\n\nClose this panel and reopen it in a moment to see the summary.`;
    }

    content.innerHTML = `
      ${bookmark.image ? `<img src="${bookmark.image}" class="mm-detail-img" alt="">` : ''}
      <div class="mm-detail-title">${bookmark.title}</div>
      <div class="mm-detail-summary" ${isPending ? 'style="color: #667eea; font-style: italic;"' : ''}>${summaryText}</div>
      <div style="margin-top: 20px;">
        <button class="mm-btn mm-back-btn" id="back-btn">← Back</button>
        <a href="${bookmark.url}" target="_blank" class="mm-btn">Open Link →</a>
      </div>
      <div class="mm-card-date" style="margin-top: 16px;">Saved on ${date}</div>
    `;

    shadowRoot.getElementById('back-btn').addEventListener('click', renderList);
  }

  // Panel controls
  function openPanel() {
    sidePanel.classList.add('open');
  }

  function closePanel() {
    sidePanel.classList.remove('open');
  }

  // Render menu with Save/Unsave option
  async function renderMenu() {
    const currentUrl = window.location.href;
    const bookmarks = await getBookmarks();
    const existingBookmark = bookmarks.find(b => b.url === currentUrl);

    if (existingBookmark) {
      // Page is already saved - show Unsave option
      menuPanel.innerHTML = `
        <button class="mm-menu-btn" id="unsave-btn">🗑️ Unsave</button>
        <button class="mm-menu-btn" id="screenshot-btn">📸 Screenshot</button>
        <button class="mm-menu-btn" id="list-btn">📚 Collection</button>
      `;

      const unsaveBtn = menuPanel.querySelector('#unsave-btn');
      const screenshotBtn = menuPanel.querySelector('#screenshot-btn');
      const listBtn = menuPanel.querySelector('#list-btn');

      unsaveBtn.addEventListener('click', async () => {
        await unsavePage(existingBookmark.id);
      });
      screenshotBtn.addEventListener('click', startScreenshotCapture);
      listBtn.addEventListener('click', showList);
    } else {
      // Page is not saved - show Save option
      menuPanel.innerHTML = `
        <button class="mm-menu-btn" id="save-btn">💾 Save</button>
        <button class="mm-menu-btn" id="screenshot-btn">📸 Screenshot</button>
        <button class="mm-menu-btn" id="list-btn">📚 Collection</button>
      `;

      const saveBtn = menuPanel.querySelector('#save-btn');
      const screenshotBtn = menuPanel.querySelector('#screenshot-btn');
      const listBtn = menuPanel.querySelector('#list-btn');

      saveBtn.addEventListener('click', savePage);
      screenshotBtn.addEventListener('click', startScreenshotCapture);
      listBtn.addEventListener('click', showList);
    }

    showMenu();
  }

  // Unsave current page
  async function unsavePage(bookmarkId) {
    try {
      updateStatus('🗑️ Removing bookmark...');

      const bookmarks = await getBookmarks();
      const newBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      await chrome.storage.local.set({ bookmarks: newBookmarks });

      menuPanel.innerHTML = `<div class="mm-loading" style="color: #10b981;">✓ Removed!</div>`;

      // After 1 second, show the menu with Save option
      setTimeout(async () => {
        await renderMenu();
      }, 1000);
    } catch (error) {
      console.error('[MindMark] Unsave failed:', error);
      menuPanel.innerHTML = `<div class="mm-loading" style="color: #ef4444;">Error: ${error.message}</div>`;
      setTimeout(() => hideMenu(), 3000);
    }
  }

  // Menu controls
  function showMenu() {
    // Update menu position based on floating button's current position
    const buttonRect = floatingButton.getBoundingClientRect();

    // Position menu above the button, centered horizontally with it
    const menuLeft = buttonRect.left + (buttonRect.width / 2) - 85; // 85 is half of min-width (170px)
    const menuBottom = window.innerHeight - buttonRect.top + 10; // 10px gap above button

    // Ensure menu stays within viewport bounds
    const constrainedLeft = Math.max(10, Math.min(menuLeft, window.innerWidth - 180));

    menuPanel.style.left = `${constrainedLeft}px`;
    menuPanel.style.bottom = `${menuBottom}px`;
    menuPanel.style.right = 'auto'; // Override CSS default

    menuPanel.classList.remove('mm-hidden');
  }

  function hideMenu() {
    menuPanel.classList.add('mm-hidden');
  }

  async function toggleMenu() {
    if (menuPanel.classList.contains('mm-hidden')) {
      // Track floating button clicked
      trackFloatingButtonClicked();

      await renderMenu();
    } else {
      hideMenu();
    }
  }

  // ============== SCREENSHOT FEATURE ==============

  let screenshotOverlay = null;
  let selectionBox = null;
  let startX = 0, startY = 0;
  let isSelecting = false;

  // Start screenshot capture mode
  function startScreenshotCapture() {
    hideMenu();

    // Create overlay
    screenshotOverlay = document.createElement('div');
    screenshotOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      cursor: crosshair;
    `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #667eea;
      background: rgba(102, 126, 234, 0.1);
      display: none;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Create instruction text
    const instructionText = document.createElement('div');
    instructionText.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      z-index: 2147483647;
    `;
    instructionText.textContent = '📸 Click and drag to select area • Press ESC to cancel';

    document.body.appendChild(screenshotOverlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructionText);

    // Mouse events for selection
    screenshotOverlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleEscapeKey);

    function handleMouseDown(e) {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
    }

    function handleMouseMove(e) {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    }

    async function handleMouseUp(e) {
      if (!isSelecting) return;
      isSelecting = false;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      // Minimum size check
      if (width < 50 || height < 50) {
        alert('Selection too small. Please select a larger area.');
        cleanup();
        return;
      }

      // Hide overlay and selection box before capturing to avoid darkened screenshot
      screenshotOverlay.style.display = 'none';
      selectionBox.style.display = 'none';
      instructionText.style.display = 'none';

      // Wait a brief moment for the DOM to update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Capture the screenshot
      await captureScreenshot(left, top, width, height);
      cleanup();
    }

    function handleEscapeKey(e) {
      if (e.key === 'Escape') {
        cleanup();
      }
    }

    function cleanup() {
      if (screenshotOverlay) screenshotOverlay.remove();
      if (selectionBox) selectionBox.remove();
      if (instructionText) instructionText.remove();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleEscapeKey);
      screenshotOverlay = null;
      selectionBox = null;
      isSelecting = false;
    }
  }

  // Capture screenshot using Chrome API
  async function captureScreenshot(left, top, width, height) {
    try {
      // Capture visible tab FIRST (before showing any loading indicators)
      const dataUrl = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
          resolve(response.dataUrl);
        });
      });

      if (!dataUrl) {
        throw new Error('Failed to capture screenshot');
      }

      // Crop the image to selected area
      const croppedDataUrl = await cropImage(dataUrl, left, top, width, height);

      // NOW show loading indicator (after screenshot is captured)
      const loadingDiv = document.createElement('div');
      loadingDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px 32px;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #333;
      `;
      loadingDiv.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">📸</div>
          <div style="font-weight: 600; margin-bottom: 8px;">AI is processing your screenshot</div>
          <div style="font-size: 12px; color: #666;">Just a moment...</div>
        </div>
      `;
      document.body.appendChild(loadingDiv);

      // OCR: Extract text from screenshot
      const extractedText = await performOCR(croppedDataUrl);

      // Save screenshot with AI processing
      await saveScreenshotBookmark(croppedDataUrl, extractedText);

      loadingDiv.remove();

      // Show success message
      const successDiv = document.createElement('div');
      successDiv.style.cssText = loadingDiv.style.cssText;
      successDiv.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">✓</div>
          <div style="font-weight: 600; color: #10b981;">Screenshot saved!</div>
        </div>
      `;
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 2000);

    } catch (error) {
      console.error('[MindMark Screenshot] Error:', error);
      alert(`Failed to capture screenshot: ${error.message}`);
    }
  }

  // Crop image to selected area
  function cropImage(dataUrl, left, top, width, height) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate device pixel ratio for high DPI screens
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        ctx.drawImage(
          img,
          left * dpr, top * dpr, width * dpr, height * dpr,
          0, 0, width * dpr, height * dpr
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  // Perform OCR on screenshot using Tesseract.js
  async function performOCR(imageDataUrl) {
    try {
      const { data: { text } } = await Tesseract.recognize(
        imageDataUrl,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
            }
          }
        }
      );

      return text.trim();
    } catch (error) {
      console.error('[MindMark OCR] Error:', error);
      return ''; // Return empty string if OCR fails
    }
  }

  // Save screenshot as bookmark with AI processing
  async function saveScreenshotBookmark(imageDataUrl, extractedText) {
    try {
      const pageTitle = `Screenshot - ${document.title || window.location.hostname}`;
      const pageUrl = window.location.href;

      // Create bookmark with screenshot data
      const bookmark = {
        title: pageTitle,
        url: pageUrl,
        summary: null,
        image: imageDataUrl, // Store the screenshot as the image
        rawContent: `[Screenshot]\n\n${extractedText}`, // OCR text as raw content
        status: 'pending',
        type: 'Screenshot',
        tags: [],
        timestamp: Date.now(),
        isRead: false,
        readAt: null,
        isStarred: false,
        isScreenshot: true // Flag to identify screenshots
      };

      const bookmarkId = await saveBookmark(bookmark);

      // Track screenshot captured
      trackScreenshotCaptured();
      trackBookmarkSaved('screenshot');

      // Add to processing queue for AI summarization
      chrome.runtime.sendMessage({
        type: "MINDMARK_ADD_TO_QUEUE",
        bookmarkId: bookmarkId
      });

    } catch (error) {
      console.error('[MindMark Screenshot] Save failed:', error);
      throw error;
    }
  }

  // ============== LINKEDIN INTEGRATION ==============

  // Check if current page is LinkedIn
  function isLinkedIn() {
    return window.location.hostname.includes('linkedin.com');
  }

  // Generate simple title from LinkedIn post content
  function generatePostTitle(content) {
    if (!content || content.trim().length === 0) {
      return 'LinkedIn Post';
    }

    // Clean up the content
    let cleaned = content
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/…more$/, '') // Remove "...more" text
      .trim();

    // Take first 150 characters or until first newline/period
    let title = cleaned.substring(0, 150);

    // Try to break at sentence end
    const sentenceEnd = title.search(/[.!?]/);
    if (sentenceEnd > 40) {
      title = title.substring(0, sentenceEnd);
    } else if (title.length === 150 && cleaned.length > 150) {
      // Break at last word boundary if we hit the limit
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 60) {
        title = title.substring(0, lastSpace) + '...';
      }
    }

    return title;
  }

  // Extract data from LinkedIn post
  function extractLinkedInPostData(postElement) {
    try {
      // Find author name - use more flexible approach
      let author = 'Unknown Author';

      // Strategy 1: Look for <strong> tags within profile links (most reliable)
      const profileLinks = postElement.querySelectorAll('a[href*="/in/"]');
      for (const link of profileLinks) {
        const strongTag = link.querySelector('strong');
        if (strongTag) {
          const text = strongTag.textContent.trim();
          if (text.length > 2 && text.length < 100) {
            author = text;
            break;
          }
        }
      }

      // Strategy 2: Look for any profile link with text (fallback)
      if (author === 'Unknown Author') {
        for (const link of profileLinks) {
          const text = link.textContent.trim();
          // Skip if text is too long (likely not a name) or empty or contains extra info
          if (text.length > 2 && text.length < 100 && !text.includes('http') && !text.includes('•') && !text.includes('followers')) {
            author = text;
            break;
          }
        }
      }

      // Find post content - look for spans with substantial text
      let content = '';

      // Strategy: Find spans/divs that have their own text (not just children's text)
      const allElements = postElement.querySelectorAll('span, div');
      let longestText = '';

      for (const el of allElements) {
        // Get element's own text (excluding children)
        const text = el.textContent.trim();
        const childText = Array.from(el.children).reduce((sum, child) => sum + child.textContent.length, 0);
        const ownTextLength = text.length - childText;

        // If this element has substantial own text (>100 chars), it's likely the post content
        if (ownTextLength > 100 && text.length > longestText.length) {
          longestText = text;
        }
      }

      content = longestText;

      // Find post URL - extract from componentkey attribute
      let postUrl = window.location.href;
      let activityId = null;

      // Strategy 1: Check componentkey attribute on the post container
      if (postElement.hasAttribute('componentkey')) {
        const componentkey = postElement.getAttribute('componentkey');
        // Handle both formats: "urn:li:activity:123" and "_expandedurn:li:activity:123FeedType_MAIN_FEED"
        const match = componentkey.match(/activity:(\d+)/);
        if (match) {
          activityId = match[1];
        }
      }

      // Strategy 2: Look for any child element with data-urn containing activity
      if (!activityId) {
        const urnElement = postElement.querySelector('[data-urn*="activity:"]');
        if (urnElement) {
          const urn = urnElement.getAttribute('data-urn');
          const match = urn?.match(/activity:(\d+)/);
          if (match) {
            activityId = match[1];
          }
        }
      }

      // Strategy 3: Look in any link href that contains activity ID
      if (!activityId) {
        const allLinks = postElement.querySelectorAll('a[href*="activity"]');
        for (const link of allLinks) {
          const match = link.href.match(/activity[:\-](\d+)/);
          if (match) {
            activityId = match[1];
            break;
          }
        }
      }

      // Construct the final URL
      if (activityId) {
        postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
      } else {
      }

      // Find post image - look for any img tag with a reasonable size
      let image = '';
      const images = postElement.querySelectorAll('img');
      for (const img of images) {
        // Skip small images (likely avatars/icons)
        if (img.naturalWidth > 100 && img.naturalHeight > 100) {
          image = img.src;
          break;
        }
      }

      // Validate that we have enough data
      if (!content || content.length < 10) {
        console.error('[MindMark LinkedIn] Content too short or missing');
        return null;
      }

      return { author, content, postUrl, image };
    } catch (error) {
      console.error('[MindMark LinkedIn] Data extraction failed:', error);
      return null;
    }
  }

  // Save LinkedIn post
  async function saveLinkedInPost(postElement, buttonElement) {
    try {
      // Update button to loading state
      const textSpan = buttonElement.querySelector('.mm-linkedin-text');
      const iconSpan = buttonElement.querySelector('.mm-linkedin-icon');
      textSpan.textContent = 'Saving...';
      iconSpan.textContent = '⏳';
      buttonElement.classList.add('loading');
      buttonElement.disabled = true;

      // Extract post data
      const postData = extractLinkedInPostData(postElement);
      if (!postData || !postData.content) {
        throw new Error('Could not extract post data');
      }

      // Generate title from content
      const title = generatePostTitle(postData.content);

      // Create bookmark
      const bookmark = {
        title: title,
        url: postData.postUrl,
        summary: null, // Will be filled by queue processor
        image: postData.image,
        rawContent: `LinkedIn Post by ${postData.author}\n\n${postData.content}`,
        status: 'pending',
        type: 'LinkedIn',
        tags: [], // Will be filled by AI during summarization (2-3 tags max)
        timestamp: Date.now(),
        isRead: false,
        readAt: null,
        isStarred: false
      };

      // Save bookmark
      const bookmarkId = await saveBookmark(bookmark);

      // Track LinkedIn post saved
      trackLinkedInPostSaved();
      trackBookmarkSaved('linkedin');

      // Add to processing queue
      chrome.runtime.sendMessage({
        type: "MINDMARK_ADD_TO_QUEUE",
        bookmarkId: bookmarkId
      });

      // Update button to success state
      textSpan.textContent = 'Saved!';
      iconSpan.textContent = '✓';
      buttonElement.classList.remove('loading');
      buttonElement.classList.add('success');

      // Reset button after 2 seconds
      setTimeout(() => {
        textSpan.textContent = 'Save to MindMark';
        iconSpan.textContent = '📌';
        buttonElement.classList.remove('success');
        buttonElement.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('[MindMark LinkedIn] Save failed:', error);

      // Update button to error state
      const errorTextSpan = buttonElement.querySelector('.mm-linkedin-text');
      const errorIconSpan = buttonElement.querySelector('.mm-linkedin-icon');
      errorTextSpan.textContent = 'Failed';
      errorIconSpan.textContent = '❌';
      buttonElement.classList.remove('loading');
      buttonElement.classList.add('error');

      // Reset button after 2 seconds
      setTimeout(() => {
        errorTextSpan.textContent = 'Save to MindMark';
        errorIconSpan.textContent = '📌';
        buttonElement.classList.remove('error');
        buttonElement.disabled = false;
      }, 2000);
    }
  }

  // Inject CSS styles for LinkedIn buttons
  function injectLinkedInStyles() {
    if (document.getElementById('mm-linkedin-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'mm-linkedin-styles';
    styleEl.textContent = `
      .mm-linkedin-save-wrapper {
        display: flex !important;
        justify-content: center !important;
        padding: 12px 16px !important;
        border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
        background: transparent !important;
      }
      .mm-linkedin-save-btn {
        position: relative !important;
        padding: 8px 18px !important;
        border-radius: 20px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        border: none !important;
        box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Fira Sans', Ubuntu, Oxygen, 'Oxygen Sans', Cantarell, 'Droid Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Lucida Grande', Helvetica, Arial, sans-serif !important;
        white-space: nowrap !important;
        min-width: 150px !important;
      }
      .mm-linkedin-save-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4) !important;
        background: linear-gradient(135deg, #7b8ffb 0%, #8a5cb8 100%) !important;
      }
      .mm-linkedin-save-btn:active {
        transform: translateY(0) !important;
      }
      .mm-linkedin-icon {
        font-size: 16px !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .mm-linkedin-text {
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
      }
      .mm-linkedin-save-btn.loading {
        background: #f59e0b !important;
        pointer-events: none !important;
      }
      .mm-linkedin-save-btn.loading .mm-linkedin-icon {
        animation: mm-spin 1s linear infinite !important;
      }
      .mm-linkedin-save-btn.success {
        background: #10b981 !important;
      }
      .mm-linkedin-save-btn.error {
        background: #ef4444 !important;
      }
      @keyframes mm-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Inject save buttons into LinkedIn posts
  function injectSaveButtonsIntoLinkedInPosts() {
    if (!isLinkedIn()) return;

    // Use stable selectors that LinkedIn uses for semantic HTML
    // role="listitem" + componentkey containing "urn:li:activity" identifies feed posts
    const posts = document.querySelectorAll('div[role="listitem"][componentkey*="urn:li:activity"]');

    if (posts.length === 0) {
      return;
    }

    posts.forEach(post => {
      // Skip if button already exists
      if (post.querySelector('.mm-linkedin-save-btn')) return;

      // Skip if this is a nested post (to avoid duplicates)
      if (post.closest('.mm-linkedin-save-wrapper')) return;

      // Create wrapper for the button
      const wrapper = document.createElement('div');
      wrapper.className = 'mm-linkedin-save-wrapper';

      // Create save button with text and icon
      const saveBtn = document.createElement('button');
      saveBtn.className = 'mm-linkedin-save-btn';
      saveBtn.title = 'Save to MindMark';

      // Create text and icon spans
      const textSpan = document.createElement('span');
      textSpan.className = 'mm-linkedin-text';
      textSpan.textContent = 'Save to MindMark';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'mm-linkedin-icon';
      iconSpan.textContent = '📌';

      saveBtn.appendChild(textSpan);
      saveBtn.appendChild(iconSpan);

      // Add click handler
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveLinkedInPost(post, saveBtn);
      });

      // Add button to wrapper
      wrapper.appendChild(saveBtn);

      // Inject wrapper at the end of the post (after all content)
      post.appendChild(wrapper);
    });
  }

  // Initialize LinkedIn integration
  function initLinkedInIntegration() {
    if (!isLinkedIn()) return;

    // Inject styles first
    injectLinkedInStyles();

    // Initial injection
    injectSaveButtonsIntoLinkedInPosts();

    // Watch for new posts (infinite scroll)
    const observer = new MutationObserver((mutations) => {
      injectSaveButtonsIntoLinkedInPosts();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ============== END LINKEDIN INTEGRATION ==============

  // Mount UI
  function mountUI() {
    // Check if already mounted
    if (document.getElementById('__mindmark_host')) return;

    // If on LinkedIn, initialize LinkedIn integration (alongside regular UI)
    if (isLinkedIn()) {
      initLinkedInIntegration();
      // Continue to mount regular UI below
    }

    const host = document.createElement('div');
    host.id = '__mindmark_host';
    host.style.all = 'initial';
    document.documentElement.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = createCss();

    const root = document.createElement('div');
    root.className = 'mm-root';
    root.innerHTML = `
      <div class="mm-float" id="float-btn">
        <div class="mm-close-btn" id="close-float-btn">×</div>
        <div class="mm-drag-grip" id="drag-grip">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="mm-float-icon">📌</span>
      </div>

      <div class="mm-menu mm-hidden" id="menu">
        <button class="mm-menu-btn" id="save-btn">💾 Save</button>
        <button class="mm-menu-btn" id="list-btn">📚 Collection</button>
      </div>

      <div class="mm-panel" id="panel">
        <div class="mm-header">
          <div class="mm-title">MindMark AI</div>
          <button class="mm-close" id="close-btn">×</button>
        </div>

        <div id="list-panel" class="mm-content">
          <div id="list-content"></div>
        </div>

        <div id="detail-panel" class="mm-content mm-hidden">
          <div id="detail-content"></div>
        </div>
      </div>
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(root);

    // Store references
    floatingButton = shadowRoot.getElementById('float-btn');
    menuPanel = shadowRoot.getElementById('menu');
    sidePanel = shadowRoot.getElementById('panel');
    const dragGrip = shadowRoot.getElementById('drag-grip');

    // Drag functionality
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    dragGrip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      floatingButton.classList.add('dragging');

      const rect = floatingButton.getBoundingClientRect();
      dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      // Hide menu while dragging
      hideMenu();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;

      // Boundary constraints
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      const constrainedX = Math.max(0, Math.min(x, maxX));
      const constrainedY = Math.max(0, Math.min(y, maxY));

      // Update position using top/left instead of right/bottom
      floatingButton.style.right = 'auto';
      floatingButton.style.bottom = 'auto';
      floatingButton.style.left = `${constrainedX}px`;
      floatingButton.style.top = `${constrainedY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;

      isDragging = false;
      floatingButton.classList.remove('dragging');

      // Position is temporary and will reset on page reload
    });

    // Button always starts at default position (bottom-right)
    // Position can be temporarily adjusted by dragging, but resets on page reload

    // Event listeners
    floatingButton.addEventListener('click', (e) => {
      // Don't toggle menu if clicking on grip or close button
      if (e.target.closest('.mm-drag-grip')) return;
      if (e.target.closest('.mm-close-btn')) return;
      toggleMenu();
    });

    // Close button handler - temporarily hide floating button
    const closeFloatBtn = shadowRoot.getElementById('close-float-btn');
    closeFloatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      floatingButton.style.display = 'none';
    });

    shadowRoot.getElementById('close-btn').addEventListener('click', closePanel);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!host.contains(e.target)) {
        hideMenu();
      }
    });
  }

  // Message listener
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'MINDMARK_TOGGLE') {
      toggleMenu();
      sendResponse({ ok: true });
    }
  });

  // Initialize
  mountUI();
})();
