// Toolbar popup: edits stored settings and controls the active video call tab.
(() => {
  const S = globalThis.__plexusSettings;
  const SAVE_DELAY_MS = 200;
  const $ = (id) => document.getElementById(id);

  let settings = S ? S.sanitize({}) : {};
  let saveTimer = null;

  // Debounced so dragging a slider or color picker doesn't hit storage quotas.
  function save(next) {
    if (!S) return;
    settings = S.sanitize(next);
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.sync.set({ settings }).catch(() => {});
    }, SAVE_DELAY_MS);
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
      chip.addEventListener('click', () => save(S.applyPreset(settings, name)));
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
      check.addEventListener('change', () => save(withElement(key, { on: check.checked })));
      const name = document.createElement('span');
      name.textContent = S.LABELS[key];
      const color = document.createElement('input');
      color.type = 'color';
      color.id = `${key}Color`;
      color.setAttribute('aria-label', `${S.LABELS[key]} color`);
      color.addEventListener('input', () => save(withElement(key, { color: color.value })));
      row.append(check, name, color);
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function bindSlider(id, read, write) {
    const input = $(id);
    if (!input) return () => {};
    input.addEventListener('input', () => save(write(Number(input.value))));
    return () => {
      input.value = read();
      const out = $(`${id}Out`);
      if (out) out.textContent = `${read()}%`;
    };
  }

  function bindCheck(id, read, write) {
    const input = $(id);
    if (!input) return () => {};
    input.addEventListener('change', () => save(write(input.checked)));
    return () => { input.checked = !!read(); };
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

    // Gestures
    bindCheck('gesturesOn', () => settings.gestures?.on,
      (on) => ({ ...settings, gestures: { ...settings.gestures, on } })),
    bindCheck('gesturePeace', () => settings.gestures?.peace,
      (peace) => ({ ...settings, gestures: { ...settings.gestures, peace } })),
    bindCheck('gestureThumbsUp', () => settings.gestures?.thumbsUp,
      (thumbsUp) => ({ ...settings, gestures: { ...settings.gestures, thumbsUp } })),
    bindCheck('gestureHeart', () => settings.gestures?.heart,
      (heart) => ({ ...settings, gestures: { ...settings.gestures, heart } })),
    bindCheck('gestureShield', () => settings.gestures?.mysticShield,
      (mysticShield) => ({ ...settings, gestures: { ...settings.gestures, mysticShield } })),
    bindCheck('gestureBall', () => settings.gestures?.energyBall,
      (energyBall) => ({ ...settings, gestures: { ...settings.gestures, energyBall } })),

    // Air Drawing
    bindCheck('airDrawOn', () => settings.airDraw?.on,
      (on) => ({ ...settings, airDraw: { ...settings.airDraw, on } })),
    (() => {
      const col = $('airDrawColor');
      if (col) {
        col.addEventListener('input', () => save({ ...settings, airDraw: { ...settings.airDraw, color: col.value } }));
      }
      return () => { if (col) col.value = settings.airDraw?.color || '#00ffff'; };
    })(),
    (() => {
      const sz = $('airDrawSize');
      if (sz) {
        sz.addEventListener('input', () => save({ ...settings, airDraw: { ...settings.airDraw, size: Number(sz.value) } }));
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
      if (check) check.checked = el.on;
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
    ['gesturePeace', 'gestureThumbsUp', 'gestureHeart', 'gestureShield', 'gestureBall'].forEach((id) => {
      const row = $(id)?.closest('.row');
      if (row) row.classList.toggle('disabled', !gActive);
    });

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

  function showState(state) {
    const label = $('state');
    const button = $('toggle');
    if (!button || !label) return;
    if (!state) {
      label.textContent = 'Open any camera tab (Meet, Messenger, OmeTV...)';
      label.classList.remove('on');
      button.disabled = true;
      return;
    }
    button.disabled = false;
    if (!state.engine) {
      label.textContent = 'Waiting for your camera';
      label.classList.remove('on');
      return;
    }
    label.textContent = state.active ? 'Effect is ON' : `Effect is off · tracking ${state.tracking}`;
    label.classList.toggle('on', state.active);
    button.textContent = state.active ? 'Turn off' : 'Turn on';
  }

  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  }

  async function ask(type) {
    try {
      const id = await activeTabId();
      return id === undefined ? null : await chrome.tabs.sendMessage(id, { type });
    } catch (error) {
      return null;
    }
  }

  const toggleBtn = $('toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => showState(await ask('plexus:toggle')));
  }

  const resetBtn = $('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (S) save(S.sanitize({}));
    });
  }

  buildPresets();
  buildElements();
  chrome.storage.sync.get('settings').then(({ settings: stored }) => {
    if (S) settings = S.sanitize(stored);
    render();
  });
  ask('plexus:state').then(showState);
})();
