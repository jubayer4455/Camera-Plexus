// Floating On-Screen Quick Control Bar (HUD) for Google Meet, Messenger, OmeTV, etc.
// Allows users to toggle effects, switch presets, control Air Drawing & gestures
// directly on the video call without having to open the Chrome toolbar popup.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const getSettingsModule = () => globalThis.__plexusSettings;

  let container = null;

  function ensureStyles() {
    if (document.getElementById('plexus-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'plexus-hud-styles';
    style.textContent = `
      #plexus-floating-hud {
        position: fixed;
        right: 20px;
        bottom: 60px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        color: #f0f0f5;
        user-select: none;
        transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease;
      }
      #plexus-floating-hud * {
        box-sizing: border-box;
      }
      .plexus-hud-panel {
        background: rgba(18, 16, 28, 0.88);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(168, 120, 255, 0.35);
        border-radius: 16px;
        padding: 10px 14px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 120, 255, 0.2);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 260px;
      }
      .plexus-hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .plexus-hud-title {
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #e2d9ff;
      }
      .plexus-hud-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(168, 120, 255, 0.25);
        color: #d1b8ff;
      }
      .plexus-hud-min-btn {
        background: none;
        border: none;
        color: #a0a0b8;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 16px;
        line-height: 1;
        border-radius: 4px;
      }
      .plexus-hud-min-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }
      .plexus-hud-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .plexus-hud-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #eee;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        flex: 1;
      }
      .plexus-hud-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.25);
      }
      .plexus-hud-btn.active {
        background: linear-gradient(135deg, #8a5cff, #6236ff);
        border-color: #aa88ff;
        color: #fff;
        box-shadow: 0 0 12px rgba(138, 92, 255, 0.45);
      }
      .plexus-hud-select {
        background: rgba(30, 26, 46, 0.95);
        border: 1px solid rgba(168, 120, 255, 0.3);
        color: #fff;
        padding: 5px 8px;
        border-radius: 8px;
        font-size: 12px;
        outline: none;
        cursor: pointer;
        flex: 1;
      }
      .plexus-hud-pill {
        display: none;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8a5cff, #6236ff);
        border: 2px solid #ffffff;
        box-shadow: 0 4px 16px rgba(138, 92, 255, 0.6);
        cursor: pointer;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .plexus-hud-pill:hover {
        transform: scale(1.1);
      }
      #plexus-floating-hud.minimized .plexus-hud-panel {
        display: none;
      }
      #plexus-floating-hud.minimized .plexus-hud-pill {
        display: flex;
      }
    `;
    const target = document.head || document.documentElement || document.body;
    if (target) target.appendChild(style);
  }

  function saveSettings(patch) {
    const S = getSettingsModule();
    if (!FX.settings || !S) return;
    const next = S.sanitize({ ...FX.settings, ...patch });
    FX.settings = next;
    window.postMessage({ __plexus: 'save-settings', settings: next }, '*');
    window.postMessage({ __plexus: 'settings', settings: next }, '*');
  }

  function createHUD() {
    if (container || window.self !== window.top) return;
    if (!document.body) {
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', createHUD, { once: true });
      }
      return;
    }
    ensureStyles();

    container = document.createElement('div');
    container.id = 'plexus-floating-hud';
    container.innerHTML = `
      <div class="plexus-hud-panel">
        <div class="plexus-hud-header" id="plexus-hud-drag">
          <div class="plexus-hud-title">
            <span>✨ Camera Plexus</span>
            <span class="plexus-hud-badge" id="plexus-hud-status">Ready</span>
          </div>
          <button class="plexus-hud-min-btn" id="plexus-hud-close" title="Minimize">−</button>
        </div>

        <div class="plexus-hud-row">
          <button class="plexus-hud-btn" id="plexus-btn-power">
            <span>⚡ Power</span>
          </button>
          <select class="plexus-hud-select" id="plexus-select-preset" title="Choose Theme">
            <option value="Violet">Violet</option>
            <option value="Neon">Neon</option>
            <option value="Ice">Ice</option>
            <option value="Ember">Ember</option>
            <option value="DoctorStrange">Doctor Strange</option>
            <option value="Fire">Fire</option>
            <option value="Cyberpunk">Cyberpunk</option>
            <option value="Matrix">Matrix</option>
            <option value="Rainbow">Rainbow</option>
            <option value="Mono">Mono</option>
          </select>
        </div>

        <div class="plexus-hud-row">
          <button class="plexus-hud-btn" id="plexus-btn-gestures" title="Anime & Superhero FX: Chidori (Fist), Spider-Web (🤟), Super Saiyan (Spread), Lightsaber (Sword), Peace, Shield, Rasengan">
            <span>🦸 FX & Gestures</span>
          </button>
          <button class="plexus-hud-btn" id="plexus-btn-draw" title="Air Drawing (Point or Pinch to Draw)">
            <span>✏️ Air Draw</span>
          </button>
          <button class="plexus-hud-btn" id="plexus-btn-clear" title="Clear Air Canvas" style="flex: 0 0 auto; padding: 6px 8px;">
            <span>🗑️</span>
          </button>
        </div>

        <div class="plexus-hud-row">
          <button class="plexus-hud-btn" id="plexus-btn-audio" title="Audio Reactive Glow">
            <span>🔊 Audio Pulse</span>
          </button>
          <button class="plexus-hud-btn" id="plexus-btn-eco" title="Eco Mode for Low-End PCs">
            <span>🌱 Eco</span>
          </button>
        </div>
      </div>
      <div class="plexus-hud-pill" id="plexus-hud-expand" title="Open Camera Plexus Menu">✨</div>
    `;

    document.body.appendChild(container);

    // Draggable header and minimized pill
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function startDrag(e) {
      isDragging = true;
      const rect = container.getBoundingClientRect();
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    }

    const dragHandle = container.querySelector('#plexus-hud-drag');
    if (dragHandle) dragHandle.addEventListener('mousedown', startDrag);

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      container.style.left = `${Math.max(10, Math.min(window.innerWidth - 280, initialLeft + dx))}px`;
      container.style.top = `${Math.max(10, Math.min(window.innerHeight - 150, initialTop + dy))}px`;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // Minimize & Expand
    const minBtn = container.querySelector('#plexus-hud-close');
    const expandPill = container.querySelector('#plexus-hud-expand');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        container.classList.add('minimized');
      });
    }
    if (expandPill) {
      expandPill.addEventListener('click', () => {
        container.classList.remove('minimized');
      });
    }

    function pressEffect(el) {
      if (!el) return;
      el.style.transform = 'scale(0.92)';
      setTimeout(() => { el.style.transform = ''; }, 120);
    }

    // Button interactions
    const powerBtn = container.querySelector('#plexus-btn-power');
    if (powerBtn) {
      powerBtn.addEventListener('click', () => {
        pressEffect(powerBtn);
        FX.toggle?.();
        setTimeout(updateHUD, 40);
        setTimeout(updateHUD, 180);
      });
    }

    const presetSelect = container.querySelector('#plexus-select-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const preset = presetSelect.value;
        const S = getSettingsModule();
        if (FX.settings && S) {
          saveSettings(S.applyPreset(FX.settings, preset));
          FX.showStatus?.(`Theme: ${preset}`, 'ok');
          setTimeout(updateHUD, 40);
        }
      });
    }

    const gesturesBtn = container.querySelector('#plexus-btn-gestures');
    if (gesturesBtn) {
      gesturesBtn.addEventListener('click', () => {
        pressEffect(gesturesBtn);
        const cur = !!FX.settings?.gestures?.on;
        saveSettings({ gestures: { ...(FX.settings?.gestures || {}), on: !cur } });
        FX.showStatus?.(cur ? 'gestures OFF' : 'gestures ON (Peace, Thumbs Up, Heart, Shield, Ball)', 'info');
        updateHUD();
      });
    }

    const drawBtn = container.querySelector('#plexus-btn-draw');
    if (drawBtn) {
      drawBtn.addEventListener('click', () => {
        pressEffect(drawBtn);
        const cur = !!FX.settings?.airDraw?.on;
        saveSettings({ airDraw: { ...(FX.settings?.airDraw || {}), on: !cur } });
        FX.showStatus?.(cur ? 'air drawing OFF' : 'air drawing ON: point index finger to draw in air', 'ok');
        updateHUD();
      });
    }

    const clearBtn = container.querySelector('#plexus-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        pressEffect(clearBtn);
        if (FX.engine?.clearDrawings) FX.engine.clearDrawings();
        FX.showStatus?.('air canvas cleared', 'info');
      });
    }

    const audioBtn = container.querySelector('#plexus-btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        pressEffect(audioBtn);
        const cur = !!FX.settings?.audioPulse?.on;
        saveSettings({ audioPulse: { ...(FX.settings?.audioPulse || {}), on: !cur } });
        FX.showStatus?.(cur ? 'audio pulse OFF' : 'audio pulse ON', 'info');
        updateHUD();
      });
    }

    const ecoBtn = container.querySelector('#plexus-btn-eco');
    if (ecoBtn) {
      ecoBtn.addEventListener('click', () => {
        pressEffect(ecoBtn);
        const cur = !!FX.settings?.ecoMode;
        saveSettings({ ecoMode: !cur });
        FX.showStatus?.(cur ? 'eco mode OFF' : 'eco mode ON', 'info');
        updateHUD();
      });
    }

    updateHUD();
  }

  function updateHUD() {
    if (!container) return;
    const S = getSettingsModule();
    const cfg = FX.settings || (S ? S.DEFAULTS : {});
    const powerBtn = container.querySelector('#plexus-btn-power');
    const gesturesBtn = container.querySelector('#plexus-btn-gestures');
    const drawBtn = container.querySelector('#plexus-btn-draw');
    const audioBtn = container.querySelector('#plexus-btn-audio');
    const ecoBtn = container.querySelector('#plexus-btn-eco');
    const statusBadge = container.querySelector('#plexus-hud-status');
    const presetSelect = container.querySelector('#plexus-select-preset');

    if (!powerBtn) return;
    const active = FX.engine?.isActive ? FX.engine.isActive() : false;
    powerBtn.classList.toggle('active', active);
    const span = powerBtn.querySelector('span');
    if (span) span.textContent = active ? '⚡ ON' : '⚡ Off';

    if (statusBadge) {
      statusBadge.textContent = active ? 'Active' : 'Standby';
      statusBadge.style.background = active ? 'rgba(74, 222, 128, 0.25)' : 'rgba(168, 120, 255, 0.25)';
      statusBadge.style.color = active ? '#4ade80' : '#d1b8ff';
    }

    if (gesturesBtn) gesturesBtn.classList.toggle('active', !!cfg.gestures?.on);
    if (drawBtn) drawBtn.classList.toggle('active', !!cfg.airDraw?.on);
    if (audioBtn) audioBtn.classList.toggle('active', !!cfg.audioPulse?.on);
    if (ecoBtn) ecoBtn.classList.toggle('active', !!cfg.ecoMode);

    if (presetSelect && document.activeElement !== presetSelect) {
      if (cfg.rainbow?.on) {
        presetSelect.value = 'Rainbow';
      } else {
        const presets = S ? S.PRESETS : {};
        const match = Object.keys(presets || {}).find((name) => {
          return presets[name]?.glow === cfg.elements?.glow?.color;
        });
        if (match) presetSelect.value = match;
      }
    }
  }

  // Periodic HUD state check
  setInterval(updateHUD, 400);

  // Initialize HUD once DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' || !document.body) {
      window.addEventListener('DOMContentLoaded', createHUD, { once: true });
    } else {
      createHUD();
    }
  }

  FX.updateHUD = updateHUD;
})();
