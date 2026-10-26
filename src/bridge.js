// Isolated-world script: the page-world scripts have no chrome.* APIs, so this
// relays between them and the extension (base URL, stored settings, popup).
// Settings are passed through raw; the page side validates them. (Chrome
// injects each file only once per page, so settings.js must stay listed only in
// the page-world group, not here.)
(() => {
  document.documentElement.dataset.plexusBase = chrome.runtime.getURL('');

  let state = { active: false, engine: false, tracking: 'not started' };
  const post = (type, extra = {}) => window.postMessage({ __plexus: type, ...extra }, '*');

  async function pushSettings() {
    try {
      let settings = null;
      try {
        const syncRes = await chrome.storage.sync.get('settings');
        if (syncRes && syncRes.settings) settings = syncRes.settings;
      } catch (_) {}
      if (!settings) {
        try {
          const localRes = await chrome.storage.local.get('settings');
          if (localRes && localRes.settings) settings = localRes.settings;
        } catch (_) {}
      }
      post('settings', { settings: settings || {} });
    } catch (error) {
      post('settings', { settings: {} });
    }
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) post('settings', { settings: changes.settings.newValue || {} });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data.__plexus !== 'string') return;
    const msg = event.data;
    if (msg.__plexus === 'hello') pushSettings();
    if (msg.__plexus === 'save-settings' && msg.settings) {
      try { chrome.storage.sync.set({ settings: msg.settings }).catch(() => {}); } catch (_) {}
      try { chrome.storage.local.set({ settings: msg.settings }).catch(() => {}); } catch (_) {}
    }
    if (msg.__plexus === 'state') {
      state = { active: !!msg.active, engine: !!msg.engine, tracking: String(msg.tracking || '') };
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'plexus:toggle') {
      post('toggle');
      setTimeout(() => sendResponse(state), 100);
      return true;
    }
    if (msg?.type === 'plexus:settings') {
      if (msg.settings) post('settings', { settings: msg.settings });
      sendResponse({ ok: true, state });
      return true;
    }
    if (msg?.type === 'plexus:state') {
      sendResponse(state);
      return true;
    }
    return false;
  });

  pushSettings();
})();
