// Intercepts Meet's camera/mic requests, hands back the processed stream, and
// talks to the isolated-world bridge (settings in, on/off state out).
// Alt+Shift+P toggles the effect by keyboard as a fallback to clapping.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const S = globalThis.__plexusSettings;
  if (FX.hooked || !navigator.mediaDevices) return;

  // Every page-world module must have loaded; if one failed, say so instead of
  // silently leaving the camera unhooked.
  const REQUIRED = ['showStatus', 'createClapDetector', 'createParticles', 'createPlexusRenderer',
    'createLighting', 'createTracker', 'listenForTransients', 'getEngine', 'wrapStream'];
  const missing = [...(S ? [] : ['settings']), ...REQUIRED.filter((name) => typeof FX[name] !== 'function')];
  if (missing.length) {
    const report = () => FX.showStatus?.(`failed to load (${missing.join(', ')}); reload the extension`, 'error', true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report, { once: true });
    else report();
    return;
  }
  FX.hooked = true;
  FX.settings = S.sanitize({});
  FX.active = FX.settings.enabled !== false;

  const post = (type, extra = {}) => window.postMessage({ __plexus: type, ...extra }, '*');
  FX.notifyState = (state) => post('state', state);

  const original = MediaDevices.prototype.getUserMedia;

  // Meet often opens the mic before the camera: remember it either way so
  // clap sounds can be heard once the camera (and the engine) start.
  function rememberMic(stream) {
    const mic = stream.getAudioTracks()[0];
    if (!mic) return;
    FX.audioSource = mic;
    if (FX.engine) FX.engine.attachAudio(mic);
  }

  MediaDevices.prototype.getUserMedia = async function getUserMedia(constraints) {
    const stream = await original.call(this, constraints);
    try {
      const hasVideo = stream.getVideoTracks().length > 0;
      if (hasVideo && !FX.isSupported()) {
        FX.showStatus('this Chrome lacks insertable streams; effect unavailable', 'error', true);
        return stream;
      }
      if (hasVideo) return FX.wrapStream(stream);
      rememberMic(stream);
      return stream;
    } catch (error) {
      FX.showStatus(`could not process camera: ${error.message}`, 'error', true);
      return stream;
    }
  };

  // Legacy getUserMedia fallback for older WebRTC sites or wrappers (e.g. OmeTV / Chatroulette / custom clients)
  const wrapLegacy = (fn) => function (constraints, success, error) {
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => { if (typeof success === 'function') success(stream); })
      .catch((err) => { if (typeof error === 'function') error(err); });
  };
  if (navigator.getUserMedia) navigator.getUserMedia = wrapLegacy(navigator.getUserMedia);
  if (navigator.webkitGetUserMedia) navigator.webkitGetUserMedia = wrapLegacy(navigator.webkitGetUserMedia);
  if (navigator.mozGetUserMedia) navigator.mozGetUserMedia = wrapLegacy(navigator.mozGetUserMedia);

  function setMasterActive(on) {
    const next = Boolean(on);
    FX.active = next;
    const patch = { enabled: next };
    // If turning Master Power ON while both Mesh and Game/Draw are off, restore Mesh & FX so effects are visible
    if (next && FX.settings?.elements?.lines?.on === false && !FX.settings?.targetGame?.on && !FX.settings?.airDraw?.on) {
      const els = FX.settings?.elements || {};
      const nextElements = {};
      ['lines', 'glow', 'triangles', 'nodes', 'shards', 'dust'].forEach((k) => {
        nextElements[k] = { ...(els[k] || {}), on: true };
      });
      patch.elements = nextElements;
      patch.gestures = { ...(FX.settings?.gestures || {}), on: true };
    }
    FX.settings = S.sanitize({ ...FX.settings, ...patch });
    post('save-settings', { settings: FX.settings });
    if (FX.engine) {
      if (FX.engine.isActive() !== next) {
        FX.engine.setActive(next);
      } else {
        FX.notifyState({ active: next, engine: true, tracking: 'ready' });
      }
    } else {
      FX.notifyState({ active: next, engine: false, tracking: 'waiting for camera' });
      FX.showStatus(next ? 'effect ON (ready for camera)' : 'effect OFF', next ? 'on' : 'info');
    }
    FX.updateHUD?.();
    return next;
  }

  function toggleOrExplain() {
    const cur = FX.engine ? FX.engine.isActive() : (FX.settings?.enabled !== false);
    return setMasterActive(!cur);
  }
  FX.toggle = toggleOrExplain;
  FX.setActive = setMasterActive;

  // Automatically wrap any already-playing local camera <video> elements on the page
  function scanExistingVideos() {
    if (!FX.isSupported?.()) return;
    const base = document.documentElement?.dataset?.plexusBase || FX.baseUrl;
    if (!base) return;
    try {
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        const stream = v.srcObject;
        if (stream && typeof stream.getVideoTracks === 'function' && !stream.__plexusWrapped) {
          const tracks = stream.getVideoTracks();
          if (tracks.length > 0 && tracks[0].readyState === 'live' && !tracks[0].__plexusWrapped) {
            const wasPaused = v.paused;
            v.srcObject = FX.wrapStream(stream);
            if (!wasPaused) v.play().catch(() => {});
          }
        }
      });
    } catch (_) {}
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (!(event.altKey && event.shiftKey && event.code === 'KeyP')) return;
      event.preventDefault();
      toggleOrExplain();
    },
    true,
  );

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data.__plexus !== 'string') return;
    const msg = event.data;
    if (msg.baseUrl) {
      FX.baseUrl = msg.baseUrl;
      if (document.documentElement && !document.documentElement.dataset.plexusBase) {
        document.documentElement.dataset.plexusBase = msg.baseUrl;
      }
      scanExistingVideos();
    }
    if (msg.__plexus === 'reset-defaults') {
      FX.settings = S.sanitize({});
      FX.active = true;
      post('save-settings', { settings: FX.settings });
      if (FX.engine && !FX.engine.isActive()) FX.engine.setActive(true);
      FX.updateHUD?.();
    }
    if (msg.__plexus === 'settings' && msg.settings) {
      const prevSound = FX.settings.clapSound;
      FX.settings = S.sanitize(msg.settings);
      const nextActive = FX.settings.enabled !== false;
      FX.active = nextActive;
      if (FX.engine) {
        if (FX.engine.isActive() !== nextActive) FX.engine.setActive(nextActive);
        if (prevSound !== FX.settings.clapSound) FX.engine.refreshAudio();
      } else {
        FX.notifyState({ active: nextActive, engine: false, tracking: 'waiting for camera' });
      }
      FX.updateHUD?.();
    }
    if (msg.__plexus === 'set-active') {
      setMasterActive(Boolean(msg.active));
    }
    if (msg.__plexus === 'toggle') toggleOrExplain();
  });
  post('hello');
  setTimeout(scanExistingVideos, 500);
  setTimeout(scanExistingVideos, 2000);
  setInterval(scanExistingVideos, 1500);

  if (window.self === window.top) {
    const announce = () => FX.showStatus('loaded · waiting for your camera', 'info', true);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', announce, { once: true });
    } else {
      announce();
    }
  }
})();
