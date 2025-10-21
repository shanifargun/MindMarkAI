// MindMark AI - Background Service Worker
// Handles AI summarization using Gemini Nano with Queue System

// Analytics functions (inline for service worker compatibility)
const GA4_MEASUREMENT_ID = 'G-3DZ1WKZKB8';
const GA4_API_SECRET = 'wOc-t8iTQue1kXgE4XF3LA';
const USE_DEBUG_MODE = false; // Set to true to see validation errors in console
const GA4_ENDPOINT = USE_DEBUG_MODE
  ? `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`
  : `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

async function getAnalyticsClientId() {
  const result = await chrome.storage.local.get(['analyticsClientId']);
  if (result.analyticsClientId) {
    return result.analyticsClientId;
  }
  // Use crypto.randomUUID() as per official Chrome extension docs
  const clientId = self.crypto.randomUUID();
  await chrome.storage.local.set({ analyticsClientId: clientId });
  return clientId;
}

// Get or create session ID with 30 minute expiration (per official Chrome docs)
async function getOrCreateSessionId() {
  // Try chrome.storage.session first (Manifest V3 feature)
  try {
    let { sessionData } = await chrome.storage.session.get('sessionData');
    const currentTimeInMs = Date.now();

    // Check if session exists and is still valid (30 minutes)
    if (sessionData && sessionData.timestamp) {
      const timeSinceSessionStart = currentTimeInMs - sessionData.timestamp;
      if (timeSinceSessionStart < 30 * 60 * 1000) { // 30 minutes
        // Update timestamp to extend session
        sessionData.timestamp = currentTimeInMs;
        await chrome.storage.session.set({ sessionData });
        return sessionData.sessionId;
      }
    }

    // Create new session
    sessionData = {
      sessionId: currentTimeInMs.toString(),
      timestamp: currentTimeInMs
    };
    await chrome.storage.session.set({ sessionData });
    return sessionData.sessionId;
  } catch (e) {
    // Fallback to local storage if session storage not available
    let { sessionData } = await chrome.storage.local.get('sessionData');
    const currentTimeInMs = Date.now();

    if (sessionData && sessionData.timestamp) {
      const timeSinceSessionStart = currentTimeInMs - sessionData.timestamp;
      if (timeSinceSessionStart < 30 * 60 * 1000) {
        sessionData.timestamp = currentTimeInMs;
        await chrome.storage.local.set({ sessionData });
        return sessionData.sessionId;
      }
    }

    sessionData = {
      sessionId: currentTimeInMs.toString(),
      timestamp: currentTimeInMs
    };
    await chrome.storage.local.set({ sessionData });
    return sessionData.sessionId;
  }
}

async function trackEvent(eventName, eventParams = {}) {
  try {
    const clientId = await getAnalyticsClientId();
    const sessionId = await getOrCreateSessionId();

    // Format exactly as per GA4 Measurement Protocol spec
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          session_id: sessionId,
          engagement_time_msec: 100,
          ...eventParams
        }
      }]
    };

    const response = await fetch(GA4_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Log response body even if not in debug mode
    if (!USE_DEBUG_MODE && !response.ok) {
      const errorText = await response.text();
      console.error(`[Analytics] Error response:`, errorText);
    }
  } catch (error) {
    console.error('[Analytics] Failed to send event:', error);
  }
}

let summarySession = null;
let isProcessing = false; // Flag to prevent concurrent processing

// Check model availability
async function checkModelAvailability() {
  try {
    // Check if LanguageModel API exists
    if (typeof LanguageModel === 'undefined' || !LanguageModel) {
      console.error('[MindMark AI] LanguageModel API is not available. Please enable Prompt API in chrome://flags');
      return 'unavailable';
    }

    const options = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    const availability = await LanguageModel.availability(options);

    // Official Prompt API return values:
    // - 'available' = Model is ready to use immediately
    // - 'downloadable' = Model needs to be downloaded first
    // - 'downloading' = Download is currently in progress
    // - 'unavailable' = Not supported (device/options not compatible)

    return availability;
  } catch (error) {
    console.error('[MindMark AI] Failed to check availability:', error);
    console.error('[MindMark AI] Error details:', error.message, error.name);
    return 'unavailable';
  }
}

// AI Helper Function for Page Summarization
async function getSummarySession(onDownloadProgress) {
  if (summarySession) return summarySession;

  try {
    const systemPrompt = `You are a content summarization expert. Create concise, informative summaries of web pages.

Your summaries should be exactly 6-7 lines long, capturing the most important information from the content.

Rules:
- Keep it to 6-7 lines maximum
- Focus on key points and main ideas
- Be clear and concise
- No fluff or filler content
- Make it readable and engaging`;

    const options = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [{ role: 'system', content: systemPrompt.trim() }]
    };

    const availability = await checkModelAvailability();

    // Official Prompt API values: 'available', 'downloadable', 'downloading', 'unavailable'
    if (availability === 'unavailable') {
      throw new Error('MODEL_UNAVAILABLE');
    }

    if (availability === 'downloadable' || availability === 'downloading') {
      // Create session with download monitoring
      summarySession = await LanguageModel.create({
        ...options,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const progress = Math.round(e.loaded * 100);
            if (onDownloadProgress) {
              onDownloadProgress(progress);
            }
          });
        }
      });
      return summarySession;
    }

    // Model is 'available' - ready to use immediately
    summarySession = await LanguageModel.create(options);
    return summarySession;
  } catch (error) {
    throw error;
  }
}

// AI Helper Function for Screenshot Summarization with Multimodal Support
async function summarizeScreenshot(bookmark) {
  // Try multimodal (image input) first
  try {
    const multimodalOptions = {
      expectedInputs: [
        { type: 'image', formats: ['image/png', 'image/jpeg'] },
        { type: 'text', languages: ['en'] }
      ],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    // Check availability first
    const availability = await LanguageModel.availability(multimodalOptions);

    if (availability === 'unavailable') {
      throw new Error('MULTIMODAL_UNAVAILABLE');
    }

    // If model needs download, add monitor for progress
    let session;
    if (availability === 'after-download') {
      session = await LanguageModel.create({
        ...multimodalOptions,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const progress = Math.round(e.loaded * 100);
          });
        }
      });
    } else {
      // Model is readily available
      session = await LanguageModel.create(multimodalOptions);
    }

    // Convert base64 data URL to ImageBitmap (required format for Prompt API)
    const imageBlob = await fetch(bookmark.image).then(r => r.blob());
    let imageBitmap = await createImageBitmap(imageBlob);

    // Resize if image is too large (to prevent QuotaExceededError)
    const maxDimension = 1920; // Max width or height
    if (imageBitmap.width > maxDimension || imageBitmap.height > maxDimension) {
      const scale = maxDimension / Math.max(imageBitmap.width, imageBitmap.height);
      const newWidth = Math.floor(imageBitmap.width * scale);
      const newHeight = Math.floor(imageBitmap.height * scale);

      // Use OffscreenCanvas to resize
      const canvas = new OffscreenCanvas(newWidth, newHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

      // Convert canvas back to blob, then to ImageBitmap
      const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      imageBitmap = await createImageBitmap(resizedBlob);
    }

    // Send image + prompt to AI
    const promptText = `Analyze this screenshot image carefully and provide:
1. A 6-7 line summary describing what you see in the image
2. 2-3 relevant topic tags

Focus on:
- Any text visible in the image
- Visual elements (charts, diagrams, UI components, etc.)
- The overall context and purpose of the screenshot

Respond in this exact format:
TAGS: [2-3 relevant topic tags, comma-separated]
SUMMARY: [6-7 line summary of the screenshot content]`;

    const response = await session.prompt([
      {
        role: 'user',
        content: [
          { type: 'text', value: promptText },
          { type: 'image', value: imageBitmap }
        ]
      }
    ]);

    // Parse response
    let tags = [];
    let summary = String(response).trim();

    const tagsMatch = response.match(/TAGS:\s*(.+?)(?=\n|$)/i);
    const summaryMatch = response.match(/SUMMARY:\s*(.+)/is);

    if (tagsMatch) {
      const tagsText = tagsMatch[1].trim();
      tags = tagsText
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 3);
    }

    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    return { summary, tags, method: 'multimodal' };

  } catch (error) {
    // Fallback to OCR-based summarization
    // Check for various error types that indicate multimodal isn't working
    const shouldFallback =
      error.message === 'MULTIMODAL_UNAVAILABLE' ||
      error.name === 'NotSupportedError' ||
      error.message?.includes('unable to create a session') ||
      error.message?.includes('device is unable') ||
      error.name === 'OperationError' ||
      error.name === 'QuotaExceededError' || // Image too large for multimodal
      error.message?.includes('input is too large');

    if (shouldFallback) {
      // Use regular text session
      const session = await getSummarySession();

      // Extract text from rawContent (OCR text)
      const ocrText = bookmark.rawContent || '';

      if (!ocrText || ocrText.trim() === '[Screenshot]') {
        return {
          summary: 'Screenshot saved. Multimodal AI not available for visual analysis.',
          tags: [],
          method: 'ocr-fallback-empty'
        };
      }

      // Summarize OCR text
      const prompt = `Analyze this screenshot text and provide:
1. A 6-7 line summary
2. 2-3 relevant topic tags

Screenshot Text:
${ocrText}

Respond in this exact format:
TAGS: [2-3 relevant topic tags, comma-separated]
SUMMARY: [6-7 line summary]`;

      const stream = session.promptStreaming([{ role: 'user', content: prompt }]);

      let response = '';
      for await (const token of stream) {
        response += token;
      }

      // Parse response
      let tags = [];
      let summary = response.trim();

      const tagsMatch = response.match(/TAGS:\s*(.+?)(?=\n|$)/i);
      const summaryMatch = response.match(/SUMMARY:\s*(.+)/is);

      if (tagsMatch) {
        const tagsText = tagsMatch[1].trim();
        tags = tagsText
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
          .slice(0, 3);
      }

      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }

      return { summary, tags, method: 'ocr-fallback' };
    }

    // Other errors - rethrow
    throw error;
  }
}

// Storage helpers using chrome.storage.local
async function getBookmarks() {
  const result = await chrome.storage.local.get(['bookmarks']);
  return result.bookmarks || [];
}

async function getBookmark(id) {
  const bookmarks = await getBookmarks();
  return bookmarks.find(b => b.id === id);
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

// Queue Management Functions
async function getQueue() {
  const result = await chrome.storage.local.get(['processingQueue']);
  return result.processingQueue || [];
}

async function addToQueue(bookmarkId) {
  const queue = await getQueue();
  if (!queue.includes(bookmarkId)) {
    queue.push(bookmarkId);
    await chrome.storage.local.set({ processingQueue: queue });
  }
}

async function removeFromQueue(bookmarkId) {
  const queue = await getQueue();
  const newQueue = queue.filter(id => id !== bookmarkId);
  await chrome.storage.local.set({ processingQueue: newQueue });
  return newQueue;
}

// Process one bookmark from the queue
async function processNextInQueue() {
  if (isProcessing) {
    return;
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }

  const bookmarkId = queue[0];
  isProcessing = true;

  try {
    const startTime = Date.now();

    // Get bookmark data from IndexedDB (shared between content script and background)
    const bookmark = await getBookmark(bookmarkId);
    if (!bookmark) {
      console.error(`[MindMark Queue] Bookmark ${bookmarkId} not found in IndexedDB`);
      await removeFromQueue(bookmarkId);
      isProcessing = false;
      processNextInQueue(); // Process next item
      return;
    }

    if (!bookmark.rawContent) {
      console.error(`[MindMark Queue] Bookmark ${bookmarkId} has no rawContent`);
      await removeFromQueue(bookmarkId);
      await updateBookmark(bookmarkId, {
        status: 'failed',
        summary: 'No content to summarize'
      });
      isProcessing = false;
      processNextInQueue(); // Process next item
      return;
    }

    let type, tags, summary;

    // Track summarization started
    const bookmarkType = bookmark.isScreenshot ? 'screenshot' : (bookmark.type || 'page');
    trackEvent('summarization_started', { bookmark_type: bookmarkType });

    // Check if this is a screenshot - use multimodal or OCR-based summarization
    if (bookmark.isScreenshot) {
      const result = await summarizeScreenshot(bookmark);
      summary = result.summary;
      tags = result.tags;
      type = 'Screenshot';
    } else {
      // Regular text-based summarization for non-screenshots
      // Get AI session with download progress tracking
      const session = await getSummarySession((progress) => {
        // Update bookmark with download progress
        updateBookmark(bookmarkId, {
          status: 'downloading',
          summary: `⏳ Downloading AI model: ${progress}%... (first time setup)`
        }).catch(err => console.error('[MindMark AI] Failed to update download progress:', err));
      });

      // Truncate content if too long
      const maxChars = 20000;
      const content = bookmark.rawContent.length > maxChars
        ? bookmark.rawContent.substring(0, maxChars) + '\n\n[Content truncated for processing]'
        : bookmark.rawContent;

      // Stream AI response with type detection and tags
      const stream = session.promptStreaming([
        {
          role: 'user',
          content: `Analyze this webpage and provide:
1. A 6-7 line summary of the main content
2. The content type
3. 2-3 relevant topic tags

Title: ${bookmark.title}
URL: ${bookmark.url}

Content:
${content}

Respond in this exact format:
TYPE: [choose one: Article, Video, Tweet, LinkedIn Post, LinkedIn Job, Facebook, Instagram, Reddit, GitHub, StackOverflow, Blog, News, Documentation, Tutorial, Product, or Other]
TAGS: [2-3 relevant topic tags that describe the main themes/subjects, comma-separated, e.g., Machine Learning, Healthcare, Python]
SUMMARY: [6-7 line summary of the main content]`
        }
      ]);

      let response = '';
      for await (const token of stream) {
        response += token;
      }

      const fullResponse = response.trim();

      // Parse TYPE, TAGS, and SUMMARY from response
      type = 'Article'; // default
      tags = []; // default empty array
      summary = fullResponse;

      const typeMatch = fullResponse.match(/TYPE:\s*(.+?)(?=\n|$)/i);
      const tagsMatch = fullResponse.match(/TAGS:\s*(.+?)(?=\n|$)/i);
      const summaryMatch = fullResponse.match(/SUMMARY:\s*(.+)/is);

      if (typeMatch && summaryMatch) {
        type = typeMatch[1].trim();
        summary = summaryMatch[1].trim();
      } else if (fullResponse.includes('TYPE:') || fullResponse.includes('SUMMARY:')) {
        // If format is partially correct, try to extract what we can
        if (typeMatch) type = typeMatch[1].trim();
        if (summaryMatch) summary = summaryMatch[1].trim();
      }

      // Parse tags
      if (tagsMatch) {
        const tagsText = tagsMatch[1].trim();
        // Split by comma and clean up
        tags = tagsText
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
          .slice(0, 3); // Limit to 3 tags max
      }
    }

    // If no format markers found, treat entire response as summary and keep defaults
    const aiTime = Date.now() - startTime;

    // Track summarization completed
    trackEvent('summarization_completed', {
      bookmark_type: bookmarkType,
      duration_ms: aiTime,
      content_length: bookmark.rawContent?.length || 0
    });

    // Update bookmark in chrome.storage.local (shared storage)
    await updateBookmark(bookmarkId, {
      summary: summary,
      type: type, // AI-detected type (or "Screenshot" if isScreenshot flag is set)
      tags: tags, // AI-detected tags (2-3 max)
      rawContent: null, // Delete raw content to save space
      status: 'complete'
    });

    // Remove from queue
    await removeFromQueue(bookmarkId);

  } catch (error) {
    console.error(`[MindMark Queue] Failed to process bookmark ${bookmarkId}:`, error);

    // Track summarization failed
    const bookmark = await getBookmark(bookmarkId).catch(() => null);
    const bookmarkType = bookmark?.isScreenshot ? 'screenshot' : (bookmark?.type || 'page');
    trackEvent('summarization_failed', {
      bookmark_type: bookmarkType,
      error_type: error.message
    });

    // Handle different error types
    let status = 'failed';
    let summary = 'Failed to generate summary';

    if (error.message === 'MODEL_UNAVAILABLE') {
      status = 'failed';
      summary = '❌ AI model is not available on this device. Please enable Gemini Nano in chrome://flags/#optimization-guide-on-device-model and restart Chrome.';
    } else {
      // Generic failure - likely resource exhaustion or other error
      status = 'failed';
      summary = 'Failed to generate summary';
    }

    // Mark with appropriate status and keep rawContent so user can retry
    try {
      await updateBookmark(bookmarkId, {
        status: status,
        summary: summary
      });
    } catch (updateError) {
      console.error(`[MindMark Queue] Failed to update bookmark ${bookmarkId}:`, updateError);
    }

    await removeFromQueue(bookmarkId);
  } finally {
    isProcessing = false;

    // Process next item in queue (recursive sequential processing)
    const remainingQueue = await getQueue();
    if (remainingQueue.length > 0) {
      // Small delay to prevent tight loop
      setTimeout(() => processNextInQueue(), 100);
    }
  }
}

// ====================
// NOTIFICATION SYSTEM
// ====================

// Schedule alarm for weekly digest notification
async function scheduleWeeklyDigestAlarm(settings) {
  // Clear any existing alarm
  await chrome.alarms.clear('weeklyDigest');

  if (!settings.enabled) {
    return;
  }

  // Calculate next alarm time
  const now = new Date();
  const currentDay = now.getDay();
  const targetDay = settings.day; // 0=Sunday, 1=Monday, etc.
  const targetTime = settings.time; // Can be fractional (e.g., 16.0833 for 4:05 PM)

  // Extract hours and minutes
  const targetHour = Math.floor(targetTime);
  const targetMinutes = Math.round((targetTime - targetHour) * 60);

  // Calculate days until target day
  let daysUntilTarget = targetDay - currentDay;

  // Create target date
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(targetHour, targetMinutes, 0, 0);

  // Check if target is in the past (allow 10 second buffer for same-minute scheduling)
  const timeDifferenceMs = targetDate.getTime() - now.getTime();

  // If target is more than 10 seconds in the past, add 7 days
  if (timeDifferenceMs < -10000) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  // Create alarm (repeats weekly)
  await chrome.alarms.create('weeklyDigest', {
    when: targetDate.getTime(),
    periodInMinutes: 7 * 24 * 60 // Repeat every 7 days
  });
}

// Send weekly digest notification
async function sendWeeklyDigestNotification() {
  // Get bookmarks count for this week
  const bookmarks = await getBookmarks();
  const now = new Date();
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const weekArticles = bookmarks.filter(b => b.timestamp >= monday.getTime());
  const weekCount = weekArticles.length;

  // Create notification with all required properties
  // Use unique ID with timestamp to ensure notification appears every time
  const uniqueId = 'weeklyDigest_' + Date.now();

  try {
    const notificationId = await chrome.notifications.create(uniqueId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: '📊 Your Weekly Digest is Ready!',
      message: weekCount > 0
        ? `You saved ${weekCount} article${weekCount !== 1 ? 's' : ''} this week. Click to view your digest!`
        : 'No articles saved this week. Start saving to see your digest!',
      priority: 2,
      requireInteraction: true
    });

    // Save timestamp of last notification
    await chrome.storage.local.set({ lastNotificationTime: Date.now() });
  } catch (error) {
    console.error('[MindMark Notifications] Failed to create notification:', error);
    // Fallback: Try without icon
    try {
      const fallbackId = 'weeklyDigest_fallback_' + Date.now();
      const notificationId = await chrome.notifications.create(fallbackId, {
        type: 'basic',
        iconUrl: '',
        title: '📊 Your Weekly Digest is Ready!',
        message: weekCount > 0
          ? `You saved ${weekCount} article${weekCount !== 1 ? 's' : ''} this week. Click to view your digest!`
          : 'No articles saved this week. Start saving to see your digest!',
        priority: 2,
        requireInteraction: true
      });

      // Save timestamp of last notification
      await chrome.storage.local.set({ lastNotificationTime: Date.now() });
    } catch (fallbackError) {
      console.error('[MindMark Notifications] Fallback notification also failed:', fallbackError);
    }
  }
}

// Handle alarm trigger
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'weeklyDigest') {
    await sendWeeklyDigestNotification();
  }
});

// Handle notification click
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Check if it's a weekly digest notification (starts with 'weeklyDigest')
  if (notificationId.startsWith('weeklyDigest')) {
    // Open bookmarks page with weekly digest view
    const url = chrome.runtime.getURL('bookmarks.html#weekly-digest');
    await chrome.tabs.create({ url });

    // Clear the notification
    chrome.notifications.clear(notificationId);
  }
  // Check if it's a test notification (starts with 'testNotification')
  else if (notificationId.startsWith('testNotification')) {
    // Open bookmarks page (main view)
    const url = chrome.runtime.getURL('bookmarks.html');
    await chrome.tabs.create({ url });

    // Clear the notification
    chrome.notifications.clear(notificationId);
  }
});

// Check for missed notifications (if Chrome was closed during scheduled time)
async function checkMissedNotifications() {
  const result = await chrome.storage.local.get(['notificationSettings', 'lastNotificationTime']);
  const settings = result.notificationSettings;
  const lastNotificationTime = result.lastNotificationTime || 0;

  if (!settings || !settings.enabled) {
    return;
  }

  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const timeSinceLastNotification = now - lastNotificationTime;

  // If it's been more than 7 days since last notification, we missed one
  if (timeSinceLastNotification > oneWeek) {
    await sendWeeklyDigestNotification();
  }
}

// Initialize alarms on startup
async function initializeNotifications() {
  const result = await chrome.storage.local.get(['notificationSettings']);
  const settings = result.notificationSettings;

  if (settings && settings.enabled) {
    await scheduleWeeklyDigestAlarm(settings);

    // Check if we missed any notifications while Chrome was closed
    await checkMissedNotifications();
  }
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle screenshot capture
  if (msg?.type === "CAPTURE_SCREENSHOT") {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        sendResponse({ success: true, dataUrl: dataUrl });
      } catch (error) {
        console.error('[MindMark] Screenshot capture failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle notification settings update
  if (msg?.type === "UPDATE_NOTIFICATION_SETTINGS") {
    (async () => {
      try {
        await scheduleWeeklyDigestAlarm(msg.settings);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[MindMark] Failed to update notification settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle adding bookmark to queue
  if (msg?.type === "MINDMARK_ADD_TO_QUEUE") {
    (async () => {
      try {
        // Bookmark already exists in chrome.storage.local (content script saved it)
        // Just add to queue
        await addToQueue(msg.bookmarkId);

        // Start processing if not already processing
        processNextInQueue();

        sendResponse({ success: true });
      } catch (error) {
        console.error('[MindMark] Failed to add to queue:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle retry request
  if (msg?.type === "MINDMARK_RETRY") {
    (async () => {
      try {

        // Get the bookmark to check if it has rawContent
        const bookmark = await getBookmark(msg.bookmarkId);
        if (!bookmark) {
          throw new Error('Bookmark not found');
        }

        if (!bookmark.rawContent) {
          throw new Error('No content available for retry. Please save the page again.');
        }

        // Reset status to pending and add to queue
        await updateBookmark(msg.bookmarkId, {
          status: 'pending',
          summary: 'Queued for summarization'
        });

        await addToQueue(msg.bookmarkId);

        // Start processing if not already processing
        processNextInQueue();

        sendResponse({ success: true });
      } catch (error) {
        console.error('[MindMark] Failed to retry:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle opening bookmarks page
  if (msg?.type === "MINDMARK_OPEN_BOOKMARKS") {
    chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
    sendResponse({ ok: true });
  }

  // Handle extension icon click
  if (msg?.type === "MINDMARK_TOGGLE") {
    sendResponse({ ok: true });
  }

  // Handle badge counter update
  if (msg?.type === "UPDATE_BADGE") {
    const count = msg.count || 0;
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4a90e2' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    sendResponse({ ok: true });
  }

  // Handle onboarding - check model status
  if (msg?.type === "CHECK_MODEL_STATUS") {
    (async () => {
      try {
        const availability = await checkModelAvailability();
        sendResponse({ status: availability });
      } catch (error) {
        console.error('[MindMark Onboarding] Failed to check status:', error);
        sendResponse({ status: 'unavailable' });
      }
    })();
    return true;
  }

  // Handle onboarding - download model
  if (msg?.type === "DOWNLOAD_MODEL") {
    (async () => {
      try {
        // Create session to trigger download with progress monitoring
        await getSummarySession((progress) => {
          // Send progress update to onboarding page
          chrome.runtime.sendMessage({ type: 'DOWNLOAD_PROGRESS', progress });
        });

        // Notify completion
        chrome.runtime.sendMessage({ type: 'DOWNLOAD_COMPLETE' });
        sendResponse({ success: true });
      } catch (error) {
        console.error('[MindMark Onboarding] Download failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle analytics tracking
  if (msg?.type === "TRACK_ANALYTICS") {
    trackEvent(msg.eventName, msg.eventParams);
    sendResponse({ ok: true });
    return true;
  }

  // Handle test notification
  if (msg?.type === "TEST_NOTIFICATION") {
    (async () => {
      try {
        // Use unique ID with timestamp to ensure notification appears every time
        const uniqueId = 'testNotification_' + Date.now();

        const notificationId = await chrome.notifications.create(uniqueId, {
          type: 'basic',
          iconUrl: 'http://www.google.com/favicon.ico',
          title: '🔔 Test Notification',
          message: 'This is a test notification from MindMark AI. If you can see this, notifications are working!',
          priority: 2,
          requireInteraction: true
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error('[MindMark] Failed to create test notification:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// Process queue on service worker startup
chrome.runtime.onStartup.addListener(() => {
  processNextInQueue();
});

// Process queue on extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  // Open onboarding on fresh install
  if (details.reason === 'install') {
    // Track extension installed
    trackEvent('extension_installed', {
      version: chrome.runtime.getManifest().version
    });

    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }

  processNextInQueue();
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "MINDMARK_TOGGLE" });
  }
  // Also check queue when user interacts with extension
  processNextInQueue();
});

// Check for pending queue on load
(async () => {
  const queue = await getQueue();
  if (queue.length > 0) {
    processNextInQueue();
  }

  // Initialize notifications
  await initializeNotifications();
})();
