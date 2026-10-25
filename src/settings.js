// Settings model shared by the popup, the isolated-world bridge and the page
// scripts. Everything that crosses a boundary goes through sanitize() so a bad
// or stale stored value can never break rendering.
(() => {
  const ELEMENTS = ['lines', 'glow', 'triangles', 'nodes', 'shards', 'dust'];

  const DEFAULTS = Object.freeze({
    elements: {
      lines: { on: true, color: '#ffffff' },
      glow: { on: true, color: '#a878ff' },
      triangles: { on: true, color: '#a878ff' },
      nodes: { on: true, color: '#ffffff' },
      shards: { on: true, color: '#ffffff' },
      dust: { on: true, color: '#d6c4ff' },
    },
    darken: 25, // % darker footage while the effect is on
    lightSpill: { on: true, strength: 60 },
    personLight: { on: false, strength: 70 },
    clapSound: true,
    gestures: {
      on: true,
      peace: true,
      thumbsUp: true,
      heart: true,
      mysticShield: true,
      energyBall: true,
      chidori: true,
      spiderWeb: true,
      superSaiyan: true,
      laserSword: true,
    },
    airDraw: {
      on: false,
      color: '#00ffff',
      size: 5,
    },
    audioPulse: {
      on: true,
      strength: 60,
    },
    rainbow: {
      on: false,
      speed: 1,
    },
    ecoMode: false,
    hudVisible: true,
  });

  const PRESETS = {
    Violet: { lines: '#ffffff', glow: '#a878ff', triangles: '#a878ff', nodes: '#ffffff', shards: '#ffffff', dust: '#d6c4ff' },
    Ice: { lines: '#e8fbff', glow: '#3cc8ff', triangles: '#3c9dff', nodes: '#ffffff', shards: '#dff6ff', dust: '#9fe6ff' },
    Ember: { lines: '#fff1dc', glow: '#ff8a2a', triangles: '#ff6a1f', nodes: '#fff4e0', shards: '#ffd29a', dust: '#ffb15c' },
    Neon: { lines: '#ffffff', glow: '#ff2fd6', triangles: '#29f0ff', nodes: '#fff36b', shards: '#ff9cf0', dust: '#7dfcff' },
    Mono: { lines: '#ffffff', glow: '#ffffff', triangles: '#cfd6e6', nodes: '#ffffff', shards: '#ffffff', dust: '#e8ecf5' },
    DoctorStrange: { lines: '#ffe7a3', glow: '#ff7700', triangles: '#ff4800', nodes: '#ffffff', shards: '#ffaa33', dust: '#ffcc66' },
    Fire: { lines: '#fff0a6', glow: '#ff3300', triangles: '#ff6600', nodes: '#ffffff', shards: '#ff2200', dust: '#ff9900' },
    Cyberpunk: { lines: '#00ffff', glow: '#ff007f', triangles: '#7928ca', nodes: '#ffff00', shards: '#00ffff', dust: '#ff007f' },
    Matrix: { lines: '#00ff66', glow: '#00cc44', triangles: '#005522', nodes: '#88ffaa', shards: '#00ff44', dust: '#44ff88' },
    Rainbow: { lines: '#ffffff', glow: '#ff3399', triangles: '#33ccff', nodes: '#ffff33', shards: '#ff33ff', dust: '#33ff99' },
  };

  const LABELS = {
    lines: 'Lines',
    glow: 'Line glow',
    triangles: 'Triangles',
    nodes: 'Fingertip dots',
    shards: 'Shards',
    dust: 'Dissolving particles',
  };

  const HEX = /^#[0-9a-f]{6}$/i;

  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  const color = (v, fallback) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);

  function sanitize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const els = src.elements && typeof src.elements === 'object' ? src.elements : {};
    const elements = Object.fromEntries(
      ELEMENTS.map((key) => {
        const d = DEFAULTS.elements[key];
        const e = els[key] && typeof els[key] === 'object' ? els[key] : {};
        return [key, { on: bool(e.on, d.on), color: color(e.color, d.color) }];
      }),
    );
    const spill = src.lightSpill || {};
    const person = src.personLight || {};
    const g = src.gestures || {};
    const ad = src.airDraw || {};
    const ap = src.audioPulse || {};
    const rb = src.rainbow || {};

    return {
      elements,
      darken: clamp(src.darken, 0, 60, DEFAULTS.darken),
      lightSpill: {
        on: bool(spill.on, DEFAULTS.lightSpill.on),
        strength: clamp(spill.strength, 0, 100, DEFAULTS.lightSpill.strength),
      },
      personLight: {
        on: bool(person.on, DEFAULTS.personLight.on),
        strength: clamp(person.strength, 0, 100, DEFAULTS.personLight.strength),
      },
      clapSound: bool(src.clapSound, DEFAULTS.clapSound),
      gestures: {
        on: bool(g.on, DEFAULTS.gestures.on),
        peace: bool(g.peace, DEFAULTS.gestures.peace),
        thumbsUp: bool(g.thumbsUp, DEFAULTS.gestures.thumbsUp),
        heart: bool(g.heart, DEFAULTS.gestures.heart),
        mysticShield: bool(g.mysticShield, DEFAULTS.gestures.mysticShield),
        energyBall: bool(g.energyBall, DEFAULTS.gestures.energyBall),
        chidori: bool(g.chidori, DEFAULTS.gestures.chidori),
        spiderWeb: bool(g.spiderWeb, DEFAULTS.gestures.spiderWeb),
        superSaiyan: bool(g.superSaiyan, DEFAULTS.gestures.superSaiyan),
        laserSword: bool(g.laserSword, DEFAULTS.gestures.laserSword),
      },
      airDraw: {
        on: bool(ad.on, DEFAULTS.airDraw.on),
        color: color(ad.color, DEFAULTS.airDraw.color),
        size: clamp(ad.size, 1, 30, DEFAULTS.airDraw.size),
      },
      audioPulse: {
        on: bool(ap.on, DEFAULTS.audioPulse.on),
        strength: clamp(ap.strength, 0, 100, DEFAULTS.audioPulse.strength),
      },
      rainbow: {
        on: bool(rb.on, DEFAULTS.rainbow.on),
        speed: clamp(rb.speed, 0.1, 5, DEFAULTS.rainbow.speed),
      },
      ecoMode: bool(src.ecoMode, DEFAULTS.ecoMode),
      hudVisible: bool(src.hudVisible, DEFAULTS.hudVisible),
    };
  }

  function applyPreset(settings, name) {
    if (name === 'Rainbow') {
      return { ...settings, rainbow: { ...settings.rainbow, on: true } };
    }
    const preset = PRESETS[name];
    if (!preset) return settings;
    const elements = Object.fromEntries(
      ELEMENTS.map((key) => [key, { ...settings.elements[key], color: preset[key] }]),
    );
    return { ...settings, elements, rainbow: { ...settings.rainbow, on: false } };
  }

  // '#a878ff' -> '168, 120, 255' for rgba() strings.
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function rainbowRgb(now, offset = 0, speed = 1) {
    const hue = (now * 0.08 * speed + offset) % 360;
    const c = 1, x = 1 - Math.abs(((hue / 60) % 2) - 1);
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; }
    else if (hue < 120) { r = x; g = c; }
    else if (hue < 180) { g = c; b = x; }
    else if (hue < 240) { g = x; b = c; }
    else if (hue < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
  }

  const api = { ELEMENTS, DEFAULTS, PRESETS, LABELS, sanitize, applyPreset, rgb, rainbowRgb };
  globalThis.__plexusSettings = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
