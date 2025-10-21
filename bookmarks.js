// MindMark AI - Bookmarks Page
// Full-page view for managing saved bookmarks

let allBookmarks = [];
let filteredBookmarks = [];
let currentView = 'table'; // 'table', 'cards', or 'ai-search' - default to table
let previousView = 'table'; // Track previous view for back button

// Load bookmarks from chrome.storage.local
async function loadBookmarks() {
  const result = await chrome.storage.local.get(['bookmarks']);
  allBookmarks = result.bookmarks || [];

  // Sort by timestamp (newest first)
  allBookmarks.sort((a, b) => b.timestamp - a.timestamp);

  // Update metrics
  updateMetrics();

  // Initial filter
  filterBookmarks();

  // Populate type and tag filter dropdowns
  populateTypeFilter();
  populateTagFilter();
}

// Update metrics display
function updateMetrics() {
  // Calculate total bookmarks
  const totalBookmarks = allBookmarks.length;

  // Calculate bookmarks saved this week
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const savedThisWeek = allBookmarks.filter(b => b.timestamp >= oneWeekAgo).length;

  // Calculate read/unread percentage
  const completedBookmarks = allBookmarks.filter(b => b.status === 'complete');
  const readBookmarks = completedBookmarks.filter(b => b.isRead).length;
  const readPercent = completedBookmarks.length > 0
    ? Math.round((readBookmarks / completedBookmarks.length) * 100)
    : 0;

  // Update DOM
  document.getElementById('metricThisWeek').textContent = savedThisWeek;
  document.getElementById('metricTotal').textContent = totalBookmarks;
  document.getElementById('metricReadPercent').textContent = `${readPercent}%`;
}

// Populate type filter dropdown with unique types
function populateTypeFilter() {
  const typeFilter = document.getElementById('typeFilter');
  const uniqueTypes = new Set();

  allBookmarks.forEach(bookmark => {
    if (bookmark.type && bookmark.type !== 'Pending') {
      uniqueTypes.add(bookmark.type);
    }
  });

  // Clear existing options (except "All Types")
  typeFilter.innerHTML = '<option value="all">All Types</option>';

  // Add unique types
  Array.from(uniqueTypes).sort().forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeFilter.appendChild(option);
  });
}

// Populate tag filter dropdown with unique tags
function populateTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  const uniqueTags = new Set();

  allBookmarks.forEach(bookmark => {
    if (bookmark.tags && Array.isArray(bookmark.tags)) {
      bookmark.tags.forEach(tag => {
        if (tag && tag.trim()) {
          uniqueTags.add(tag.trim());
        }
      });
    }
  });

  // Clear existing options (except "All Tags")
  tagFilter.innerHTML = '<option value="all">All Tags</option>';

  // Add unique tags
  Array.from(uniqueTags).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    tagFilter.appendChild(option);
  });
}

// Filter bookmarks based on search and filters
function filterBookmarks() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  const readFilter = document.getElementById('readFilter').value;
  const starredFilter = document.getElementById('starredFilter').value;
  const tagFilter = document.getElementById('tagFilter').value;

  filteredBookmarks = allBookmarks.filter(bookmark => {
    // Search filter (title, summary, URL)
    const matchesSearch = !searchQuery ||
      bookmark.title.toLowerCase().includes(searchQuery) ||
      (bookmark.summary && bookmark.summary.toLowerCase().includes(searchQuery)) ||
      bookmark.url.toLowerCase().includes(searchQuery);

    // Status filter
    const matchesStatus = statusFilter === 'all' || bookmark.status === statusFilter;

    // Type filter
    const matchesType = typeFilter === 'all' || bookmark.type === typeFilter;

    // Read filter
    const matchesRead = readFilter === 'all' ||
      (readFilter === 'read' && bookmark.isRead) ||
      (readFilter === 'unread' && !bookmark.isRead);

    // Starred filter
    const matchesStarred = starredFilter === 'all' ||
      (starredFilter === 'starred' && bookmark.isStarred) ||
      (starredFilter === 'unstarred' && !bookmark.isStarred);

    // Tag filter
    const matchesTag = tagFilter === 'all' ||
      (bookmark.tags && Array.isArray(bookmark.tags) && bookmark.tags.includes(tagFilter));

    return matchesSearch && matchesStatus && matchesType && matchesRead && matchesStarred && matchesTag;
  });

  // Update UI
  renderBookmarks();
  updateItemCount();
}

// Update item count display
function updateItemCount() {
  const itemCount = document.getElementById('itemCount');
  itemCount.textContent = `${filteredBookmarks.length} item${filteredBookmarks.length !== 1 ? 's' : ''}`;
}

// Render bookmarks based on current view
function renderBookmarks() {
  if (currentView === 'table') {
    renderTableView();
  } else {
    renderCardsView();
  }

  // Show/hide empty state
  const emptyState = document.getElementById('emptyState');
  const tableView = document.getElementById('tableView');
  const cardsView = document.getElementById('cardsView');

  if (filteredBookmarks.length === 0) {
    emptyState.classList.remove('hidden');
    tableView.classList.add('hidden');
    cardsView.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    if (currentView === 'table') {
      tableView.classList.remove('hidden');
      cardsView.classList.add('hidden');
    } else {
      tableView.classList.add('hidden');
      cardsView.classList.remove('hidden');
    }
  }
}

// Render table view
function renderTableView() {
  const tableBody = document.getElementById('tableBody');

  if (filteredBookmarks.length === 0) {
    tableBody.innerHTML = '';
    return;
  }

  let html = '';
  filteredBookmarks.forEach(bookmark => {
    const date = new Date(bookmark.timestamp).toLocaleDateString();
    const isPending = bookmark.status === 'pending';
    const isFailed = bookmark.status === 'failed';
    const isDownloading = bookmark.status === 'downloading';

    let statusClass = 'status-complete';
    let statusText = 'Complete';
    if (isPending) {
      statusClass = 'status-pending';
      statusText = 'Pending';
    } else if (isDownloading) {
      statusClass = 'status-downloading';
      statusText = 'Downloading';
    } else if (isFailed) {
      statusClass = 'status-failed';
      statusText = 'Failed';
    }

    // Extract domain from URL for "Source" column
    let source = '';
    try {
      const urlObj = new URL(bookmark.url);
      source = urlObj.hostname.replace('www.', '');
    } catch (e) {
      source = bookmark.url;
    }

    const typeDisplay = bookmark.type || 'Unknown';
    const isUnread = !bookmark.isRead;

    // Build row classes
    const rowClasses = [];
    if (isPending) rowClasses.push('pending');
    if (isUnread) rowClasses.push('unread');

    // Format tags
    const tags = bookmark.tags || [];
    const tagsHtml = tags.length > 0
      ? tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')
      : '';

    // Star icon
    const starIcon = bookmark.isStarred ? '⭐' : '☆';

    // Add retry button for failed bookmarks
    const actionButtons = isFailed
      ? `<button class="action-btn btn-retry" data-id="${bookmark.id}" data-action="retry">Retry</button>
         <button class="action-btn btn-delete" data-id="${bookmark.id}" data-action="delete">Delete</button>`
      : `<button class="action-btn btn-view" data-id="${bookmark.id}" data-action="view">View</button>
         <button class="action-btn btn-delete" data-id="${bookmark.id}" data-action="delete">Delete</button>`;

    html += `
      <tr class="${rowClasses.join(' ')}" data-id="${bookmark.id}">
        <td class="title-cell" title="${escapeHtml(bookmark.title)}">
          <span class="star-toggle" data-id="${bookmark.id}" style="cursor: pointer; margin-right: 8px; font-size: 16px;" title="${bookmark.isStarred ? 'Unstar' : 'Star'}">${starIcon}</span>
          ${escapeHtml(bookmark.title)}
          ${tagsHtml ? `<div class="tags-container">${tagsHtml}</div>` : ''}
        </td>
        <td><span class="type-badge">${escapeHtml(typeDisplay)}</span></td>
        <td class="source-cell" title="${escapeHtml(bookmark.url)}">${escapeHtml(source)}</td>
        <td class="date-cell">${date}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td class="actions-cell">
          ${actionButtons}
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;

  // Add event listeners
  tableBody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't open modal if clicking action buttons
      if (e.target.classList.contains('action-btn')) return;

      const id = parseInt(row.getAttribute('data-id'));
      openModal(id);
    });
  });

  // Add event listeners for action buttons
  tableBody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.getAttribute('data-id'));
      const action = btn.getAttribute('data-action');

      if (action === 'view') {
        openModal(id);
      } else if (action === 'delete') {
        deleteBookmark(id);
      } else if (action === 'retry') {
        retryBookmark(id);
      }
    });
  });

  // Add event listeners for star toggles
  tableBody.querySelectorAll('.star-toggle').forEach(star => {
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(star.getAttribute('data-id'));
      await toggleStar(id);
    });
  });
}

// Render cards view
function renderCardsView() {
  const cardsView = document.getElementById('cardsView');

  if (filteredBookmarks.length === 0) {
    cardsView.innerHTML = '';
    return;
  }

  let html = '';
  filteredBookmarks.forEach(bookmark => {
    const date = new Date(bookmark.timestamp).toLocaleDateString();
    const isPending = bookmark.status === 'pending';
    const isDownloading = bookmark.status === 'downloading';
    const isFailed = bookmark.status === 'failed';

    let summaryText = bookmark.summary || 'No summary available';
    if (isPending) {
      summaryText = 'Summary is being generated...';
    } else if (isDownloading) {
      summaryText = '⏳ Downloading AI model... This may take a few minutes.';
    }

    const typeDisplay = bookmark.type || 'Unknown';
    const isUnread = !bookmark.isRead;

    // Build card classes
    const cardClasses = ['bookmark-card'];
    if (isPending) cardClasses.push('pending');
    if (isUnread) cardClasses.push('unread');

    // Format tags
    const tags = bookmark.tags || [];
    const tagsHtml = tags.length > 0
      ? `<div class="tags-container">${tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    // Determine status badge
    let statusClass = 'status-complete';
    let statusText = 'Complete';
    if (isPending) {
      statusClass = 'status-pending';
      statusText = 'Pending';
    } else if (isDownloading) {
      statusClass = 'status-downloading';
      statusText = 'Downloading';
    } else if (isFailed) {
      statusClass = 'status-failed';
      statusText = 'Failed';
    }

    // Star icon
    const starIcon = bookmark.isStarred ? '⭐' : '☆';

    html += `
      <div class="${cardClasses.join(' ')}" data-id="${bookmark.id}" style="position: relative;">
        <span class="star-toggle-card" data-id="${bookmark.id}" style="position: absolute; top: 12px; right: 12px; cursor: pointer; font-size: 18px; z-index: 10;" title="${bookmark.isStarred ? 'Unstar' : 'Star'}">${starIcon}</span>
        ${bookmark.image ? `<img src="${escapeHtml(bookmark.image)}" class="bookmark-image" alt="" onerror="this.style.display='none'">` : ''}
        <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
        ${tagsHtml}
        <div class="bookmark-summary">${escapeHtml(summaryText)}</div>
        <div class="bookmark-meta">
          <span>${escapeHtml(typeDisplay)} • ${date}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;
  });

  cardsView.innerHTML = html;

  // Add click listeners
  cardsView.querySelectorAll('.bookmark-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking star toggle
      if (e.target.classList.contains('star-toggle-card')) return;

      const id = parseInt(card.getAttribute('data-id'));
      openModal(id);
    });
  });

  // Add event listeners for star toggles in cards view
  cardsView.querySelectorAll('.star-toggle-card').forEach(star => {
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(star.getAttribute('data-id'));
      await toggleStar(id);
    });
  });
}

// Mark bookmark as read
async function markAsRead(id) {
  const bookmark = allBookmarks.find(b => b.id === id);
  if (!bookmark || bookmark.isRead) return;

  // Update bookmark
  bookmark.isRead = true;
  bookmark.readAt = Date.now();

  // Save to storage
  await chrome.storage.local.set({ bookmarks: allBookmarks });

  // Update badge counter
  updateBadgeCounter();
}

// Toggle read/unread status
async function toggleRead(id) {
  const bookmark = allBookmarks.find(b => b.id === id);
  if (!bookmark) return;

  // Toggle read status
  bookmark.isRead = !bookmark.isRead;
  bookmark.readAt = bookmark.isRead ? Date.now() : null;

  // Save to storage
  await chrome.storage.local.set({ bookmarks: allBookmarks });

  // Update badge counter
  updateBadgeCounter();

  // Refresh display
  filterBookmarks();
}

// Toggle starred/favorite status
async function toggleStar(id) {
  const bookmark = allBookmarks.find(b => b.id === id);
  if (!bookmark) return;

  // Toggle starred status
  bookmark.isStarred = !bookmark.isStarred;

  // Save to storage
  await chrome.storage.local.set({ bookmarks: allBookmarks });

  // Refresh display
  filterBookmarks();
}

// Update badge counter
function updateBadgeCounter() {
  const unreadCount = allBookmarks.filter(b => !b.isRead && b.status === 'complete').length;

  chrome.runtime.sendMessage({
    type: 'UPDATE_BADGE',
    count: unreadCount
  }).catch(() => {
    // Ignore errors if background script isn't ready
  });
}

// Open modal with bookmark details
function openModal(id) {
  const bookmark = allBookmarks.find(b => b.id === id);
  if (!bookmark) return;

  // Auto-mark as read when viewing (unless it's pending)
  if (!bookmark.isRead && bookmark.status === 'complete') {
    markAsRead(id);
  }

  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');

  const date = new Date(bookmark.timestamp).toLocaleDateString();
  const isPending = bookmark.status === 'pending';
  const isFailed = bookmark.status === 'failed';
  const isDownloading = bookmark.status === 'downloading';
  const isScreenshot = bookmark.isScreenshot || bookmark.type === 'Screenshot';

  // Check if this is a screenshot - use special layout
  if (isScreenshot && bookmark.image) {
    renderScreenshotModal(bookmark, id, date, isPending, isFailed, isDownloading);
    return;
  }

  // Regular modal for non-screenshots
  let summaryText = bookmark.summary || 'No summary available';
  let summaryStyle = '';
  let showSummaryText = true;

  if (isPending) {
    summaryText = 'Summary is being generated. Please refresh the page in a moment to see it.';
    summaryStyle = 'color: #4a90e2; font-style: italic;';
  } else if (isDownloading) {
    summaryText = 'AI model is being downloaded... Please check back in a few minutes.';
    summaryStyle = 'color: #0c5460; font-style: italic;';
  } else if (isFailed) {
    showSummaryText = false;
  }

  const typeDisplay = bookmark.type || 'Unknown';

  const tags = bookmark.tags || [];
  const tagsHtml = tags.length > 0
    ? `<div class="tags-container" style="margin-bottom: 16px;">${tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  const downloadingMessage = isDownloading ? `
    <div class="failure-message" style="background: #d1ecf1; border-left-color: #17a2b8;">
      <div class="failure-message-title" style="color: #0c5460;">⏳ Downloading AI model (first time setup)</div>
      <div class="failure-message-text" style="color: #0c5460;">
        The AI model is being downloaded in the background. This is a one-time process that may take a few minutes depending on your connection speed.
        <br><br>
        Your content is safely saved! Once the download completes, the summary will be generated automatically. Please check back shortly.
      </div>
    </div>
  ` : '';

  const failureMessage = isFailed ? `
    <div class="failure-message">
      <div class="failure-message-title">⚠️ Summary generation failed</div>
      <div class="failure-message-text">
        Your content is safely saved! Sometimes our AI can't find resources when Chrome has many tabs open.
        Try closing some tabs and click <strong>Retry</strong> below.
      </div>
    </div>
  ` : '';

  const retryButton = isFailed ? `
    <button class="btn btn-retry" id="retryModalBtn" data-id="${bookmark.id}">🔄 Retry Summary</button>
  ` : '';

  const starButton = bookmark.isStarred
    ? `<button class="btn btn-secondary" id="toggleStarBtn" data-id="${bookmark.id}" style="background: #ffc107; color: #000;">⭐ Starred</button>`
    : `<button class="btn btn-secondary" id="toggleStarBtn" data-id="${bookmark.id}">☆ Star</button>`;

  modalContent.innerHTML = `
    ${bookmark.image ? `<img src="${escapeHtml(bookmark.image)}" class="modal-image" alt="" onerror="this.style.display='none'">` : ''}
    <div class="modal-title">${escapeHtml(bookmark.title)}</div>
    <div style="font-size: 14px; color: #999; margin-bottom: 16px;">
      <span class="type-badge">${escapeHtml(typeDisplay)}</span> • ${date}
    </div>
    ${tagsHtml}
    ${downloadingMessage}
    ${failureMessage}
    ${showSummaryText ? `<div class="modal-summary" style="${summaryStyle}">${escapeHtml(summaryText)}</div>` : ''}
    <div class="modal-actions">
      ${retryButton}
      ${starButton}
      <button class="btn btn-secondary" id="toggleReadBtn" data-id="${bookmark.id}">
        ${bookmark.isRead ? '✓ Read' : 'Mark as Read'}
      </button>
      <a href="${escapeHtml(bookmark.url)}" target="_blank" class="btn btn-primary">Open Link</a>
      <button class="btn btn-secondary" id="closeModal">Close</button>
      <button class="btn btn-secondary" id="deleteModal" data-id="${bookmark.id}" style="background: #dc3545; color: white;">Delete</button>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('deleteModal').addEventListener('click', () => {
    deleteBookmark(id);
    closeModal();
  });
  document.getElementById('toggleReadBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRead(id);
    closeModal();
  });
  document.getElementById('toggleStarBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStar(id);
    closeModal();
  });

  const retryModalBtn = document.getElementById('retryModalBtn');
  if (retryModalBtn) {
    retryModalBtn.addEventListener('click', () => {
      retryBookmark(id);
      closeModal();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Render screenshot modal with Facebook/Instagram style layout
function renderScreenshotModal(bookmark, id, date, isPending, isFailed, isDownloading) {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');

  let summaryText = bookmark.summary || 'No summary available';
  let summaryStyle = '';
  let showSummaryText = true;

  if (isPending) {
    summaryText = 'Summary is being generated. Please refresh the page in a moment to see it.';
    summaryStyle = 'color: #4a90e2; font-style: italic;';
  } else if (isDownloading) {
    summaryText = 'AI model is being downloaded... Please check back in a few minutes.';
    summaryStyle = 'color: #0c5460; font-style: italic;';
  } else if (isFailed) {
    showSummaryText = false;
  }

  const tags = bookmark.tags || [];
  const tagsHtml = tags.length > 0
    ? `<div class="tags-container" style="margin-bottom: 16px;">${tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  const failureMessage = isFailed ? `
    <div class="failure-message">
      <div class="failure-message-title">⚠️ Summary generation failed</div>
      <div class="failure-message-text">
        Your content is safely saved! Sometimes our AI can't find resources when Chrome has many tabs open.
        Try closing some tabs and click <strong>Retry</strong> below.
      </div>
    </div>
  ` : '';

  const retryButton = isFailed ? `
    <button class="btn btn-retry" id="retryModalBtn" data-id="${bookmark.id}">🔄 Retry Summary</button>
  ` : '';

  const starButton = bookmark.isStarred
    ? `<button class="btn btn-secondary" id="toggleStarBtn" data-id="${bookmark.id}" style="background: #ffc107; color: #000;">⭐ Starred</button>`
    : `<button class="btn btn-secondary" id="toggleStarBtn" data-id="${bookmark.id}">☆ Star</button>`;

  // Screenshot-specific layout (70/30 split)
  modalContent.innerHTML = `
    <div class="screenshot-image-container">
      <button class="screenshot-close-btn" id="closeModal">×</button>
      <img src="${escapeHtml(bookmark.image)}" class="screenshot-image-large" id="screenshotImage" alt="">
      <div class="screenshot-zoom-hint">Click to zoom</div>
    </div>
    <div class="screenshot-info-sidebar">
      <div class="modal-title">${escapeHtml(bookmark.title)}</div>
      <div style="font-size: 14px; color: #999; margin-bottom: 16px;">
        <span class="type-badge">📸 Screenshot</span> • ${date}
      </div>
      ${tagsHtml}
      ${failureMessage}
      ${showSummaryText ? `<div class="modal-summary" style="${summaryStyle}">${escapeHtml(summaryText)}</div>` : ''}
      <div class="modal-actions" style="flex-wrap: wrap;">
        ${retryButton}
        ${starButton}
        <button class="btn btn-secondary" id="toggleReadBtn" data-id="${bookmark.id}">
          ${bookmark.isRead ? '✓ Read' : 'Mark as Read'}
        </button>
        <button class="btn btn-secondary" id="downloadScreenshotBtn">⬇ Download</button>
        <a href="${escapeHtml(bookmark.url)}" target="_blank" class="btn btn-primary">Open Link</a>
        <button class="btn btn-secondary" id="deleteModal" data-id="${bookmark.id}" style="background: #dc3545; color: white;">Delete</button>
      </div>
    </div>
  `;

  // Add screenshot-specific class to modal
  modal.classList.add('open', 'modal-screenshot');

  // Zoom functionality
  const screenshotImage = document.getElementById('screenshotImage');
  screenshotImage.addEventListener('click', () => {
    screenshotImage.classList.toggle('zoomed');
  });

  // Event listeners
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('deleteModal').addEventListener('click', () => {
    deleteBookmark(id);
    closeModal();
  });
  document.getElementById('toggleReadBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRead(id);
    closeModal();
  });
  document.getElementById('toggleStarBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStar(id);
    closeModal();
  });

  // Download screenshot button
  document.getElementById('downloadScreenshotBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    downloadScreenshot(bookmark.image, bookmark.title);
  });

  const retryModalBtn = document.getElementById('retryModalBtn');
  if (retryModalBtn) {
    retryModalBtn.addEventListener('click', () => {
      retryBookmark(id);
      closeModal();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Close modal
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('open', 'modal-screenshot');
}

// Download screenshot
function downloadScreenshot(imageDataUrl, title) {
  try {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageDataUrl;

    // Generate filename from title (clean it up for filesystem)
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    link.download = `${cleanTitle}_${timestamp}.png`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('[MindMark] Failed to download screenshot:', error);
    alert('Failed to download screenshot. Please try again.');
  }
}

// Delete bookmark
async function deleteBookmark(id) {
  if (!confirm('Are you sure you want to delete this bookmark?')) {
    return;
  }

  try {
    // Remove from allBookmarks array
    allBookmarks = allBookmarks.filter(b => b.id !== id);

    // Save back to chrome.storage.local
    await chrome.storage.local.set({ bookmarks: allBookmarks });

    // Refresh display
    filterBookmarks();
    populateTypeFilter();
  } catch (error) {
    console.error('[MindMark Bookmarks] Failed to delete bookmark:', error);
    alert('Failed to delete bookmark');
  }
}

// Retry bookmark summarization
async function retryBookmark(id) {
  try {
    // Send retry message to background script
    const response = await chrome.runtime.sendMessage({
      type: 'MINDMARK_RETRY',
      bookmarkId: id
    });

    if (response.success) {
      alert('✓ Retry started! The summary will be generated shortly. Please refresh the page in a moment.');

      // Refresh the bookmarks list
      await loadBookmarks();
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (error) {
    console.error('[MindMark Bookmarks] Failed to retry bookmark:', error);
    alert(`Failed to retry: ${error.message}`);
  }
}

// Switch view
function switchView(view) {
  // Save previous view if not switching to special views
  const specialViews = ['ai-search', 'weekly-digest', 'settings'];
  if (!specialViews.includes(view) && !specialViews.includes(currentView)) {
    previousView = currentView;
  }

  currentView = view;

  // Update button states
  document.getElementById('tableViewBtn').classList.toggle('active', view === 'table');
  document.getElementById('cardsViewBtn').classList.toggle('active', view === 'cards');
  document.getElementById('aiSearchBtn').classList.toggle('active', view === 'ai-search');
  document.getElementById('weeklyDigestBtn').classList.toggle('active', view === 'weekly-digest');

  // Show/hide views
  if (view === 'ai-search') {
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('cardsView').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('aiSearchView').classList.remove('hidden');
    document.getElementById('weeklyDigestView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');

    // Hide search/filters when in AI mode
    document.querySelector('.toolbar').style.display = 'none';
    document.querySelector('.section-header').style.display = 'none';
  } else if (view === 'weekly-digest') {
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('cardsView').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('aiSearchView').classList.add('hidden');
    document.getElementById('weeklyDigestView').classList.remove('hidden');
    document.getElementById('settingsView').classList.add('hidden');

    // Hide search/filters when in Weekly Digest mode
    document.querySelector('.toolbar').style.display = 'none';
    document.querySelector('.section-header').style.display = 'none';

    // Generate and display digest
    displayWeeklyDigest();
  } else if (view === 'settings') {
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('cardsView').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('aiSearchView').classList.add('hidden');
    document.getElementById('weeklyDigestView').classList.add('hidden');
    document.getElementById('settingsView').classList.remove('hidden');

    // Hide search/filters when in Settings mode
    document.querySelector('.toolbar').style.display = 'none';
    document.querySelector('.section-header').style.display = 'none';

    // Load and display settings
    displaySettings();
  } else {
    document.getElementById('aiSearchView').classList.add('hidden');
    document.getElementById('weeklyDigestView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.querySelector('.toolbar').style.display = 'flex';
    document.querySelector('.section-header').style.display = 'flex';

    // Render normal view
    renderBookmarks();
  }
}

// Back to previous view
function backToPreviousView() {
  switchView(previousView);
}

// AI Search functionality
async function handleAISearch() {
  const userQuestion = document.getElementById('aiSearchInput').value.trim();

  if (!userQuestion) {
    alert('Please enter a question');
    return;
  }

  // Show loading
  document.getElementById('aiEmptyState').classList.add('hidden');
  document.getElementById('aiAnswerSection').classList.add('hidden');
  document.getElementById('aiResultsSection').classList.add('hidden');
  document.getElementById('aiLoading').classList.remove('hidden');

  try {
    // Get all completed bookmarks
    const completedBookmarks = allBookmarks.filter(b => b.status === 'complete' && b.summary);

    if (completedBookmarks.length === 0) {
      throw new Error('No bookmarks with summaries available. Please wait for bookmarks to be processed.');
    }

    // Format bookmarks into text
    const bookmarkText = completedBookmarks.map(b =>
      `[ID:${b.id}] ${b.title}\nSummary: ${b.summary}\nType: ${b.type}\nURL: ${b.url}\n---`
    ).join('\n\n');

    // Create AI session using Chrome's built-in AI (same as background.js)
    const options = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    const availability = await LanguageModel.availability(options);
    if (availability === 'unavailable') {
      throw new Error('Gemini Nano is not available. Please enable it in chrome://flags/#optimization-guide-on-device-model');
    }

    const session = await LanguageModel.create(options);

    // Build prompt
    const prompt = `You are a helpful assistant analyzing saved bookmarks. Answer the user's question based on the bookmarks below.

USER QUESTION: "${userQuestion}"

SAVED BOOKMARKS:
${bookmarkText}

Provide:
1. A clear 2-3 sentence answer to the question
2. List the IDs of relevant bookmarks (comma-separated numbers only)

Format your response exactly like this:
ANSWER: [your 2-3 sentence answer]
BOOKMARKS: [comma-separated bookmark IDs, e.g., 1,3,5]`;

    // Get AI response (using streaming API like background.js)
    const stream = session.promptStreaming([{ role: 'user', content: prompt }]);

    let response = '';
    for await (const token of stream) {
      response += token;
    }

    // Parse response
    const answerMatch = response.match(/ANSWER:\s*(.+?)(?=BOOKMARKS:|$)/s);
    const bookmarksMatch = response.match(/BOOKMARKS:\s*(.+)/s);

    let answer = answerMatch?.[1]?.trim() || response.trim();
    let relevantIds = [];

    if (bookmarksMatch) {
      const idsText = bookmarksMatch[1].trim();
      relevantIds = idsText.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
    }

    // Get relevant bookmarks
    const relevantBookmarks = completedBookmarks.filter(b => relevantIds.includes(b.id));

    // If no bookmarks matched, try to find relevant ones by keyword
    if (relevantBookmarks.length === 0) {
      // Show all bookmarks as fallback
      displayAIResults(answer, completedBookmarks.slice(0, 5));
    } else {
      displayAIResults(answer, relevantBookmarks);
    }

  } catch (error) {
    console.error('[MindMark AI Search] Error:', error);

    // Hide loading
    document.getElementById('aiLoading').classList.add('hidden');

    // Show error
    alert(`AI Search failed: ${error.message}\n\nPlease make sure:\n1. You have saved bookmarks\n2. Bookmarks have been processed (not pending)\n3. Gemini Nano is available in your browser`);
  }
}

// Display AI results
function displayAIResults(answer, relevantBookmarks) {
  // Hide loading
  document.getElementById('aiLoading').classList.add('hidden');

  // Show answer
  document.getElementById('aiAnswerText').textContent = answer;
  document.getElementById('aiAnswerSection').classList.remove('hidden');

  // Show results
  if (relevantBookmarks.length > 0) {
    document.getElementById('aiResultsCount').textContent = relevantBookmarks.length;

    const resultsList = document.getElementById('aiResultsList');
    resultsList.innerHTML = '';

    relevantBookmarks.forEach(bookmark => {
      const card = document.createElement('div');
      card.className = 'ai-result-card';
      card.setAttribute('data-id', bookmark.id);

      const date = new Date(bookmark.timestamp).toLocaleDateString();

      card.innerHTML = `
        <div class="ai-result-title">${escapeHtml(bookmark.title)}</div>
        <div class="ai-result-summary">${escapeHtml(bookmark.summary || 'No summary available')}</div>
        <div class="ai-result-meta">
          <span class="type-badge">${escapeHtml(bookmark.type || 'Unknown')}</span>
          <span>${date}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        openModal(bookmark.id);
      });

      resultsList.appendChild(card);
    });

    document.getElementById('aiResultsSection').classList.remove('hidden');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Convert Markdown to HTML (supports bold, italic, links, lists, line breaks)
function markdownToHtml(text) {
  if (!text) return '';

  // Escape HTML first
  let html = escapeHtml(text);

  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* to <em> (but not if it's part of **)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Convert [link text](url) to <a>
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Convert bullet points (- or *) to <ul><li>
  html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Convert numbered lists (1. 2. 3.) to <ol><li>
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

  // Convert line breaks to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ====================
// WEEKLY DIGEST FEATURE
// ====================

// Get articles from current calendar week (Monday-Sunday)
function getCalendarWeekArticles() {
  const now = new Date();

  // Get start of current week (Monday)
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday is 0, so we need to go back 6 days
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  // Get end of current week (Sunday)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Filter bookmarks saved in this week
  const weekArticles = allBookmarks.filter(b =>
    b.timestamp >= monday.getTime() && b.timestamp <= sunday.getTime()
  );

  return weekArticles;
}

// Generate AI theme summary for the week
async function generateWeekThemeSummary(weekArticles) {
  try {
    // Filter only completed bookmarks with summaries
    const completedArticles = weekArticles.filter(b => b.status === 'complete' && b.summary);

    if (completedArticles.length === 0) {
      return null; // No completed articles to analyze
    }

    // Build text for AI analysis: titles, summaries, tags
    const articlesText = completedArticles.map(b => {
      const tagsText = b.tags && b.tags.length > 0 ? b.tags.join(', ') : '';
      return `Title: ${b.title}\nSummary: ${b.summary}\nTags: ${tagsText}\nType: ${b.type || 'Unknown'}\n---`;
    }).join('\n\n');

    // Create AI session
    const options = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    const availability = await LanguageModel.availability(options);
    if (availability === 'unavailable') {
      throw new Error('AI not available');
    }

    const session = await LanguageModel.create(options);

    // Prompt for theme analysis
    const prompt = `Analyze these articles saved this week and identify the main themes and topics the user focused on.

ARTICLES:
${articlesText}

Provide a 3-4 sentence summary that:
1. Identifies the 2-3 main themes/topics (e.g., "AI & Machine Learning", "Healthcare Technology", "Software Development")
2. Mentions any patterns in content types or sources
3. Is engaging and encouraging (like "This week you explored...")

Keep it concise, friendly, and insightful. Focus on themes, not individual articles.`;

    // Get AI response
    const stream = session.promptStreaming([{ role: 'user', content: prompt }]);

    let response = '';
    for await (const token of stream) {
      response += token;
    }

    return response.trim();

  } catch (error) {
    console.error('[MindMark Digest] Failed to generate theme summary:', error);
    return null;
  }
}

// Display Weekly Digest view
async function displayWeeklyDigest() {
  // Show loading
  document.getElementById('digestSummarySection').innerHTML = '';
  document.getElementById('digestFilterSection').classList.add('hidden');
  document.getElementById('digestArticlesSection').classList.add('hidden');
  document.getElementById('digestLoading').classList.remove('hidden');

  try {
    // Get articles from this week
    const weekArticles = getCalendarWeekArticles();
    const weekCount = weekArticles.length;

    // Calculate total unread articles (across all time, not just this week)
    const totalUnread = allBookmarks.filter(b => !b.isRead && b.status === 'complete').length;

    let themeSummary = null;

    // Generate AI theme summary if there are completed articles
    if (weekCount > 0) {
      themeSummary = await generateWeekThemeSummary(weekArticles);
    }

    // Hide loading
    document.getElementById('digestLoading').classList.add('hidden');

    // Build summary section HTML
    let summaryHTML = '';

    if (weekCount === 0) {
      // No articles saved this week
      summaryHTML = `
        <div class="digest-empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No articles saved this week</div>
          <div class="empty-text">Start saving pages to see your weekly digest!</div>
        </div>
      `;
    } else {
      // Celebration message
      summaryHTML += `
        <div class="digest-celebration">
          <div class="digest-celebration-text">🎉 Great Job! This week you saved ${weekCount} article${weekCount !== 1 ? 's' : ''}!</div>
        </div>
      `;

      // Theme summary (if AI generated one)
      if (themeSummary) {
        summaryHTML += `
          <div class="digest-theme-summary">
            <div class="digest-theme-header">📚 Your Focus This Week:</div>
            <div class="digest-theme-text">${markdownToHtml(themeSummary)}</div>
          </div>
        `;
      }

      // Unread count
      summaryHTML += `
        <div class="digest-unread-count">
          <div class="digest-unread-text">📖 In total, you have ${totalUnread} article${totalUnread !== 1 ? 's' : ''} unread</div>
        </div>
      `;
    }

    document.getElementById('digestSummarySection').innerHTML = summaryHTML;

    // Show filter and articles list if there are articles
    if (weekCount > 0) {
      document.getElementById('digestFilterSection').classList.remove('hidden');
      document.getElementById('digestArticlesSection').classList.remove('hidden');

      // Display articles with default filter (all)
      displayDigestArticles(weekArticles, 'all');

      // Set up filter listener
      document.getElementById('digestReadFilter').value = 'all';
      document.getElementById('digestReadFilter').onchange = (e) => {
        displayDigestArticles(weekArticles, e.target.value);
      };
    }

  } catch (error) {
    console.error('[MindMark Digest] Error displaying digest:', error);

    // Hide loading
    document.getElementById('digestLoading').classList.add('hidden');

    // Show error
    document.getElementById('digestSummarySection').innerHTML = `
      <div class="digest-empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Failed to generate digest</div>
        <div class="empty-text">Please try again later</div>
      </div>
    `;
  }
}

// Display articles list with read/unread filter
function displayDigestArticles(weekArticles, readFilter) {
  // Filter articles based on read status
  let filteredArticles = weekArticles;

  if (readFilter === 'read') {
    filteredArticles = weekArticles.filter(b => b.isRead);
  } else if (readFilter === 'unread') {
    filteredArticles = weekArticles.filter(b => !b.isRead);
  }

  // Update count
  document.getElementById('digestArticlesCount').textContent = filteredArticles.length;

  // Build articles list HTML
  const articlesList = document.getElementById('digestArticlesList');
  articlesList.innerHTML = '';

  if (filteredArticles.length === 0) {
    articlesList.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No articles found</div>';
    return;
  }

  filteredArticles.forEach(bookmark => {
    const card = document.createElement('div');
    card.className = 'ai-result-card';
    card.setAttribute('data-id', bookmark.id);

    const date = new Date(bookmark.timestamp).toLocaleDateString();
    const isPending = bookmark.status === 'pending';
    const isFailed = bookmark.status === 'failed';

    let summaryText = bookmark.summary || 'No summary available';
    if (isPending) summaryText = 'Summary is being generated...';
    if (isFailed) summaryText = '⚠️ Summary generation failed';

    const readBadge = bookmark.isRead
      ? '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600;">✓ READ</span>'
      : '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600;">● UNREAD</span>';

    card.innerHTML = `
      <div class="ai-result-title">${escapeHtml(bookmark.title)}</div>
      <div class="ai-result-summary">${escapeHtml(summaryText)}</div>
      <div class="ai-result-meta">
        <span class="type-badge">${escapeHtml(bookmark.type || 'Unknown')}</span>
        <span>${date}</span>
        ${readBadge}
      </div>
    `;

    card.addEventListener('click', () => {
      openModal(bookmark.id);
    });

    articlesList.appendChild(card);
  });
}

// ====================
// SETTINGS FEATURE
// ====================

// Load settings from storage
async function loadSettings() {
  const result = await chrome.storage.local.get(['notificationSettings']);
  const settings = result.notificationSettings || {
    enabled: true,  // Enabled by default
    day: 5,         // Friday (0=Sunday, 1=Monday, ..., 5=Friday)
    time: 11        // 11:00 AM
  };

  // Update UI
  document.getElementById('notificationsEnabled').checked = settings.enabled;
  document.getElementById('notificationDay').value = settings.day;
  document.getElementById('notificationTime').value = settings.time;

  // Show/hide notification settings based on toggle
  const notificationSettings = document.getElementById('notificationSettings');
  if (settings.enabled) {
    notificationSettings.classList.remove('hidden');
  } else {
    notificationSettings.classList.add('hidden');
  }
}

// Save settings to storage
async function saveSettings() {
  const settings = {
    enabled: document.getElementById('notificationsEnabled').checked,
    day: parseInt(document.getElementById('notificationDay').value),
    time: parseFloat(document.getElementById('notificationTime').value)
  };

  // Save to storage
  await chrome.storage.local.set({ notificationSettings: settings });

  // Show success message
  const successMessage = document.getElementById('successMessage');
  successMessage.classList.add('show');
  setTimeout(() => {
    successMessage.classList.remove('show');
  }, 3000);

  // Send message to background script to update alarms
  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_NOTIFICATION_SETTINGS',
      settings: settings
    });
  } catch (error) {
    console.error('[MindMark Settings] Failed to update background script:', error);
  }
}

// Display Settings view
function displaySettings() {
  loadSettings();
}

// Check and display info banner (one-time view, dismissible)
async function checkInfoBanner() {
  const result = await chrome.storage.local.get(['infoBannerDismissed']);
  const infoBanner = document.getElementById('infoBanner');

  if (!result.infoBannerDismissed) {
    // Show banner if not dismissed
    infoBanner.classList.remove('hidden');
  } else {
    // Hide banner if previously dismissed
    infoBanner.classList.add('hidden');
  }
}

// Dismiss info banner
async function dismissInfoBanner() {
  const infoBanner = document.getElementById('infoBanner');
  infoBanner.classList.add('hidden');

  // Save dismissal state to storage
  await chrome.storage.local.set({ infoBannerDismissed: true });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check and display info banner
  await checkInfoBanner();

  // Info banner close button
  document.getElementById('infoBannerClose').addEventListener('click', dismissInfoBanner);

  // Load bookmarks
  await loadBookmarks();

  // Search input
  document.getElementById('searchInput').addEventListener('input', filterBookmarks);

  // Filter dropdowns
  document.getElementById('statusFilter').addEventListener('change', filterBookmarks);
  document.getElementById('typeFilter').addEventListener('change', filterBookmarks);
  document.getElementById('readFilter').addEventListener('change', filterBookmarks);
  document.getElementById('starredFilter').addEventListener('change', filterBookmarks);
  document.getElementById('tagFilter').addEventListener('change', filterBookmarks);

  // View toggle buttons
  document.getElementById('tableViewBtn').addEventListener('click', () => switchView('table'));
  document.getElementById('cardsViewBtn').addEventListener('click', () => switchView('cards'));
  document.getElementById('aiSearchBtn').addEventListener('click', () => switchView('ai-search'));
  document.getElementById('weeklyDigestBtn').addEventListener('click', () => switchView('weekly-digest'));

  // AI Search functionality
  document.getElementById('backBtn').addEventListener('click', backToPreviousView);
  document.getElementById('aiAskBtn').addEventListener('click', handleAISearch);

  // Weekly Digest functionality
  document.getElementById('backBtnDigest').addEventListener('click', backToPreviousView);

  // Settings functionality
  document.getElementById('settingsBtn').addEventListener('click', () => switchView('settings'));
  document.getElementById('backBtnSettings').addEventListener('click', backToPreviousView);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

  // Toggle notification settings visibility
  document.getElementById('notificationsEnabled').addEventListener('change', (e) => {
    const notificationSettings = document.getElementById('notificationSettings');
    if (e.target.checked) {
      notificationSettings.classList.remove('hidden');
    } else {
      notificationSettings.classList.add('hidden');
    }
  });

  // Enter key to submit AI search
  document.getElementById('aiSearchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAISearch();
    }
  });

  // Listen for storage changes (if bookmarks updated in background)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.bookmarks) {
      loadBookmarks();
    }
  });

  // Update badge counter on load
  updateBadgeCounter();

  // Check URL hash for direct navigation (e.g., from notification)
  if (window.location.hash === '#weekly-digest') {
    switchView('weekly-digest');
  }
});
