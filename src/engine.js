// One shared engine per page: tracker + clap detection + renderer + lighting +
// on/off state. Meet can open the camera more than once (preview, call), and
// every processed track draws from this same state.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const S = globalThis.__plexusSettings;

  const DETECT_INTERVAL_MS = 20; // ~50 tracking updates per second for instantaneous responsiveness and zero lag

  const currentSettings = () => FX.settings || S.DEFAULTS;

  function createEngine(baseUrl) {
    const renderer = FX.createPlexusRenderer();
    const lighting = FX.createLighting();
    const clap = FX.createClapDetector();
    const doubleClap = FX.createDoubleClap();
    const initialActive = FX.active !== undefined ? Boolean(FX.active) : (currentSettings().enabled !== false);
    const stats = { active: initialActive, hands: 0, claps: 0, toggles: 0, lastResultAt: 0, tracking: 'loading' };
    renderer.setActive(initialActive);
    let aspect = 16 / 9;
    let lastSubmit = -Infinity;
    let stopAudio = null;
    let audioSource = null;

    let lastKnownEnabled = FX.settings ? FX.settings.enabled : undefined;
    const publish = () => FX.notifyState?.({ active: stats.active, engine: true, tracking: stats.tracking });

    function setActive(on) {
      const next = Boolean(on);
      stats.active = next;
      FX.active = next;
      lastKnownEnabled = next;
      if (FX.settings) FX.settings.enabled = next;
      stats.toggles += 1;
      renderer.setActive(next);
      FX.playSound?.(next ? 'on' : 'off');
      const hint = next && stats.hands === 0 ? ' (show hands to camera)' : '';
      FX.showStatus(next ? `effect ON${hint}` : 'effect OFF', next ? 'on' : 'info');
      publish();
      FX.updateHUD?.();
      try {
        window.postMessage({ __plexus: 'save-settings', settings: FX.settings }, '*');
      } catch (_) {}
    }

    const toggle = () => setActive(!stats.active);

    function onClap(now, source) {
      stats.claps += 1;
      const result = doubleClap.register(now);
      if (result === 'double') toggle();
      if (result === 'first') {
        FX.showStatus(`clap (${source}) · clap again to turn ${stats.active ? 'off' : 'on'}`, 'info');
      }
    }

    function onHands(hands, now, mask) {
      stats.hands = hands.length;
      stats.lastResultAt = now;
      renderer.setHands(hands, now);
      if (mask) lighting.setMask(mask, now);
      const cfg = currentSettings();
      if (cfg.clapSound && !cfg.targetGame?.on && clap.update(hands, now, aspect)) {
        onClap(now, 'camera');
      }
    }

    function onTrackerStatus(kind, detail) {
      if (kind === 'ready') {
        stats.tracking = 'ready';
        FX.showStatus(`hand tracking ready (${detail || 'GPU'}) · double-clap or Alt+Shift+P`, 'ok');
      } else if (kind === 'segment-error') {
        FX.showStatus(`person lighting unavailable: ${detail}`, 'error');
      } else {
        stats.tracking = 'failed';
        FX.showStatus(`hand tracking failed: ${detail}`, 'error', true);
      }
      publish();
    }

    FX.showStatus('camera captured · loading hand tracking…', 'info', true);
    const tracker = FX.createTracker(baseUrl, onHands, onTrackerStatus);

    function onFrame(frame, now) {
      aspect = frame.displayWidth / frame.displayHeight;
      const cfg = currentSettings();
      const interval = cfg.ecoMode ? 40 : DETECT_INTERVAL_MS;
      if (now - lastSubmit < interval) return Promise.resolve();
      lastSubmit = now;
      const wantMask = cfg.personLight.on && !cfg.ecoMode && (stats.active || renderer.level() > 0);
      return tracker.submit(frame, wantMask, cfg.ecoMode);
    }

    // Re-evaluate the mic listener (source changed or the setting flipped).
    function refreshAudio() {
      if (stopAudio) stopAudio();
      stopAudio = null;
      const usable = audioSource && audioSource.readyState !== 'ended' && currentSettings().clapSound;
      if (!usable) return;
      try {
        stopAudio = FX.listenForTransients(audioSource.clone(), (now) => {
          if (clap.confirmAudio(now)) onClap(now, 'sound');
        });
      } catch (error) {
        stopAudio = null;
      }
    }

    function attachAudio(track) {
      audioSource = track;
      refreshAudio();
    }

    function tick(now, w, h) {
      const cfg = currentSettings();
      if (typeof cfg.enabled === 'boolean' && cfg.enabled !== lastKnownEnabled) {
        lastKnownEnabled = cfg.enabled;
        if (cfg.enabled !== stats.active) {
          stats.active = cfg.enabled;
          FX.active = cfg.enabled;
          renderer.setActive(cfg.enabled);
        }
      }
      renderer.update(now, cfg, w, h);
    }

    function paint(ctx, w, h, now) {
      if (!stats.active) return;
      lighting.apply(ctx, w, h, renderer.level(), renderer.lightSources(), currentSettings(), now);
      renderer.draw(ctx, w, h, now);
    }

    publish();
    return {
      onFrame,
      tick,
      paint,
      isIdle: () => !stats.active || renderer.isIdle(),
      toggle,
      setActive,
      isActive: () => stats.active,
      clearDrawings: () => renderer.clearDrawings?.(),
      resetGame: () => renderer.resetGame?.(),
      getGameStats: () => renderer.getGameStats?.(),
      attachAudio,
      refreshAudio,
      stats: () => ({ ...stats, tracker: tracker.status() }),
    };
  }

  FX.getEngine = () => {
    if (!FX.engine) {
      const base = document.documentElement?.dataset?.plexusBase || FX.baseUrl;
      if (!base) throw new Error('Meet Plexus: extension base URL missing');
      FX.engine = createEngine(base);
      if (FX.audioSource) FX.engine.attachAudio(FX.audioSource);
    }
    return FX.engine;
  };
})();
