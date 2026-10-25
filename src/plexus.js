// Plexus renderer: glowing strings between fingertips, translucent facets,
// drifting satellite nodes, shattering shards and dissolving dust.
// Highly optimized for 60fps silky-smooth rendering with continuous time-based
// interpolation, batched canvas path calls, and cached GPU halo sprites.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const S = () => globalThis.__plexusSettings || {};
  const rgb = (hex) => (S().rgb ? S().rgb(hex) : '255, 255, 255');
  const rainbowRgb = (now, offset, speed) =>
    (S().rainbowRgb ? S().rainbowRgb(now, offset, speed) : '255, 255, 255');

  const TIP_IDS = [4, 8, 12, 16, 20];
  const PALM_IDS = [0, 5, 9, 17];
  const SATELLITES = 7;
  const FADE_MS = 400;
  const HAND_TIMEOUT_MS = 380;
  const DUST_PER_SECOND = 200;
  const DISSOLVE_DUST = 550;

  const lerp = (a, b, t) => a + (b - a) * t;
  const avg = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const toPoint = (lm) => ({ x: lm[0], y: lm[1] });

  // Intelligent finger extension detection (0 = curled in fist, 1 = fully extended)
  // Ensures only opened fingers are targeted; curled fingers have zero clutter/nodes
  function getFingerExtensions(landmarks) {
    if (!landmarks || landmarks.length < 21) return [1, 1, 1, 1, 1];
    const pt = (i) => ({ x: landmarks[i][0], y: landmarks[i][1] });
    const wrist = pt(0);
    const middleMcp = pt(9);
    const pinkyMcp = pt(17);
    const indexMcp = pt(5);
    const handSize = Math.max(0.001, dist(wrist, middleMcp));

    // 4 fingers: Index (8,6,5), Middle (12,10,9), Ring (16,14,13), Pinky (20,18,17)
    const fingerConfigs = [
      { tip: 8, pip: 6, mcp: 5 },
      { tip: 12, pip: 10, mcp: 9 },
      { tip: 16, pip: 14, mcp: 13 },
      { tip: 20, pip: 18, mcp: 17 },
    ];

    const fingerExts = fingerConfigs.map(({ tip, pip, mcp }) => {
      const pTip = pt(tip);
      const pPip = pt(pip);
      const pMcp = pt(mcp);

      const rWrist = dist(pTip, wrist) / Math.max(0.001, dist(pPip, wrist));
      const rMcp = dist(pTip, pMcp) / Math.max(0.001, dist(pPip, pMcp));

      const scoreWrist = (rWrist - 0.98) / 0.28;
      const scoreMcp = (rMcp - 1.05) / 0.55;
      const score = Math.max(scoreWrist, scoreMcp);
      return Math.max(0, Math.min(1, score));
    });

    // Thumb (tip 4, mcp 2)
    const thumbTip = pt(4);
    const thumbMcp = pt(2);

    const dIndex = dist(thumbTip, indexMcp) / handSize;
    const dMiddle = dist(thumbTip, middleMcp) / handSize;
    const dPinky = dist(thumbTip, pinkyMcp) / Math.max(0.001, dist(thumbMcp, pinkyMcp));

    const sIndex = (dIndex - 0.32) / 0.22;
    const sPinky = (dPinky - 0.98) / 0.25;
    const sMiddle = (dMiddle - 0.48) / 0.22;
    const thumbScore = Math.max(sIndex, sPinky, sMiddle);
    const thumbExt = Math.max(0, Math.min(1, thumbScore));

    return [thumbExt, fingerExts[0], fingerExts[1], fingerExts[2], fingerExts[3]];
  }

  // Cached halo sprite for ultra-fast GPU-accelerated node rendering
  let haloSprite = null;
  function getHaloSprite() {
    if (haloSprite) return haloSprite;
    const size = 64;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    haloSprite = canvas;
    return haloSprite;
  }

  function smoothHand(prev, landmarks, now) {
    const rawTips = TIP_IDS.map((i) => toPoint(landmarks[i]));
    const palm = avg(PALM_IDS.map((i) => toPoint(landmarks[i])));
    const size = dist(toPoint(landmarks[0]), toPoint(landmarks[9]));
    const targetExt = getFingerExtensions(landmarks);

    if (!prev) {
      return {
        targetTips: rawTips,
        tips: rawTips.map((p, i) => ({ ...p, ext: targetExt[i] })),
        targetPalm: palm,
        palm: { ...palm },
        targetSize: size,
        size,
        targetExt,
        ext: [...targetExt],
        seenAt: now,
        speed: 0,
        vis: 0,
      };
    }

    const moved = rawTips.reduce((s, p, i) => s + dist(p, prev.tips[i]), 0) / rawTips.length;
    return {
      targetTips: rawTips,
      tips: prev.tips, // will be smoothly interpolated on every tick
      targetPalm: palm,
      palm: prev.palm,
      targetSize: size,
      size: prev.size,
      targetExt,
      ext: prev.ext || [...targetExt],
      seenAt: now,
      speed: lerp(prev.speed, moved, 0.4),
      vis: prev.vis,
    };
  }

  function satellites(hand, idx, now, w, h) {
    const r = hand.size * Math.min(w, h) * 1.1;
    const cx = hand.palm.x * w;
    const cy = hand.palm.y * h;
    return Array.from({ length: SATELLITES }, (_, i) => {
      const phase = (now / 1000) * (0.5 + i * 0.13) + i * 2.1 + idx * 1.7;
      const rr = r * (0.55 + 0.45 * Math.sin(phase * 1.3));
      return { x: cx + Math.cos(phase) * rr, y: cy + Math.sin(phase * 0.9) * rr };
    });
  }

  // Fast geometry builder with squared distance filtering and selective finger targeting
  function buildGeometry(handList, level, now, w, h) {
    const tipSets = handList.map((hand) =>
      hand.tips.map((p) => ({ x: p.x * w, y: p.y * h, ext: p.ext ?? 1 }))
    );
    const palms = handList.map((hand) => ({ x: hand.palm.x * w, y: hand.palm.y * h }));
    const sats = handList.flatMap((hand, i) => satellites(hand, i, now, w, h));
    const handAlpha = handList.map((hand) => level * hand.vis);
    const webAlpha = level * Math.min(1, ...handList.map((hand) => hand.vis));
    const segments = [];
    const facets = [];

    // Two hands connecting: scale segments and facets by finger extensions
    if (tipSets.length >= 2) {
      const [l, r] = tipSets;
      for (let i = 0; i < TIP_IDS.length - 1; i += 1) {
        const wFac1 = 0.2 * webAlpha * l[i].ext * l[i + 1].ext * r[i + 1].ext;
        if (wFac1 > 0.01) facets.push([l[i], l[i + 1], r[i + 1], wFac1]);

        const wFac2 = 0.13 * webAlpha * l[i].ext * r[i + 1].ext * r[i].ext;
        if (wFac2 > 0.01) facets.push([l[i], r[i + 1], r[i], wFac2]);

        const wCross = 0.35 * webAlpha * l[i].ext * r[i + 1].ext;
        if (wCross > 0.01) segments.push([l[i], r[i + 1], wCross]);
      }
      l.forEach((p, i) => {
        const wDirect = 0.9 * webAlpha * p.ext * r[i].ext;
        if (wDirect > 0.01) segments.push([p, r[i], wDirect]);
      });
    }

    // Intra-hand geometry: selective targeting based on finger open/curled state
    tipSets.forEach((tips, hi) => {
      const alpha = handAlpha[hi];
      if (alpha <= 0.001) return;
      const palm = palms[hi];

      // Filter tips that are open/extended (ext > 0.08)
      const openTips = tips
        .map((p, idx) => ({ ...p, fingerIdx: idx }))
        .filter((p) => p.ext > 0.08);

      // Connect palm to each open fingertip with glowing energy beams
      openTips.forEach((tip) => {
        segments.push([palm, tip, 0.75 * alpha * tip.ext]);
      });

      // Connect consecutive open fingertips to each other and build facets with palm
      if (openTips.length >= 2) {
        for (let i = 0; i < openTips.length - 1; i += 1) {
          const a = openTips[i];
          const b = openTips[i + 1];
          const pairExt = a.ext * b.ext;
          segments.push([a, b, 0.75 * alpha * pairExt]);
          facets.push([palm, a, b, (tipSets.length >= 2 ? 0.07 : 0.16) * alpha * pairExt]);
        }
      }
    });

    // Spatial pairing: only open tips (ext > 0.15) and satellites connect
    const activeTips = tipSets.flatMap((tips) => tips.filter((p) => p.ext > 0.15));
    const nodes = [...activeTips, ...sats];
    const maxD = Math.min(w, h) * 0.24;
    const maxDSq = maxD * maxD;
    const nLen = nodes.length;

    for (let i = 0; i < nLen; i += 1) {
      const p1 = nodes[i];
      const e1 = p1.ext !== undefined ? p1.ext : 1;
      for (let j = i + 1; j < nLen; j += 1) {
        const p2 = nodes[j];
        const e2 = p2.ext !== undefined ? p2.ext : 1;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxDSq) {
          const d = Math.sqrt(dSq);
          const sAlpha = (1 - d / maxD) * 0.3 * level * e1 * e2;
          if (sAlpha > 0.01) segments.push([p1, p2, sAlpha]);
        }
      }
    }
    return { tipSets, palms, sats, segments, facets, handAlpha, sizes: handList.map((x) => x.size) };
  }

  function createPlexusRenderer() {
    const particles = FX.createParticles();
    const gestures = FX.createGestureManager ? FX.createGestureManager() : null;
    let hands = new Map();
    let rawDetected = [];
    let level = 0;
    let target = 0;
    let lastTick = null;
    let frame = { w: 1280, h: 720 };
    let geom = buildGeometry([], 0, 0, frame.w, frame.h);
    let settings = S().DEFAULTS || {};

    const scale = () => Math.min(frame.w, frame.h);
    const els = () => settings.elements || {};

    function setHands(detected, now) {
      rawDetected = detected;
      const next = new Map();
      detected.forEach((h, idx) => {
        const dup = detected.length === 2 && detected[0].handedness === detected[1].handedness;
        const key = dup ? `${h.handedness}${idx}` : h.handedness;
        next.set(key, smoothHand(hands.get(key), h.landmarks, now));
      });
      hands.forEach((h, key) => {
        if (!next.has(key) && now - h.seenAt < HAND_TIMEOUT_MS) next.set(key, h);
      });
      hands = next;
    }

    function setActive(on) {
      target = on ? 1 : 0;
      const origins = geom.tipSets.flat().filter((p) => (p.ext ?? 1) > 0.2);
      const center = [{ x: frame.w / 2, y: frame.h / 2 }];
      if (els().shards?.on) particles.burstShards(origins.length ? origins : center, scale(), on ? 60 : 90);
      if (!on && els().dust?.on) particles.dustAlong(geom.segments, DISSOLVE_DUST, scale(), true);
    }

    function update(now, nextSettings, w, h) {
      settings = nextSettings || settings;
      frame = { w, h };
      const dt = lastTick === null ? 0 : Math.min((now - lastTick) / 1000, 0.08);
      lastTick = now;
      const step = (dt * 1000) / FADE_MS;
      level = target > level ? Math.min(target, level + step) : Math.max(target, level - step);

      // Continuous exponential interpolation towards target positions & finger extensions
      // Guarantees 60fps buttery movement even when detection is running at ~30fps
      const smoothFactor = 1 - Math.exp(-dt * 24);
      const extFactor = 1 - Math.exp(-dt * 20);

      hands = new Map(
        [...hands]
          .filter(([, hd]) => now - hd.seenAt < HAND_TIMEOUT_MS)
          .map(([k, hd]) => {
            const visible = now - hd.seenAt < 120 ? 1 : 0;
            const updatedExt = (hd.ext || [1, 1, 1, 1, 1]).map((val, i) =>
              lerp(val, hd.targetExt ? hd.targetExt[i] : 1, extFactor)
            );
            const updatedTips = hd.tips.map((p, i) => ({
              x: lerp(p.x, hd.targetTips[i].x, smoothFactor),
              y: lerp(p.y, hd.targetTips[i].y, smoothFactor),
              ext: updatedExt[i],
            }));
            const updatedPalm = {
              x: lerp(hd.palm.x, hd.targetPalm.x, smoothFactor),
              y: lerp(hd.palm.y, hd.targetPalm.y, smoothFactor),
            };
            const updatedSize = lerp(hd.size, hd.targetSize, smoothFactor);
            return [
              k,
              {
                ...hd,
                ext: updatedExt,
                tips: updatedTips,
                palm: updatedPalm,
                size: updatedSize,
                vis: lerp(hd.vis, visible, Math.min(1, dt * 10)),
              },
            ];
          }),
      );

      const list = [...hands.values()].sort((a, b) => a.palm.x - b.palm.x);
      geom = buildGeometry(list, level, now, w, h);

      if (target === 1 && dt > 0) {
        if (els().dust?.on) {
          const dustRate = settings.ecoMode ? DUST_PER_SECOND * 0.4 : DUST_PER_SECOND;
          const n = Math.floor(dustRate * dt + Math.random());
          particles.dustAlong(geom.segments, n, scale());
        }
        list.forEach((hand, i) => {
          if (hand.speed > 0.015 && Math.random() < hand.speed * 20) {
            const openTips = geom.tipSets[i].filter((p) => p.ext > 0.25);
            if (openTips.length > 0) {
              const tip = openTips[Math.floor(Math.random() * openTips.length)];
              if (els().shards?.on) particles.shedShard(tip.x, tip.y, scale());
              if (els().dust?.on) particles.dustAt([tip], 5, scale());
            }
          }
        });
      }
      particles.update(dt, scale(), now);
      if (gestures) gestures.update(rawDetected, now, settings, w, h);
    }

    function isIdle() {
      const gActive = settings.gestures?.on || settings.airDraw?.on;
      return level === 0 && target === 0 && particles.count() === 0 && (!gActive || rawDetected.length === 0);
    }

    function lightSources() {
      if (level === 0) return [];
      const s = scale();
      const tips = geom.tipSets.flatMap((tips, hi) =>
        tips
          .filter((p) => p.ext > 0.15)
          .map((p) => ({ x: p.x, y: p.y, r: s * 0.12 * p.ext, a: geom.handAlpha[hi] * p.ext })));
      const palms = geom.palms.map((p, hi) => ({
        x: p.x, y: p.y, r: Math.max(s * 0.18, geom.sizes[hi] * s * 2.2), a: geom.handAlpha[hi] * 0.8,
      }));
      return [...tips, ...palms];
    }

    function fill(ctx, [a, b, c, alpha], fromRgb, toRgb) {
      const g = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
      g.addColorStop(0, `rgba(${fromRgb}, ${alpha})`);
      g.addColorStop(1, `rgba(${toRgb}, ${alpha * 0.45})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
    }

    // High performance batched stroke drawing
    function strokeBatched(ctx, segments, color, width, alphaScale) {
      if (!segments.length) return;
      ctx.strokeStyle = `rgba(${color}, ${alphaScale})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < segments.length; i += 1) {
        const [a, b] = segments[i];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }

    function drawNode(ctx, p, radius, alpha, coreRgb, unit, halo) {
      if (halo) {
        const sprite = getHaloSprite();
        const hr = radius * 3.5;
        ctx.globalAlpha = alpha * 0.5;
        ctx.drawImage(sprite, p.x - hr, p.y - hr, hr * 2, hr * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = `rgba(${coreRgb}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(radius, unit), 0, Math.PI * 2);
      ctx.fill();
    }

    function drawWeb(ctx, unit, now) {
      if (level === 0 || !geom.tipSets.length) return;
      const e = els();
      const isRainbow = settings.rainbow?.on;
      const rSpeed = settings.rainbow?.speed || 1;
      const glowRgb = isRainbow ? rainbowRgb(now, 0, rSpeed) : rgb(e.glow?.color || '#a878ff');
      const lineRgb = isRainbow ? rainbowRgb(now, 60, rSpeed) : rgb(e.lines?.color || '#ffffff');
      const triRgb = isRainbow ? rainbowRgb(now, 120, rSpeed) : rgb(e.triangles?.color || '#a878ff');
      const nodeRgb = isRainbow ? rainbowRgb(now, 180, rSpeed) : rgb(e.nodes?.color || '#ffffff');

      const audioLevel = FX.getAudioLevel?.() || 0;
      const audioPulse = settings.audioPulse?.on ? 1 + audioLevel * (settings.audioPulse.strength / 50) : 1;

      if (e.triangles?.on) {
        geom.facets.forEach((f) => fill(ctx, f, triRgb, glowRgb));
      }
      if (e.glow?.on) strokeBatched(ctx, geom.segments, glowRgb, 6 * unit * audioPulse, 0.22);
      if (e.lines?.on) strokeBatched(ctx, geom.segments, lineRgb, 1.4 * unit * audioPulse, 0.95);
      if (e.nodes?.on) {
        geom.sats.forEach((p) => drawNode(ctx, p, 1.6 * unit, 0.6 * level, nodeRgb, unit, e.glow?.on));
        geom.tipSets.forEach((tips, hi) =>
          tips.forEach((p) => {
            if ((p.ext ?? 1) < 0.08) return;
            const ext = p.ext ?? 1;
            const nodeAlpha = geom.handAlpha[hi] * ext;
            const nodeRadius = 3.2 * unit * (0.4 + 0.6 * ext);
            drawNode(ctx, p, nodeRadius, nodeAlpha, nodeRgb, unit, e.glow?.on);
          }));
      }
    }

    function draw(ctx, w, h, now = performance.now()) {
      const unit = Math.min(w, h) / 720;
      const e = els();
      const isRainbow = settings.rainbow?.on;
      const rSpeed = settings.rainbow?.speed || 1;
      const dustRgb = isRainbow ? rainbowRgb(now, 240, rSpeed) : rgb(e.dust?.color || '#d6c4ff');
      const shardsRgb = isRainbow ? rainbowRgb(now, 300, rSpeed) : rgb(e.shards?.color || '#ffffff');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawWeb(ctx, unit, now);
      if (e.dust?.on) particles.drawDust(ctx, unit, dustRgb);
      ctx.globalCompositeOperation = 'source-over';
      if (e.shards?.on) {
        const triRgb = isRainbow ? rainbowRgb(now, 120, rSpeed) : rgb(e.triangles?.color || '#a878ff');
        particles.drawShards(ctx, unit, shardsRgb, triRgb);
      }

      // Draw Gesture Animations & Air Canvas
      if (gestures) {
        const list = [...hands.values()].sort((a, b) => a.palm.x - b.palm.x);
        gestures.draw(ctx, w, h, now, settings, list);
      }
      ctx.restore();
    }

    return {
      setHands,
      setActive,
      update,
      draw,
      isIdle,
      lightSources,
      level: () => level,
      clearDrawings: () => gestures?.clearDrawings(),
    };
  }

  FX.createPlexusRenderer = createPlexusRenderer;
  FX.getFingerExtensions = getFingerExtensions;
  if (typeof module !== 'undefined') module.exports = { createPlexusRenderer, getFingerExtensions };
})();
