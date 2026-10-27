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

  // Dynamic resolution: 360px on desktop (300px on mobile) for near-instant inference & zero lag!
  const DETECT_WIDTH = isMobileDevice ? 300 : 360;
  const MIN_SUBMIT_INTERVAL_MS = isMobileDevice ? 32 : 18;
  const REPLY_TIMEOUT_MS = 1000;
  const LOAD_TIMEOUT_MS = 20000;

  FX.isMobile = isMobileDevice;

  // onStatus(kind, detail): kind is 'ready' or 'error'.
  function createTracker(baseUrl, onHands, onStatus = () => {}) {
    const origin = new URL(baseUrl).origin;
    let lastSubmitTime = 0;
    let offCanvas = null;
    let offCtx = null;
    const iframe = document.createElement('iframe');
    iframe.src = new URL('detector/detector.html', baseUrl).href;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.cssText =
      'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none;';
    const root = document.documentElement || document.body;
    if (root) root.appendChild(iframe);

    const state = { ready: false, failed: null, inflightSince: null };
    let timeoutCount = 0;
    let reloadAttemptAt = 0;
    let loadTimer = setTimeout(() => {
      if (!state.ready && !state.failed) {
        state.failed = 'hand tracker frame did not load';
        onStatus('error', state.failed);
      }
    }, LOAD_TIMEOUT_MS);

    function reloadDetectorFrame() {
      const now = performance.now();
      if (now - reloadAttemptAt < 3000) return;
      reloadAttemptAt = now;
      timeoutCount = 0;
      state.ready = false;
      state.failed = null;
      state.inflightSince = null;
      clearTimeout(loadTimer);
      try {
        const u = new URL('detector/detector.html', baseUrl);
        u.searchParams.set('t', String(Date.now()));
        iframe.src = u.href;
      } catch (_) {}
      loadTimer = setTimeout(() => {
        if (!state.ready && !state.failed) {
          state.failed = 'hand tracker frame did not load';
          onStatus('error', state.failed);
        }
      }, LOAD_TIMEOUT_MS);
    }

    function onMessage(event) {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return;
      const msg = event.data || {};
      if (msg.type === 'plexus:ready') {
        state.ready = true;
        state.failed = null;
        timeoutCount = 0;
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
        timeoutCount = 0;
        onHands(msg.hands || [], performance.now(), msg.mask || null);
      }
      if (msg.type === 'plexus:segment-error') onStatus('segment-error', msg.message);
    }
    window.addEventListener('message', onMessage);

    // segment: also ask for a person mask (only needed for person lighting).
    async function submit(frame, segment = false, ecoMode = false) {
      const now = performance.now();
      const minInterval = ecoMode ? 32 : (isMobileDevice ? 28 : 16);
      if (now - lastSubmitTime < minInterval) return;
      if (state.inflightSince !== null && now - state.inflightSince >= REPLY_TIMEOUT_MS) {
        state.inflightSince = null;
        timeoutCount += 1;
        if (timeoutCount >= 2) {
          reloadDetectorFrame();
          return;
        }
      }
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
        const detectWidth = ecoMode ? (isMobileDevice ? 180 : 220) : (isMobileDevice ? 240 : 256);
        const scale = Math.min(1, detectWidth / w);
        const dw = Math.max(1, Math.round(w * scale));
        const dh = Math.max(1, Math.round(h * scale));
        let bitmap = null;
        if (typeof OffscreenCanvas !== 'undefined') {
          if (!offCanvas || offCanvas.width !== dw || offCanvas.height !== dh) {
            offCanvas = new OffscreenCanvas(dw, dh);
            offCtx = offCanvas.getContext('2d', { alpha: false, desynchronized: true }) || offCanvas.getContext('2d');
          }
          if (offCtx && typeof offCanvas.transferToImageBitmap === 'function') {
            offCtx.drawImage(frame, 0, 0, dw, dh);
            bitmap = offCanvas.transferToImageBitmap();
          }
        }
        if (!bitmap) {
          bitmap = await createImageBitmap(frame, {
            resizeWidth: dw,
            resizeHeight: dh,
            resizeQuality: 'low',
          });
        }
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
