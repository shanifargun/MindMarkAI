# MindMarkAI 

**Save now, Think later. Your intelligent bookmarking assistant powered by on-device AI.**

MindMarkAI is a Chrome extension that transforms traditional bookmarking by automatically generating AI-powered summaries of every page you save. Unlike cloud-based solutions, everything runs locally on your device using Chrome's built-in Gemini Nano model.

---

## ✨ Features

- 📚 **Smart Summaries** - AI automatically generates 6-7 line summaries for every bookmark
- 🔍 **AI-Powered Search** - Find bookmarks using natural language: "find the article about Epic Systems I saved last month"
- 📸 **Intelligent Screenshots** - Capture screenshots with automatic OCR and AI analysis
- 💼 **LinkedIn Integration** - Save LinkedIn posts directly from your feed
- 🏷️ **Auto-Tagging** - AI detects content type and generates relevant topic tags
- 📊 **Weekly Digest** - Customizable notifications with AI-generated weekly summaries
- 🔒 **100% Private** - All processing happens on your device, no cloud, no tracking

---

## 🏗️ System Architecture

### Overview

MindMarkAI follows a **Message-Passing Architecture** with three main components:

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Content Script │ ───> │ Background Worker│ ───> │  Gemini Nano AI │
│   (content.js)  │      │  (background.js) │      │  (On-Device)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                         │
        ├─> Extracts page text    ├─> Queue Management
        ├─> Captures screenshots  ├─> AI Summarization
        ├─> LinkedIn parsing      ├─> Analytics
        └─> Saves to Storage      └─> Notifications
```

### File Structure

```
MindMarkAI/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (AI, queue, notifications)
├── content.js             # Content script (page interaction, extraction)
├── bookmarks.js           # Bookmarks page logic (UI, search, collections)
├── onboarding.js          # First-time setup flow
├── popup.js               # Toolbar popup (optional summarizer)
├── bookmarks.html         # Bookmarks management page
├── onboarding.html        # Onboarding/setup page
├── popup.html             # Extension popup UI
└── tesseract.min.js       # OCR library for screenshots
```

---

## 🔄 Data Flow

### 1. Bookmark Saving Flow

User clicks bookmark button → Content script extracts page content → Saves to chrome.storage.local with status='pending' → Sends message to background worker → Background adds to processing queue → Sequential AI summarization via Gemini Nano → Updates bookmark with summary, type, tags → Deletes rawContent to save space

### 2. Screenshot Flow

User clicks screenshot button → Content script sends capture message → Background uses chrome.tabs.captureVisibleTab() → Returns dataURL to content script → Content script runs Tesseract.js OCR (in-browser) → Saves bookmark with image + OCR text → Background tries multimodal AI analysis → Falls back to text-based summarization if multimodal unavailable

### 3. LinkedIn Integration Flow

User visits LinkedIn feed → Content script detects LinkedIn, injects "Save to MindMark" buttons → User clicks save button on a post → Extracts post content (author, text, article preview) → Uses activity ID for deduplication → Saves with type='LinkedIn Post'

---

## 🗄️ Storage Architecture

### Why chrome.storage.local instead of IndexedDB?

We use `chrome.storage.local` for all bookmark data.

**Rationale:**
- **Simplicity** - chrome.storage API is simpler and Chrome-native
- **Service Worker Compatibility** - Works seamlessly in Manifest V3 service workers
- **Sync Capability** - Easy migration path to chrome.storage.sync in future
- **Quota Management** - Chrome handles quota automatically
- **No Schema Management** - No migrations, versioning, or object stores to manage

**Trade-offs:**
- Limited query capabilities (no indexes, must load all bookmarks to filter)
- Smaller storage limit than IndexedDB (but sufficient for thousands of bookmarks)
- Perfect for our use case (hundreds to low thousands of bookmarks)

### Storage Limitations

MindMarkAI uses `chrome.storage.local` with a **~10MB quota**. This includes all bookmark data and screenshot images (stored as base64-encoded data URLs).

**Typical capacity:**
- **Text-only bookmarks:** 2,000-5,000 bookmarks
- **Screenshot-heavy usage:** 20-50 screenshots
- **Mixed usage:** 500-1,000 text bookmarks + 10-20 screenshots

**Note:** Screenshots are the primary storage consumer (~200-500KB each) because they're stored as base64-encoded PNG images within the bookmark objects.

**Future improvements planned:**
- IndexedDB migration for screenshots (larger quota)
- Storage usage warnings
- Bulk screenshot cleanup tools

### Storage Schema

Each bookmark is stored with the following structure:
- `id`: Unique identifier (timestamp-based)
- `title`: Page title
- `url`: Page URL
- `summary`: AI-generated 6-7 line summary
- `type`: AI-detected content type (Article, Video, LinkedIn Post, etc.)
- `tags`: AI-generated topic tags (2-3 max)
- `timestamp`: Save timestamp
- `collection`: User-assigned collection name
- `isRead`: Read/unread status
- `isStarred`: Starred/favorite status
- `isScreenshot`: Boolean flag for screenshots
- `image`: Screenshot data URL (only for screenshots)
- `status`: Processing status (pending/complete/failed)

---

## 🤖 AI Summarization Queue

### Why a Queue System?

Gemini Nano can only process one summarization at a time. Multiple simultaneous requests cause resource contention and failures.

**Solution:** Sequential queue with `isProcessing` flag ensures one-at-a-time processing.

**Key Features:**
- Sequential processing prevents resource exhaustion
- Survives service worker restarts (queue persisted in storage)
- Progress tracking (pending → processing → complete/failed)
- Retry capability (failed bookmarks keep rawContent)
- Auto-resumes on extension load/update

---

## 🧠 AI Integration: Why Gemini Nano?

### Decision Matrix

| Criteria | Gemini Nano | Cloud APIs (GPT, Claude) |
|----------|-------------|--------------------------|
| **Privacy** | ✅ 100% on-device | ❌ Data sent to servers |
| **Cost** | ✅ Free, unlimited | ❌ Pay per token |
| **Latency** | ✅ 1-3 seconds | ⚠️ Network dependent |
| **Offline** | ✅ Works offline | ❌ Requires internet |
| **Setup** | ⚠️ Chrome flags required | ✅ API key only |
| **Quality** | ⚠️ Good for summaries | ✅ State-of-the-art |

**Our Choice:** Gemini Nano

**Rationale:**
- **Privacy First** - User data never leaves their device
- **Zero Cost** - No API fees, unlimited usage
- **Fast** - Local inference faster than network round-trips
- **Sufficient Quality** - 6-7 line summaries don't need GPT-4 level reasoning

### Multimodal vs OCR for Screenshots

For screenshots, we implement a **graceful degradation strategy**:

**1. Try Multimodal First** (Gemini Nano with image input)
- Analyzes screenshot visually
- Reads text + understands context (charts, UI, diagrams)
- Best quality summaries

**2. Fallback to OCR** (Tesseract.js → Text-based summarization)
- If multimodal unavailable (device limitations, quota exceeded)
- Extracts text via OCR
- Summarizes extracted text

---

## 📊 Google Analytics Integration

### Why Measurement Protocol instead of gtag.js?

Chrome extensions have strict Content Security Policy (CSP) that blocks remote script execution. We use GA4 Measurement Protocol (server-side API) instead.

**What We Track:**
- Extension installed/updated
- Bookmarks saved (count, type)
- Summarization events (started, completed, failed, duration)
- Feature usage (screenshot, search, collections)

**What We DON'T Track:**
- Personal information
- Bookmark URLs or content
- Page text or summaries
- Browsing history

**Session Management:**
- Uses `chrome.storage.session` with 30-minute expiry
- Automatically creates new session after timeout
- Complies with GA4 session definitions

---

## 🔔 Notification System

### Weekly Digest Implementation

The notification system uses Chrome's `alarms` API to schedule weekly digest notifications. Users can customize the day and time in settings.

**Key Features:**
- Customizable day and time
- Catch-up for missed notifications (if Chrome was closed during scheduled time)
- Persistent across browser restarts
- Test notification button for debugging

**Missed Notification Detection:**
On extension startup, the system checks if more than 7 days have passed since the last notification. If so, it sends a catch-up notification.

---

## 🔍 AI Search Architecture

### How Natural Language Search Works

Users can search their bookmarks using natural language queries like "find the article I saved a month ago about Epic Systems."

The AI analyzes all bookmark metadata (titles, summaries, tags, dates) and identifies matches based on semantic understanding rather than just keyword matching.

**Advantages over keyword search:**
- Understands synonyms ("article" vs "post" vs "page")
- Temporal reasoning ("a month ago")
- Semantic matching (topic similarity)
- Context awareness (uses summaries, not just titles)

---

## 📸 OCR with Tesseract.js

### Why Tesseract.js?

**Alternatives considered:**
- Cloud OCR APIs (Google Vision, AWS Textract) - Privacy concerns, costs
- Native Chrome OCR - Not available in extensions
- Tesseract.js - Pure JavaScript, runs in browser

**Trade-offs:**
- ✅ 100% client-side, privacy-preserving
- ✅ No API costs
- ✅ Works offline
- ⚠️ Slower than cloud APIs (~5-10 seconds for screenshot)
- ⚠️ Lower accuracy than commercial solutions

**Implementation:**
Tesseract.js runs directly in the content script to avoid CORS issues. Images are preprocessed (resize if too large) before OCR processing.

---

## 💼 LinkedIn Integration

### Implementation Details

**Challenges:**
- Dynamic content (React-based rendering)
- No official API
- Must parse DOM structure
- Activity IDs prevent duplicate saves

**Solution:**
Uses MutationObserver to detect new feed items and inject "Save to MindMark" buttons. Content extraction parses DOM to find author names, post text, and shared article previews.

**Deduplication:**
Saves use LinkedIn activity ID as unique identifier to prevent saving the same post multiple times, even with reposts and shares.

---

## 🎯 Design Decisions Q&A

### Q1: Why not use IndexedDB for storage?

**A:** chrome.storage.local is simpler and sufficient for our scale. We expect users to have hundreds to low thousands of bookmarks, well within the ~10MB quota. IndexedDB would add complexity (schema management, migrations, async initialization) without meaningful benefits for this use case.

### Q2: Why sequential AI processing instead of parallel batching?

**A:** Gemini Nano has resource constraints. Parallel processing causes out of memory errors, quota exceeded errors, and lower quality summaries due to resource contention. Sequential processing ensures consistent, high-quality results. The queue survives restarts and processes in the background.

### Q3: Why store full images for screenshots instead of just URLs?

**A:** Screenshots are ephemeral - the content may change or disappear. Storing the base64-encoded image ensures the user always has access to what they captured, even if the source changes. Trade-off: Larger storage usage, but better user experience.

### Q4: Why use Measurement Protocol for analytics instead of gtag.js?

**A:** Chrome extension CSP blocks inline scripts and remote code execution. gtag.js requires script tags and won't work. Measurement Protocol is a server-side API that works perfectly in extensions.

### Q5: Why auto-delete rawContent after summarization?

**A:** Storage optimization. rawContent can be 50-100KB per bookmark. With AI summary generated, the raw text is no longer needed. This allows users to save thousands of bookmarks without hitting quota limits. Exception: Failed summaries keep rawContent so users can retry.

### Q6: Why not use Chrome's built-in bookmarks API?

**A:** Chrome bookmarks are URL-only with limited metadata. We need AI summaries, screenshots with images, collections/tags, read/starred status, and custom search. Custom storage gives us full control over the data model.

### Q7: Why require chrome://flags setup instead of bundling a smaller AI model?

**A:** Gemini Nano is uniquely powerful and optimized by Google for on-device inference. Bundling alternatives (like ONNX models) would increase extension size dramatically (50-100MB+), provide lower quality summaries, and require manual memory management. The one-time flags setup is worth it for the quality and zero-cost benefits.

---

## 🚀 Getting Started

### Prerequisites

1. **Chrome Browser** (Desktop, version 118+)
2. **Enable Gemini Nano:**
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to **"Enabled BypassPerfRequirement"**
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to **"Enabled"**
   - Restart Chrome

### Installation (Development)

```bash
# Clone the repository
git clone https://github.com/yourusername/mindmarkai.git
cd mindmarkai

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the mindmarkai folder
```

### Installation (Chrome Web Store)

*(Coming soon)*

---

## 🛠️ Development

### Project Setup

No build process required! This is a pure JavaScript Chrome extension.

### File Modification Guide

| File | Purpose | When to Modify |
|------|---------|----------------|
| `content.js` | Page interaction, extraction | Add new content sources, change extraction logic |
| `background.js` | AI, queue, notifications | Modify AI prompts, change summarization logic |
| `bookmarks.js` | UI, search, collections | Update bookmarks page features |
| `manifest.json` | Extension config | Add permissions, change icons |

### Testing

**Manual Testing:**
- Load extension via "Load unpacked"
- Test on various websites
- Check chrome://extensions/ for errors

**Check Service Worker Logs:**
- chrome://extensions/ → "Inspect views: service worker"
- Console shows background.js logs

**Common Issues:**

**Issue:** "LanguageModel is not defined"
- **Fix:** Gemini Nano flags not enabled correctly. Restart Chrome after enabling.

**Issue:** "QuotaExceededError" during screenshot summarization
- **Fix:** Image too large. content.js automatically resizes to 1920px max dimension.

**Issue:** Queue not processing after extension update
- **Fix:** Check service worker console. Queue auto-resumes on load.

---

## 📝 Code Style

- **No build tools** - Pure ES6+ JavaScript
- **No frameworks** - Vanilla JS for minimal bundle size
- **Consistent naming** - camelCase for functions, PascalCase for classes
- **Error handling** - Always wrap async operations in try-catch
- **Comments** - Explain "why" not "what"

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Maintain privacy-first approach (no external data transmission)
- Keep bundle size minimal (avoid large dependencies)
- Test on multiple websites before submitting
- Update README if adding major features

---

## 🙏 Acknowledgments

- **Gemini Nano** - Google's on-device AI model
- **Tesseract.js** - Pure JavaScript OCR
- **Chrome Extensions Team** - Excellent documentation and APIs

---

## 📧 Contact

**Issues:** [GitHub Issues](https://github.com/shanifargun/mindmarkai/issues)

**Email:** shanifargun@gmail.com

---

## 🗺️ Roadmap

- [ ] Shift to a larger storage vs the current one
- [ ] Chrome Web Store publication
- [ ] Export/import bookmarks (JSON, CSV)
- [ ] Browser sync across devices (keeping privacy focus)
- [ ] Advanced filters (date ranges, read status)
- [ ] Bulk operations (delete, move collections)
- [ ] Keyboard shortcuts
- [ ] Dark mode for bookmarks page


---

**Built with ❤️ for privacy-conscious AI adoptors**

