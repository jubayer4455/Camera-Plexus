// Hand tracking runs inside a hidden extension iframe (detector/detector.html):
// Meet's page enforces Trusted Types, which blocks MediaPipe's loader, while
// extension pages allow it. Frames go in as downscaled ImageBitmaps and hand
// landmarks come back.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});

  const isMobileDevice = typeof navigator !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.innerWidth <= 800 && 'ontouchstart' in window)
  );

  // Dynamic mobile resolution: 320px on mobile devices for ultra-fast inference & zero lag!
  const DETECT_WIDTH = isMobileDevice ? 320 : 440;
  const MIN_SUBMIT_INTERVAL_MS = isMobileDevice ? 40 : 25;
  const REPLY_TIMEOUT_MS = 1000;
  const LOAD_TIMEOUT_MS = 20000;

  FX.isMobile = isMobileDevice;

  // onStatus(kind, detail): kind is 'ready' or 'error'.
  function createTracker(baseUrl, onHands, onStatus = () => {}) {
    const origin = new URL(baseUrl).origin;
    let lastSubmitTime = 0;
    const iframe = document.createElement('iframe');
    iframe.src = new URL('detector/detector.html', baseUrl).href;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.cssText =
      'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none;';
    const root = document.documentElement || document.body;
    if (root) root.appendChild(iframe);

    const state = { ready: false, failed: null, inflightSince: null };
    const loadTimer = setTimeout(() => {
      if (!state.ready && !state.failed) {
        state.failed = 'hand tracker frame did not load';
        onStatus('error', state.failed);
      }
    }, LOAD_TIMEOUT_MS);

    function onMessage(event) {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return;
      const msg = event.data || {};
      if (msg.type === 'plexus:ready') {
        state.ready = true;
        clearTimeout(loadTimer);
        onStatus('ready', msg.delegate);
      }
      if (msg.type === 'plexus:error') {
        state.failed = msg.message;
        clearTimeout(loadTimer);
        onStatus('error', msg.message);
      }
      if (msg.type === 'plexus:hands') {
        state.inflightSince = null;
        onHands(msg.hands || [], performance.now(), msg.mask || null);
      }
      if (msg.type === 'plexus:segment-error') onStatus('segment-error', msg.message);
    }
    window.addEventListener('message', onMessage);

    // segment: also ask for a person mask (only needed for person lighting).
    async function submit(frame, segment = false) {
      const now = performance.now();
      if (now - lastSubmitTime < MIN_SUBMIT_INTERVAL_MS) return;
      const busy = state.inflightSince !== null && now - state.inflightSince < REPLY_TIMEOUT_MS;
      if (!iframe.isConnected) {
        const r = document.documentElement || document.body;
        if (r) r.appendChild(iframe);
      }
      if (!state.ready || busy || !iframe.contentWindow) return;
      state.inflightSince = now;
      lastSubmitTime = now;
      try {
        const w = frame.displayWidth || frame.codedWidth || 0;
        const h = frame.displayHeight || frame.codedHeight || 0;
        if (w <= 0 || h <= 0) {
          state.inflightSince = null;
          return;
        }
        const scale = Math.min(1, DETECT_WIDTH / w);
        const bitmap = await createImageBitmap(frame, {
          resizeWidth: Math.max(1, Math.round(w * scale)),
          resizeHeight: Math.max(1, Math.round(h * scale)),
          resizeQuality: 'low',
        });
        iframe.contentWindow.postMessage({ type: 'plexus:frame', bitmap, segment }, origin, [bitmap]);
      } catch (error) {
        state.inflightSince = null;
      }
    }

    function destroy() {
      clearTimeout(loadTimer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
    }

    return { submit, destroy, status: () => ({ ...state }) };
  }

  FX.createTracker = createTracker;
})();
