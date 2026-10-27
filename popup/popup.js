// Toolbar popup: edits stored settings and controls the active video call tab.
(() => {
  const S = globalThis.__plexusSettings;
  const $ = (id) => document.getElementById(id);

  let settings = S ? S.sanitize({}) : {};
  let saveTimer = null;

  async function activeTabId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    } catch (_) {
      return undefined;
    }
  }

  async function broadcast(msg) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id) continue;
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    } catch (_) {}
  }

  async function ask(type) {
    try {
      const id = await activeTabId();
      if (id === undefined) return null;
      return await chrome.tabs.sendMessage(id, { type });
    } catch (error) {
      return null;
    }
  }

  // Saves immediately to sync and local storage, and broadcasts directly to video call tabs
  function save(next, debounce = false) {
    if (!S) return;
    settings = S.sanitize(next);
    render();

    const doPersist = () => {
      try { chrome.storage.sync.set({ settings }).catch(() => {}); } catch (_) {}
      try { chrome.storage.local.set({ settings }).catch(() => {}); } catch (_) {}
      broadcast({ type: 'plexus:settings', settings });
    };

    if (debounce) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(doPersist, 80);
    } else {
      clearTimeout(saveTimer);
      doPersist();
    }
  }

  const withElement = (key, patch) => ({
    ...settings,
    elements: { ...settings.elements, [key]: { ...settings.elements[key], ...patch } },
  });

  function buildPresets() {
    const wrap = $('presets');
    if (!wrap || !S) return;
    wrap.innerHTML = '';
    Object.entries(S.PRESETS).forEach(([name, colors]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.preset = name;
      const swatches = document.createElement('span');
      swatches.className = 'swatches';
      ['glow', 'triangles', 'dust'].forEach((k) => {
        const dot = document.createElement('i');
        dot.style.background = colors[k] || '#8a5cff';
        swatches.appendChild(dot);
      });
      chip.append(swatches, document.createTextNode(name));
      chip.addEventListener('click', () => save(S.applyPreset(settings, name), false));
      wrap.appendChild(chip);
    });
  }

  function buildElements() {
    const list = $('elements');
    if (!list || !S) return;
    list.innerHTML = '';
    S.ELEMENTS.forEach((key) => {
      const li = document.createElement('li');
      const row = document.createElement('label');
      row.className = 'row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.id = `${key}On`;
      check.addEventListener('change', () => save(withElement(key, { on: check.checked }), false));
      const name = document.createElement('span');
      name.textContent = S.LABELS[key];
      const color = document.createElement('input');
      color.type = 'color';
      color.id = `${key}Color`;
      color.setAttribute('aria-label', `${S.LABELS[key]} color`);
      color.addEventListener('input', () => save(withElement(key, { color: color.value }), false));
      row.append(check, name, color);
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function bindSlider(id, read, write) {
    const input = $(id);
    if (!input) return () => {};
    input.addEventListener('input', () => save(write(Number(input.value)), true));
    return () => {
      input.value = read();
      const out = $(`${id}Out`);
      if (out) out.textContent = `${read()}%`;
    };
  }

  function bindCheck(id, read, write) {
    const input = $(id);
    if (!input) return () => {};
    input.addEventListener('change', () => save(write(input.checked), false));
    return () => { input.checked = Boolean(read()); };
  }

  const renderers = [
    // Footage
    bindSlider('darken', () => settings.darken, (v) => ({ ...settings, darken: v })),
    bindCheck('spillOn', () => settings.lightSpill?.on,
      (on) => ({ ...settings, lightSpill: { ...settings.lightSpill, on } })),
    bindSlider('spill', () => settings.lightSpill?.strength || 60,
      (strength) => ({ ...settings, lightSpill: { ...settings.lightSpill, strength } })),
    bindCheck('personOn', () => settings.personLight?.on,
      (on) => ({ ...settings, personLight: { ...settings.personLight, on } })),
    bindSlider('person', () => settings.personLight?.strength || 70,
      (strength) => ({ ...settings, personLight: { ...settings.personLight, strength } })),
    bindCheck('clapSound', () => settings.clapSound, (clapSound) => ({ ...settings, clapSound })),

    // Gestures & Anime FX
    bindCheck('gesturesOn', () => settings.gestures?.on,
      (on) => ({
        ...settings,
        enabled: on ? true : settings.enabled,
        gestures: { ...settings.gestures, on },
      })),
    bindCheck('gestureChidori', () => settings.gestures?.chidori,
      (chidori) => ({
        ...settings,
        enabled: chidori ? true : settings.enabled,
        gestures: { ...settings.gestures, on: chidori ? true : settings.gestures?.on, chidori },
      })),
    bindCheck('gestureSpiderWeb', () => settings.gestures?.spiderWeb,
      (spiderWeb) => ({
        ...settings,
        enabled: spiderWeb ? true : settings.enabled,
        gestures: { ...settings.gestures, on: spiderWeb ? true : settings.gestures?.on, spiderWeb },
      })),
    bindCheck('gestureSuperSaiyan', () => settings.gestures?.superSaiyan,
      (superSaiyan) => ({
        ...settings,
        enabled: superSaiyan ? true : settings.enabled,
        gestures: { ...settings.gestures, on: superSaiyan ? true : settings.gestures?.on, superSaiyan },
      })),
    bindCheck('gestureLaserSword', () => settings.gestures?.laserSword,
      (laserSword) => ({
        ...settings,
        enabled: laserSword ? true : settings.enabled,
        gestures: { ...settings.gestures, on: laserSword ? true : settings.gestures?.on, laserSword },
      })),
    bindCheck('gestureFingerGun', () => settings.gestures?.fingerGun,
      (fingerGun) => ({
        ...settings,
        enabled: fingerGun ? true : settings.enabled,
        gestures: { ...settings.gestures, on: fingerGun ? true : settings.gestures?.on, fingerGun },
      })),
    bindCheck('gestureShield', () => settings.gestures?.mysticShield,
      (mysticShield) => ({
        ...settings,
        enabled: mysticShield ? true : settings.enabled,
        gestures: { ...settings.gestures, on: mysticShield ? true : settings.gestures?.on, mysticShield },
      })),
    bindCheck('gestureBall', () => settings.gestures?.energyBall,
      (energyBall) => ({
        ...settings,
        enabled: energyBall ? true : settings.enabled,
        gestures: { ...settings.gestures, on: energyBall ? true : settings.gestures?.on, energyBall },
      })),
    bindCheck('gesturePeace', () => settings.gestures?.peace,
      (peace) => ({
        ...settings,
        enabled: peace ? true : settings.enabled,
        gestures: {
          ...settings.gestures,
          on: peace ? true : settings.gestures?.on,
          peace,
          party: peace || settings.gestures?.thumbsUp || settings.gestures?.heart,
        },
      })),
    bindCheck('gestureThumbsUp', () => settings.gestures?.thumbsUp,
      (thumbsUp) => ({
        ...settings,
        enabled: thumbsUp ? true : settings.enabled,
        gestures: {
          ...settings.gestures,
          on: thumbsUp ? true : settings.gestures?.on,
          thumbsUp,
          party: thumbsUp || settings.gestures?.peace || settings.gestures?.heart,
        },
      })),
    bindCheck('gestureHeart', () => settings.gestures?.heart,
      (heart) => ({
        ...settings,
        enabled: heart ? true : settings.enabled,
        gestures: {
          ...settings.gestures,
          on: heart ? true : settings.gestures?.on,
          heart,
          party: heart || settings.gestures?.peace || settings.gestures?.thumbsUp,
        },
      })),

    // Interactive Target Game
    bindCheck('targetGameOn', () => settings.targetGame?.on,
      (on) => ({
        ...settings,
        enabled: on ? true : settings.enabled,
        targetGame: { ...settings.targetGame, on },
      })),
    bindCheck('targetGameFocus', () => settings.targetGame?.focusMode !== false,
      (focusMode) => ({ ...settings, targetGame: { ...settings.targetGame, focusMode } })),

    // Air Drawing
    bindCheck('airDrawOn', () => settings.airDraw?.on,
      (on) => ({
        ...settings,
        enabled: on ? true : settings.enabled,
        airDraw: { ...settings.airDraw, on },
      })),
    (() => {
      const col = $('airDrawColor');
      if (col) {
        col.addEventListener('input', () => save({ ...settings, airDraw: { ...settings.airDraw, color: col.value } }, false));
      }
      return () => { if (col) col.value = settings.airDraw?.color || '#00ffff'; };
    })(),
    (() => {
      const sz = $('airDrawSize');
      if (sz) {
        sz.addEventListener('input', () => save({ ...settings, airDraw: { ...settings.airDraw, size: Number(sz.value) } }, true));
      }
      return () => {
        if (sz) {
          sz.value = settings.airDraw?.size || 5;
          const out = $('airDrawSizeOut');
          if (out) out.textContent = `${sz.value}px`;
        }
      };
    })(),

    // Audio & Eco
    bindCheck('audioPulseOn', () => settings.audioPulse?.on,
      (on) => ({ ...settings, audioPulse: { ...settings.audioPulse, on } })),
    bindSlider('audioPulseStrength', () => settings.audioPulse?.strength || 60,
      (strength) => ({ ...settings, audioPulse: { ...settings.audioPulse, strength } })),
    bindCheck('ecoMode', () => settings.ecoMode, (ecoMode) => ({ ...settings, ecoMode })),
  ];

  function render() {
    if (!S || !settings.elements) return;
    S.ELEMENTS.forEach((key) => {
      const el = settings.elements[key];
      const check = $(`${key}On`);
      const color = $(`${key}Color`);
      if (check) check.checked = Boolean(el.on);
      if (color) color.value = el.color;
      if (check) {
        const row = check.closest('.row');
        if (row) row.classList.toggle('disabled', !el.on);
      }
    });
    renderers.forEach((fn) => fn());

    // Highlight active preset chip if matching
    const chips = document.querySelectorAll('.chip');
    chips.forEach((chip) => {
      const name = chip.dataset.preset;
      const isRainbow = name === 'Rainbow' && !!settings.rainbow?.on;
      const isColorMatch = !settings.rainbow?.on && S.PRESETS[name] &&
        S.PRESETS[name].glow === settings.elements.glow?.color;
      chip.classList.toggle('active', isRainbow || isColorMatch);
    });

    // Disable child gesture rows when master switch is OFF
    const gActive = !!settings.gestures?.on;
    [
      'gestureChidori', 'gestureSpiderWeb', 'gestureSuperSaiyan', 'gestureLaserSword',
      'gestureFingerGun', 'gestureShield', 'gestureBall', 'gesturePeace',
      'gestureThumbsUp', 'gestureHeart',
    ].forEach((id) => {
      const row = $(id)?.closest('.row');
      if (row) row.classList.toggle('disabled', !gActive);
    });

    // Disable target game child rows when game switch is OFF
    const gameActive = !!settings.targetGame?.on;
    const focusRow = $('targetGameFocus')?.closest('.row');
    if (focusRow) focusRow.classList.toggle('disabled', !gameActive);

    // Disable air draw child rows when master switch is OFF
    const airActive = !!settings.airDraw?.on;
    $('airDrawColor')?.closest('.row')?.classList.toggle('disabled', !airActive);
    $('airDrawSize')?.closest('.row')?.classList.toggle('disabled', !airActive);

    // Disable audio strength slider when audio pulse is OFF
    const audioActive = !!settings.audioPulse?.on;
    $('audioPulseStrength')?.closest('.row')?.classList.toggle('disabled', !audioActive);

    const spillRow = $('spill')?.closest('.row');
    if (spillRow) spillRow.classList.toggle('disabled', !settings.lightSpill?.on);
    const personRow = $('person')?.closest('.row');
    if (personRow) personRow.classList.toggle('disabled', !settings.personLight?.on);
  }

  let lastState = null;

  function showState(state) {
    if (state) lastState = state;
    const label = $('state');
    const button = $('toggle');
    if (!button || !label) return;

    button.disabled = false;
    const isActive = (state && typeof state.active === 'boolean')
      ? state.active
      : (settings.enabled !== false);

    if (isActive) {
      label.textContent = state?.engine
        ? `✨ Camera Plexus ACTIVE (${state.tracking || 'tracking'})`
        : '✨ Camera Plexus ON · Ready for camera';
      label.classList.add('on');
      button.textContent = '⚡ Turn Off';
      button.classList.add('active');
    } else {
      label.classList.remove('on');
      button.textContent = '⚡ Turn On';
      button.classList.remove('active');
      if (state?.engine) {
        label.textContent = 'Camera paused · Click to Turn On';
      } else {
        label.textContent = 'Effects OFF · Click to Turn On';
      }
    }
  }

  const toggleBtn = $('toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      const curActive = (lastState && typeof lastState.active === 'boolean')
        ? lastState.active
        : (settings.enabled !== false);
      const nextActive = !curActive;
      lastState = { ...(lastState || {}), active: nextActive };
      save({ ...settings, enabled: nextActive }, false);
      showState(lastState);
      broadcast({ type: 'plexus:set-active', active: nextActive });
    });
  }

  const resetBtn = $('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (S) {
        const next = S.sanitize({});
        lastState = { ...(lastState || {}), active: true };
        save(next, false);
        showState(lastState);
        broadcast({ type: 'plexus:set-active', active: true });
      }
    });
  }

  async function init() {
    buildPresets();
    buildElements();

    let stored = null;
    try {
      const syncRes = await chrome.storage.sync.get('settings');
      if (syncRes && syncRes.settings) stored = syncRes.settings;
    } catch (_) {}
    if (!stored) {
      try {
        const localRes = await chrome.storage.local.get('settings');
        if (localRes && localRes.settings) stored = localRes.settings;
      } catch (_) {}
    }

    if (stored && S && stored.schemaVersion !== S.SCHEMA_VERSION) {
      stored = null;
    }
    if (S) settings = S.sanitize(stored || {});
    if (!stored && S) {
      try { chrome.storage.sync.set({ settings }).catch(() => {}); } catch (_) {}
      try { chrome.storage.local.set({ settings }).catch(() => {}); } catch (_) {}
    }
    render();
    showState({ active: settings.enabled !== false, engine: false });

    try {
      const state = await ask('plexus:state');
      if (state) {
        if (typeof settings.enabled === 'boolean' && stored) {
          state.active = settings.enabled;
        }
        showState(state);
      }
    } catch (_) {
      showState({ active: settings.enabled !== false, engine: false });
    }
  }

  init();
})();
