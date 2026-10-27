// Isolated-world script: the page-world scripts have no chrome.* APIs, so this
// relays between them and the extension (base URL, stored settings, popup).
// Settings are passed through raw; the page side validates them. (Chrome
// injects each file only once per page, so settings.js must stay listed only in
// the page-world group, not here.)
(() => {
  const baseUrl = chrome.runtime.getURL('');
  if (document.documentElement) {
    document.documentElement.dataset.plexusBase = baseUrl;
  }

  const SCHEMA_VERSION = 3;
  let state = { active: true, engine: false, tracking: 'ready' };
  const post = (type, extra = {}) => window.postMessage({ __plexus: type, baseUrl, ...extra }, '*');

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
      // Discard stale pre-v3 stored settings where FX or Mesh lines were turned off during earlier testing
      if (settings && settings.schemaVersion !== SCHEMA_VERSION) {
        settings = null;
        try { chrome.storage.sync.remove('settings').catch(() => {}); } catch (_) {}
        try { chrome.storage.local.remove('settings').catch(() => {}); } catch (_) {}
      }
      if (settings) {
        if (typeof settings.enabled === 'boolean') state.active = settings.enabled;
        post('settings', { settings });
      } else {
        post('reset-defaults', { baseUrl });
      }
    } catch (error) {
      post('base', { baseUrl });
    }
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings && changes.settings.newValue) {
      const next = changes.settings.newValue;
      if (typeof next.enabled === 'boolean') state.active = next.enabled;
      post('settings', { settings: next });
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data.__plexus !== 'string') return;
    const msg = event.data;
    if (msg.__plexus === 'hello') pushSettings();
    if (msg.__plexus === 'save-settings' && msg.settings) {
      if (typeof msg.settings.enabled === 'boolean') state.active = msg.settings.enabled;
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
      setTimeout(() => sendResponse(state), 80);
      return true;
    }
    if (msg?.type === 'plexus:set-active') {
      state.active = Boolean(msg.active);
      post('set-active', { active: state.active });
      setTimeout(() => sendResponse(state), 80);
      return true;
    }
    if (msg?.type === 'plexus:settings') {
      if (msg.settings) {
        if (typeof msg.settings.enabled === 'boolean') state.active = msg.settings.enabled;
        post('settings', { settings: msg.settings });
      }
      sendResponse({ ok: true, state });
      return true;
    }
    if (msg?.type === 'plexus:clear-drawings') {
      post('clear-drawings');
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === 'plexus:reset-game') {
      post('reset-game');
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === 'plexus:get-game-stats') {
      const handler = (event) => {
        if (event.data?.__plexus === 'game-stats-reply') {
          window.removeEventListener('message', handler);
          sendResponse({ stats: event.data.stats });
        }
      };
      window.addEventListener('message', handler);
      post('get-game-stats');
      setTimeout(() => {
        window.removeEventListener('message', handler);
        sendResponse({ stats: { score: 0, combo: 1, hits: 0 } });
      }, 150);
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
