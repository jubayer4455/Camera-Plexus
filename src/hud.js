// Floating On-Screen Quick Control Bar (HUD) for Google Meet, Messenger, OmeTV, etc.
// Allows users to toggle individual effects, play finger gun game, control Air Canvas,
// switch presets, and isolate game mode directly without opening toolbar popup.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const getSettingsModule = () => globalThis.__plexusSettings;

  let container = null;
  let activeTab = 'fx';

  function ensureStyles() {
    if (document.getElementById('plexus-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'plexus-hud-styles';
    style.textContent = `
      #plexus-floating-hud {
        position: fixed;
        right: 20px;
        bottom: 50px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        color: #f0f0f5;
        user-select: none;
        transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease;
      }
      #plexus-floating-hud * {
        box-sizing: border-box;
      }
      .plexus-hud-panel {
        background: rgba(16, 14, 26, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(168, 120, 255, 0.35);
        border-radius: 16px;
        padding: 10px 12px;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 120, 255, 0.2);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 290px;
        max-width: 320px;
      }
      .plexus-hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .plexus-hud-header:active {
        cursor: grabbing;
      }
      .plexus-hud-title {
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #e2d9ff;
      }
      .plexus-hud-badge {
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(168, 120, 255, 0.25);
        color: #d1b8ff;
        font-weight: 600;
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

      /* Navigation Tabs */
      .plexus-hud-tabs {
        display: flex;
        gap: 4px;
        background: rgba(0, 0, 0, 0.4);
        padding: 3px;
        border-radius: 10px;
      }
      .plexus-hud-tab {
        flex: 1;
        background: none;
        border: none;
        color: #a29dbd;
        font-size: 11px;
        font-weight: 600;
        padding: 6px 3px;
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
      }
      .plexus-hud-tab:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.08);
      }
      .plexus-hud-tab.active {
        color: #fff;
        background: linear-gradient(135deg, #8a5cff, #6236ff);
        box-shadow: 0 2px 8px rgba(138, 92, 255, 0.45);
      }

      /* Tab Content Sections */
      .plexus-tab-content {
        display: none;
        flex-direction: column;
        gap: 7px;
      }
      .plexus-tab-content.active {
        display: flex;
      }

      .plexus-hud-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .plexus-hud-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
      }

      .plexus-hud-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #eee;
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .plexus-hud-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.25);
      }
      .plexus-hud-btn.active {
        background: linear-gradient(135deg, #8a5cff, #6236ff);
        border-color: #aa88ff;
        color: #fff;
        box-shadow: 0 0 10px rgba(138, 92, 255, 0.4);
      }

      .plexus-hud-banner-btn {
        background: rgba(255, 255, 255, 0.09);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #eee;
        padding: 7px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
        width: 100%;
      }
      .plexus-hud-banner-btn.active {
        background: linear-gradient(135deg, #00f0ff, #0077ff);
        border-color: #33ccff;
        color: #fff;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.45);
      }
      .plexus-game-play-btn.active {
        background: linear-gradient(135deg, #ff007f, #aa00ff) !important;
        border-color: #ff33aa !important;
        box-shadow: 0 0 14px rgba(255, 0, 127, 0.5) !important;
      }

      /* Game Scoreboard Card */
      .plexus-game-card {
        display: flex;
        justify-content: space-around;
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 9px;
        padding: 5px 4px;
      }
      .plexus-game-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .plexus-game-stat .label {
        font-size: 9px;
        font-weight: 600;
        color: #928ca8;
        letter-spacing: 0.5px;
      }
      .plexus-game-stat .value {
        font-size: 13px;
        font-weight: 700;
        color: #00ffff;
        font-family: monospace;
      }

      /* Tip & Footer */
      .plexus-hud-tip {
        font-size: 11px;
        color: #b7aee2;
        background: rgba(168, 120, 255, 0.12);
        border-left: 3px solid #a878ff;
        padding: 5px 8px;
        border-radius: 4px;
        line-height: 1.3;
      }
      .plexus-hud-footer {
        font-size: 10px;
        color: #8c85ae;
        text-align: center;
        padding-top: 3px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .plexus-hud-select {
        background: rgba(30, 26, 46, 0.95);
        border: 1px solid rgba(168, 120, 255, 0.3);
        color: #fff;
        padding: 5px 8px;
        border-radius: 8px;
        font-size: 11px;
        outline: none;
        cursor: pointer;
        flex: 1;
      }

      /* Swatches */
      .plexus-color-swatches {
        display: flex;
        gap: 6px;
        justify-content: center;
        align-items: center;
      }
      .plexus-swatch {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.2);
        cursor: pointer;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .plexus-swatch:hover, .plexus-swatch.active {
        transform: scale(1.18);
        border-color: #fff;
        box-shadow: 0 0 8px currentColor;
      }

      /* Minimized Pill */
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

        <div class="plexus-hud-tabs">
          <button class="plexus-hud-tab active" data-tab="fx">🦸 FX</button>
          <button class="plexus-hud-tab" data-tab="game">🎯 Game</button>
          <button class="plexus-hud-tab" data-tab="draw">✏️ Draw</button>
          <button class="plexus-hud-tab" data-tab="setup">⚙️ Setup</button>
        </div>

        <!-- 1. Anime & Superhero FX Tab -->
        <div class="plexus-tab-content active" id="plexus-tab-fx">
          <button class="plexus-hud-banner-btn" id="plexus-toggle-master-fx" title="Master toggle for all hand gestures and anime effects">
            <span>⚡ FX & Gestures: ON</span>
          </button>
          <div class="plexus-hud-grid">
            <button class="plexus-hud-btn" id="plexus-fx-chidori" title="Naruto Chidori: Form a closed fist to unleash crackling blue lightning">
              <span>⚡ Chidori</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-spider" title="Spider-Man Web: 🤟 Sign shoots neon webs stuck to screen glass">
              <span>🕸️ Web Shoot</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-saiyan" title="Super Saiyan Aura: Spread both hands wide to erupt golden flames">
              <span>🔥 Super Saiyan</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-sword" title="Laser Lightsaber: Keep two fingers together like a sword blade">
              <span>⚔️ Lightsaber</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-shield" title="Doctor Strange Shield: Open palm summons glowing mandala shield">
              <span>🛡️ Shield</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-ball" title="Energy Ball: Bring two palms facing each other to create plasma orb">
              <span>🔮 Energy Ball</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-party" title="Party FX: ✌️ Peace confetti, 👍 Thumbs fireworks, ❤️ Heart floaters">
              <span>🎉 Party FX</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-gun" title="Standalone Finger Gun: 👉 Pistol gesture shoots laser bullets">
              <span>🔫 Gun Shot</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-fx-mesh" title="Plexus Geometry: Hand tracking glowing lines & dots network">
              <span>🕸️ Mesh Net</span>
            </button>
          </div>
        </div>

        <!-- 2. Target Shooting Game Tab -->
        <div class="plexus-tab-content" id="plexus-tab-game">
          <button class="plexus-hud-banner-btn plexus-game-play-btn" id="plexus-game-toggle" title="Start/Stop interactive cyber balloon shooting mini-game">
            <span>🎯 Target Game: OFF</span>
          </button>
          <div class="plexus-game-card">
            <div class="plexus-game-stat">
              <span class="label">SCORE</span>
              <span class="value" id="plexus-game-score">0</span>
            </div>
            <div class="plexus-game-stat">
              <span class="label">COMBO</span>
              <span class="value" id="plexus-game-combo">1x</span>
            </div>
            <div class="plexus-game-stat">
              <span class="label">POPPED</span>
              <span class="value" id="plexus-game-hits">0</span>
            </div>
          </div>
          <div class="plexus-hud-row">
            <button class="plexus-hud-btn active" id="plexus-game-focus" title="Game Focus Mode: Automatically mutes conflicting anime FX so your game stays crystal clear">
              <span>🔒 Focus Mode</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-game-speed" title="Balloon spawn and float speed">
              <span>⚡ Speed: Norm</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-game-reset" title="Reset score and balloons">
              <span>🔄 Reset</span>
            </button>
          </div>
          <div class="plexus-hud-tip">
            👉 Form a pistol with thumb & index. Aim at balloons and flick thumb down to fire!
          </div>
        </div>

        <!-- 3. Air Draw Tab -->
        <div class="plexus-tab-content" id="plexus-tab-draw">
          <button class="plexus-hud-banner-btn" id="plexus-draw-toggle" title="Draw glowing trails in the air with your fingertip">
            <span>✏️ Air Draw: OFF</span>
          </button>
          <div class="plexus-color-swatches" id="plexus-draw-colors">
            <div class="plexus-swatch active" data-color="#00ffff" style="background: #00ffff;" title="Cyan"></div>
            <div class="plexus-swatch" data-color="#ff007f" style="background: #ff007f;" title="Neon Pink"></div>
            <div class="plexus-swatch" data-color="#ffff00" style="background: #ffff00;" title="Gold Yellow"></div>
            <div class="plexus-swatch" data-color="#00ff66" style="background: #00ff66;" title="Lime Green"></div>
            <div class="plexus-swatch" data-color="#ffffff" style="background: #ffffff;" title="White"></div>
          </div>
          <div class="plexus-hud-row">
            <button class="plexus-hud-btn" id="plexus-draw-size-s" title="Thin brush">Small</button>
            <button class="plexus-hud-btn active" id="plexus-draw-size-m" title="Medium brush">Medium</button>
            <button class="plexus-hud-btn" id="plexus-draw-size-l" title="Thick brush">Large</button>
            <button class="plexus-hud-btn" id="plexus-draw-clear" title="Clear canvas">🗑️ Clear</button>
          </div>
        </div>

        <!-- 4. Setup & System Tab -->
        <div class="plexus-tab-content" id="plexus-tab-setup">
          <div class="plexus-hud-row">
            <button class="plexus-hud-btn" id="plexus-btn-power">
              <span>⚡ Power: ON</span>
            </button>
            <select class="plexus-hud-select" id="plexus-select-preset" title="Choose Theme Preset">
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
            <button class="plexus-hud-btn" id="plexus-btn-audio" title="Glow pulses with your voice">
              <span>🔊 Audio</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-btn-eco" title="Low CPU/GPU mode for mobile & low-end PCs">
              <span>🌱 Eco</span>
            </button>
            <button class="plexus-hud-btn" id="plexus-btn-clap" title="Double clap turns effect on/off">
              <span>👏 Clap</span>
            </button>
          </div>
        </div>

        <div class="plexus-hud-footer" id="plexus-hud-footer">Ready</div>
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

    function startDrag(clientX, clientY) {
      isDragging = true;
      const rect = container.getBoundingClientRect();
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;
      dragStartX = clientX;
      dragStartY = clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
    }

    function onMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;
      const maxL = Math.max(10, window.innerWidth - 300);
      const maxT = Math.max(10, window.innerHeight - 180);
      container.style.left = `${Math.max(10, Math.min(maxL, initialLeft + dx))}px`;
      container.style.top = `${Math.max(10, Math.min(maxT, initialTop + dy))}px`;
    }

    const dragHandle = container.querySelector('#plexus-hud-drag');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', (e) => {
        startDrag(e.clientX, e.clientY);
        e.preventDefault();
      });
      dragHandle.addEventListener('touchstart', (e) => {
        if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
    }

    window.addEventListener('mousemove', (e) => { onMove(e.clientX, e.clientY); });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('touchend', () => { isDragging = false; });

    // Minimize & Expand
    const minBtn = container.querySelector('#plexus-hud-close');
    const expandPill = container.querySelector('#plexus-hud-expand');
    if (minBtn) minBtn.addEventListener('click', () => container.classList.add('minimized'));
    if (expandPill) expandPill.addEventListener('click', () => container.classList.remove('minimized'));

    function pressEffect(el) {
      if (!el) return;
      el.style.transform = 'scale(0.92)';
      setTimeout(() => { el.style.transform = ''; }, 120);
    }

    // Tabs switching
    const tabs = container.querySelectorAll('.plexus-hud-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        pressEffect(tab);
        activeTab = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === activeTab));
        container.querySelectorAll('.plexus-tab-content').forEach((c) => {
          c.classList.toggle('active', c.id === `plexus-tab-${activeTab}`);
        });
      });
    });

    // 1. Tab FX controls
    const masterFxBtn = container.querySelector('#plexus-toggle-master-fx');
    if (masterFxBtn) {
      masterFxBtn.addEventListener('click', () => {
        pressEffect(masterFxBtn);
        const cur = !!FX.settings?.gestures?.on;
        saveSettings({ gestures: { ...(FX.settings?.gestures || {}), on: !cur } });
        FX.showStatus?.(cur ? 'FX & Gestures OFF' : 'FX & Gestures ON', 'ok');
        updateHUD();
      });
    }

    function bindFxToggle(id, key, label) {
      const btn = container.querySelector(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        pressEffect(btn);
        const g = FX.settings?.gestures || {};
        const cur = g[key] !== false;
        const patch = { [key]: !cur };
        if (key === 'party') {
          patch.peace = !cur;
          patch.thumbsUp = !cur;
          patch.heart = !cur;
        }
        saveSettings({ gestures: { ...g, ...patch } });
        FX.showStatus?.(`${label}: ${!cur ? 'ON' : 'OFF'}`, 'info');
        updateHUD();
      });
    }

    bindFxToggle('#plexus-fx-chidori', 'chidori', 'Chidori (Naruto Fist)');
    bindFxToggle('#plexus-fx-spider', 'spiderWeb', 'Spider-Man Web');
    bindFxToggle('#plexus-fx-saiyan', 'superSaiyan', 'Super Saiyan Aura');
    bindFxToggle('#plexus-fx-sword', 'laserSword', 'Laser Lightsaber');
    bindFxToggle('#plexus-fx-shield', 'mysticShield', 'Mystic Shield');
    bindFxToggle('#plexus-fx-ball', 'energyBall', 'Energy Ball');
    bindFxToggle('#plexus-fx-party', 'party', 'Party Gestures');
    bindFxToggle('#plexus-fx-gun', 'fingerGun', 'Finger Gun FX');

    const meshBtn = container.querySelector('#plexus-fx-mesh');
    if (meshBtn) {
      meshBtn.addEventListener('click', () => {
        pressEffect(meshBtn);
        const els = FX.settings?.elements || {};
        const cur = !!els.lines?.on;
        saveSettings({
          elements: {
            ...els,
            lines: { ...els.lines, on: !cur },
            nodes: { ...els.nodes, on: !cur },
          },
        });
        FX.showStatus?.(`Plexus Mesh: ${!cur ? 'ON' : 'OFF'}`, 'info');
        updateHUD();
      });
    }

    // 2. Tab Game controls
    const gameToggleBtn = container.querySelector('#plexus-game-toggle');
    if (gameToggleBtn) {
      gameToggleBtn.addEventListener('click', () => {
        pressEffect(gameToggleBtn);
        const cur = !!FX.settings?.targetGame?.on;
        saveSettings({ targetGame: { ...(FX.settings?.targetGame || {}), on: !cur } });
        FX.showStatus?.(cur ? 'Target Game OFF' : '🎯 Target Game ON: Use 👉 finger gun to pop balloons!', 'ok');
        updateHUD();
      });
    }

    const gameFocusBtn = container.querySelector('#plexus-game-focus');
    if (gameFocusBtn) {
      gameFocusBtn.addEventListener('click', () => {
        pressEffect(gameFocusBtn);
        const cur = FX.settings?.targetGame?.focusMode !== false;
        saveSettings({ targetGame: { ...(FX.settings?.targetGame || {}), focusMode: !cur } });
        FX.showStatus?.(!cur ? 'Focus Mode ON (Other FX muted during game)' : 'Focus Mode OFF (All FX active with game)', 'info');
        updateHUD();
      });
    }

    const gameSpeedBtn = container.querySelector('#plexus-game-speed');
    if (gameSpeedBtn) {
      gameSpeedBtn.addEventListener('click', () => {
        pressEffect(gameSpeedBtn);
        const cur = FX.settings?.targetGame?.speed === 'fast';
        const next = cur ? 'normal' : 'fast';
        saveSettings({ targetGame: { ...(FX.settings?.targetGame || {}), speed: next } });
        FX.showStatus?.(`Game Speed: ${next.toUpperCase()}`, 'info');
        updateHUD();
      });
    }

    const gameResetBtn = container.querySelector('#plexus-game-reset');
    if (gameResetBtn) {
      gameResetBtn.addEventListener('click', () => {
        pressEffect(gameResetBtn);
        if (FX.resetGame) FX.resetGame();
        if (FX.engine?.resetGame) FX.engine.resetGame();
        FX.showStatus?.('Score reset!', 'ok');
        updateHUD();
      });
    }

    // 3. Tab Draw controls
    const drawToggleBtn = container.querySelector('#plexus-draw-toggle');
    if (drawToggleBtn) {
      drawToggleBtn.addEventListener('click', () => {
        pressEffect(drawToggleBtn);
        const cur = !!FX.settings?.airDraw?.on;
        saveSettings({ airDraw: { ...(FX.settings?.airDraw || {}), on: !cur } });
        FX.showStatus?.(cur ? 'Air Draw OFF' : 'Air Draw ON: Point or pinch fingertip in air', 'ok');
        updateHUD();
      });
    }

    const drawColors = container.querySelectorAll('.plexus-swatch');
    drawColors.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        pressEffect(swatch);
        const col = swatch.dataset.color;
        saveSettings({ airDraw: { ...(FX.settings?.airDraw || {}), color: col } });
        drawColors.forEach((s) => s.classList.toggle('active', s.dataset.color === col));
        FX.showStatus?.(`Air Draw Color: ${col}`, 'info');
      });
    });

    function bindDrawSize(id, sz) {
      const btn = container.querySelector(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        pressEffect(btn);
        saveSettings({ airDraw: { ...(FX.settings?.airDraw || {}), size: sz } });
        updateHUD();
      });
    }
    bindDrawSize('#plexus-draw-size-s', 3);
    bindDrawSize('#plexus-draw-size-m', 6);
    bindDrawSize('#plexus-draw-size-l', 12);

    const clearCanvasBtn = container.querySelector('#plexus-draw-clear');
    if (clearCanvasBtn) {
      clearCanvasBtn.addEventListener('click', () => {
        pressEffect(clearCanvasBtn);
        if (FX.engine?.clearDrawings) FX.engine.clearDrawings();
        FX.showStatus?.('Canvas cleared', 'info');
      });
    }

    // 4. Tab Setup controls
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

    const audioBtn = container.querySelector('#plexus-btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        pressEffect(audioBtn);
        const cur = !!FX.settings?.audioPulse?.on;
        saveSettings({ audioPulse: { ...(FX.settings?.audioPulse || {}), on: !cur } });
        FX.showStatus?.(cur ? 'Audio Pulse OFF' : 'Audio Pulse ON', 'info');
        updateHUD();
      });
    }

    const ecoBtn = container.querySelector('#plexus-btn-eco');
    if (ecoBtn) {
      ecoBtn.addEventListener('click', () => {
        pressEffect(ecoBtn);
        const cur = !!FX.settings?.ecoMode;
        saveSettings({ ecoMode: !cur });
        FX.showStatus?.(cur ? 'Eco Mode OFF' : 'Eco Mode ON', 'info');
        updateHUD();
      });
    }

    const clapBtn = container.querySelector('#plexus-btn-clap');
    if (clapBtn) {
      clapBtn.addEventListener('click', () => {
        pressEffect(clapBtn);
        const cur = !!FX.settings?.clapSound;
        saveSettings({ clapSound: !cur });
        FX.showStatus?.(cur ? 'Clap Trigger OFF' : 'Clap Trigger ON (Double-clap to toggle)', 'info');
        updateHUD();
      });
    }

    updateHUD();
  }

  function updateHUD() {
    if (!container) return;
    const S = getSettingsModule();
    const cfg = FX.settings || (S ? S.DEFAULTS : {});
    const active = FX.engine?.isActive ? FX.engine.isActive() : false;

    // Header badge
    const statusBadge = container.querySelector('#plexus-hud-status');
    if (statusBadge) {
      if (cfg.targetGame?.on) {
        statusBadge.textContent = '🎯 Gaming';
        statusBadge.style.background = 'rgba(255, 0, 127, 0.3)';
        statusBadge.style.color = '#ff66c4';
      } else if (active) {
        statusBadge.textContent = 'Active';
        statusBadge.style.background = 'rgba(74, 222, 128, 0.25)';
        statusBadge.style.color = '#4ade80';
      } else {
        statusBadge.textContent = 'Standby';
        statusBadge.style.background = 'rgba(168, 120, 255, 0.25)';
        statusBadge.style.color = '#d1b8ff';
      }
    }

    // 1. Tab FX button states
    const masterFxBtn = container.querySelector('#plexus-toggle-master-fx');
    if (masterFxBtn) {
      const on = !!cfg.gestures?.on;
      masterFxBtn.classList.toggle('active', on);
      const span = masterFxBtn.querySelector('span');
      if (span) span.textContent = on ? '⚡ FX & Gestures: ON' : '⚡ FX & Gestures: OFF';
    }

    const g = cfg.gestures || {};
    const setBtnActive = (id, on) => {
      const b = container.querySelector(id);
      if (b) b.classList.toggle('active', Boolean(on));
    };

    setBtnActive('#plexus-fx-chidori', g.chidori !== false);
    setBtnActive('#plexus-fx-spider', g.spiderWeb !== false);
    setBtnActive('#plexus-fx-saiyan', g.superSaiyan !== false);
    setBtnActive('#plexus-fx-sword', g.laserSword !== false);
    setBtnActive('#plexus-fx-shield', g.mysticShield !== false);
    setBtnActive('#plexus-fx-ball', g.energyBall !== false);
    setBtnActive('#plexus-fx-party', g.party !== false);
    setBtnActive('#plexus-fx-gun', g.fingerGun !== false);
    setBtnActive('#plexus-fx-mesh', cfg.elements?.lines?.on !== false);

    // 2. Tab Game states
    const gameToggleBtn = container.querySelector('#plexus-game-toggle');
    if (gameToggleBtn) {
      const gOn = Boolean(cfg.targetGame?.on);
      gameToggleBtn.classList.toggle('active', gOn);
      const span = gameToggleBtn.querySelector('span');
      if (span) span.textContent = gOn ? '🎯 Target Game: PLAYING' : '🎯 Target Game: OFF';
    }

    const gameFocusBtn = container.querySelector('#plexus-game-focus');
    if (gameFocusBtn) {
      const fOn = cfg.targetGame?.focusMode !== false;
      gameFocusBtn.classList.toggle('active', fOn);
      const span = gameFocusBtn.querySelector('span');
      if (span) span.textContent = fOn ? '🔒 Focus: ON' : '🔓 Focus: OFF';
    }

    const gameSpeedBtn = container.querySelector('#plexus-game-speed');
    if (gameSpeedBtn) {
      const fast = cfg.targetGame?.speed === 'fast';
      gameSpeedBtn.classList.toggle('active', fast);
      const span = gameSpeedBtn.querySelector('span');
      if (span) span.textContent = fast ? '⚡ Speed: Fast' : '⚡ Speed: Norm';
    }

    // Live Game stats
    const stats = (FX.getGameStats ? FX.getGameStats() : (FX.engine?.getGameStats ? FX.engine.getGameStats() : null)) || { score: 0, combo: 1, hits: 0 };
    const scoreVal = container.querySelector('#plexus-game-score');
    if (scoreVal) scoreVal.textContent = (stats.score || 0).toLocaleString();
    const comboVal = container.querySelector('#plexus-game-combo');
    if (comboVal) comboVal.textContent = `${stats.combo || 1}x`;
    const hitsVal = container.querySelector('#plexus-game-hits');
    if (hitsVal) hitsVal.textContent = stats.hits || 0;

    // 3. Tab Draw states
    const drawToggleBtn = container.querySelector('#plexus-draw-toggle');
    if (drawToggleBtn) {
      const dOn = Boolean(cfg.airDraw?.on);
      drawToggleBtn.classList.toggle('active', dOn);
      const span = drawToggleBtn.querySelector('span');
      if (span) span.textContent = dOn ? '✏️ Air Draw: ON' : '✏️ Air Draw: OFF';
    }

    const curColor = cfg.airDraw?.color || '#00ffff';
    container.querySelectorAll('.plexus-swatch').forEach((s) => {
      s.classList.toggle('active', s.dataset.color.toLowerCase() === curColor.toLowerCase());
    });

    const curSize = cfg.airDraw?.size || 5;
    const sizeS = container.querySelector('#plexus-draw-size-s');
    const sizeM = container.querySelector('#plexus-draw-size-m');
    const sizeL = container.querySelector('#plexus-draw-size-l');
    if (sizeS) sizeS.classList.toggle('active', curSize <= 3);
    if (sizeM) sizeM.classList.toggle('active', curSize > 3 && curSize < 10);
    if (sizeL) sizeL.classList.toggle('active', curSize >= 10);

    // 4. Tab Setup states
    const powerBtn = container.querySelector('#plexus-btn-power');
    if (powerBtn) {
      powerBtn.classList.toggle('active', active);
      const span = powerBtn.querySelector('span');
      if (span) span.textContent = active ? '⚡ Power: ON' : '⚡ Power: Off';
    }

    const audioBtn = container.querySelector('#plexus-btn-audio');
    if (audioBtn) audioBtn.classList.toggle('active', Boolean(cfg.audioPulse?.on));

    const ecoBtn = container.querySelector('#plexus-btn-eco');
    if (ecoBtn) ecoBtn.classList.toggle('active', Boolean(cfg.ecoMode));

    const clapBtn = container.querySelector('#plexus-btn-clap');
    if (clapBtn) clapBtn.classList.toggle('active', Boolean(cfg.clapSound));

    const presetSelect = container.querySelector('#plexus-select-preset');
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

    // Dynamic Footer hint
    const footer = container.querySelector('#plexus-hud-footer');
    if (footer) {
      if (cfg.targetGame?.on) {
        footer.textContent = cfg.targetGame?.focusMode !== false
          ? '🎯 Game Active (Focus Mode: Other FX muted)'
          : '🎯 Game Active (All FX running simultaneously)';
      } else if (cfg.airDraw?.on) {
        footer.textContent = '✏️ Air Drawing: Point index finger to draw';
      } else if (cfg.gestures?.on) {
        footer.textContent = '🦸 FX Ready: Chidori (Fist), Web (🤟), Saiyan (Spread), Saber (Sword)';
      } else {
        footer.textContent = '⚡ Camera Plexus Ready';
      }
    }
  }

  // Periodic HUD state check
  setInterval(updateHUD, 450);

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
