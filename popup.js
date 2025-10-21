// popup.js
let session = null;
let currentController = null;

const statusEl = document.getElementById('status');
const dl = document.getElementById('dl');
const out = document.getElementById('out');
const sys = document.getElementById('sys');
const inp = document.getElementById('inp');

function setStatus(txt) { statusEl.textContent = `Status: ${txt}`; }
function showProgress(pct) {
  dl.style.display = 'block';
  dl.value = Math.max(0, Math.min(100, Math.round(pct)));
}
function hideProgress() { dl.style.display = 'none'; }

async function ensureSession() {
  if (session) return session;

  const options = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    initialPrompts: sys.value.trim()
      ? [{ role: 'system', content: sys.value.trim() }]
      : undefined
  };

  const availability = await LanguageModel.availability(options);
  if (availability === 'unavailable') {
    setStatus('unavailable (update Chrome or check device caps)');
    return null;
  }

  setStatus(availability === 'readily' ? 'starting' : 'downloading model…');
  session = await LanguageModel.create({
    ...options,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        showProgress(e.loaded * 100);
        setStatus(`downloading model… ${Math.round(e.loaded * 100)}%`);
      });
    }
  });

  hideProgress();
  setStatus('ready');
  return session;
}

// --- Page extraction helpers ---
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractPageText(tabId) {
  // Runs in the page. We try selection first, then readable text, then body text.
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      try {
        const sel = window.getSelection()?.toString()?.trim();
        if (sel && sel.length > 40) return sel;

        // Prefer "readable" text if the page offers it (e.g., <article> or role=main)
        const article = document.querySelector('main, article, [role="main"], [data-test-readable], [data-attr-readable]');
        const target = article || document.body;

        // innerText gives visual text (respects CSS visibility)
        let text = target.innerText || '';
        // Fallback: combine headings and paragraphs if innerText is empty
        if (!text || text.length < 40) {
          const parts = [];
          document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li').forEach(n => {
            const t = (n.innerText || n.textContent || '').trim();
            if (t) parts.push(t);
          });
          text = parts.join('\n');
        }

        // Normalize whitespace
        text = text.replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
        return text.trim();
      } catch (e) {
        return '';
      }
    }
  });
  return (result || '').trim();
}

function truncateMiddle(str, maxChars) {
  if (str.length <= maxChars) return str;
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head - 30; // room for ellipsis marker
  return str.slice(0, head) + `\n...\n[truncated ${str.length - maxChars} chars]\n...\n` + str.slice(-tail);
}

async function summarizeWithNano(text, userPrompt) {
  const s = await ensureSession();
  if (!s) return;

  const MAX_CHARS = 24000; // conservative budget for input
  const chunk = truncateMiddle(text, MAX_CHARS);

  const instruction = (userPrompt && userPrompt.trim())
    ? userPrompt.trim()
    : 'Summarize the content in exactly 5 concise bullets.';

  // Stream response
  currentController = new AbortController();
  setStatus('generating…');
  out.textContent = '';

  try {
    const stream = s.promptStreaming(
      [
        { role: 'user', content: `${instruction}\n\n---\nPAGE TEXT:\n${chunk}` }
      ],
      // Optional: constrain response to plain text (no code fences)
      { response: { format: 'text' } }
    );
    for await (const token of stream) {
      out.textContent += token;
    }
    setStatus('done');
  } catch (err) {
    if (err.name === 'AbortError') setStatus('stopped');
    else setStatus(`error: ${err.message}`);
  } finally {
    currentController = null;
  }
}

document.getElementById('ask').addEventListener('click', async () => {
  try {
    out.textContent = '';
    setStatus('reading tab…');

    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('no active tab');
      return;
    }

    const pageText = await extractPageText(tab.id);
    if (!pageText) {
      setStatus('no readable text found on page');
      out.textContent = 'Tip: select some text first, then click Ask.';
      return;
    }

    await summarizeWithNano(pageText, inp.value);
  } catch (e) {
    setStatus(`error: ${e.message}`);
  }
});

document.getElementById('stop').addEventListener('click', () => {
  if (currentController) currentController.abort();
});

document.getElementById('reset').addEventListener('click', async () => {
  if (session) {
    try { session.destroy(); } catch {}
    session = null;
  }
  out.textContent = '';
  setStatus('reset; will re-init on next Ask');
});

// Initial availability ping
(async () => {
  try {
    const avail = await LanguageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });
    setStatus(avail);
  } catch {
    setStatus('API not available in this context');
  }
})();
