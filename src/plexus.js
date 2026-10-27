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
  const FINGER_CHAINS = [
    [0, 1, 2, 3, 4],     // Thumb
    [0, 5, 6, 7, 8],     // Index
    [0, 9, 10, 11, 12],  // Middle
    [0, 13, 14, 15, 16], // Ring
    [0, 17, 18, 19, 20], // Pinky
  ];
  const PALM_ARCH_BONES = [
    [5, 9], [9, 13], [13, 17], [17, 0], [0, 5],
  ];
  const KNUCKLE_INDICES = [0, 1, 2, 5, 9, 13, 17];
  const SATELLITES = 4;
  const FADE_MS = 400;
  const HAND_TIMEOUT_MS = 500;
  const DUST_PER_SECOND = 200;
  const DISSOLVE_DUST = 550;

  const lerp = (a, b, t) => a + (b - a) * t;
  const avg = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + (p.z || 0), 0) / pts.length,
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dist3D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  const toPoint = (lm) => ({ x: lm[0], y: lm[1], z: lm[2] || 0 });

  // Intelligent finger extension detection (0 = curled in fist, 1 = fully extended)
  // Uses 3D-depth invariant calculations to prevent fingers vanishing when pointing toward camera
  function getFingerExtensions(landmarks) {
    if (!landmarks || landmarks.length < 21) return [1, 1, 1, 1, 1];
    const pt = (i) => ({ x: landmarks[i][0], y: landmarks[i][1], z: landmarks[i][2] || 0 });
    const wrist = pt(0);
    const middleMcp = pt(9);
    const pinkyMcp = pt(17);
    const indexMcp = pt(5);
    const handSize2D = Math.max(0.001, dist(wrist, middleMcp));
    const handSize3D = Math.max(0.001, dist3D(wrist, middleMcp));

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

      // 2D distance for pure plane tests
      const rWrist2D = dist(pTip, wrist) / Math.max(0.001, dist(pPip, wrist));
      const rMcp2D = dist(pTip, pMcp) / Math.max(0.001, dist(pPip, pMcp));

      // 3D distance to protect against foreshortening in live webcam
      const rWrist3D = dist3D(pTip, wrist) / Math.max(0.001, dist3D(pPip, wrist));
      const rMcp3D = dist3D(pTip, pMcp) / Math.max(0.001, dist3D(pPip, pMcp));

      const rWrist = Math.max(rWrist2D, rWrist3D);
      const rMcp = Math.max(rMcp2D, rMcp3D);

      const scoreWrist = (rWrist - 0.98) / 0.28;
      const scoreMcp = (rMcp - 1.05) / 0.55;
      const score = Math.max(scoreWrist, scoreMcp);
      return Math.max(0, Math.min(1, score));
    });

    // Thumb (tip 4, mcp 2)
    const thumbTip = pt(4);
    const thumbMcp = pt(2);

    const dIndex = Math.max(
      dist(thumbTip, indexMcp) / handSize2D,
      dist3D(thumbTip, indexMcp) / handSize3D
    );
    const dMiddle = Math.max(
      dist(thumbTip, middleMcp) / handSize2D,
      dist3D(thumbTip, middleMcp) / handSize3D
    );
    const dPinky = Math.max(
      dist(thumbTip, pinkyMcp) / Math.max(0.001, dist(thumbMcp, pinkyMcp)),
      dist3D(thumbTip, pinkyMcp) / Math.max(0.001, dist3D(thumbMcp, pinkyMcp))
    );

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
    let canvas = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(size, size);
    } else if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
    } else {
      return null;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
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

  // Adaptive responsive smoothing filter (One-Euro filter principle)
  // Eliminates dragging/lag when hand moves while filtering webcam noise when still
  function smoothPoint(prevPt, targetPt, dt) {
    if (!prevPt) return { ...targetPt };
    const dx = targetPt.x - prevPt.x;
    const dy = targetPt.y - prevPt.y;
    const distSq = dx * dx + dy * dy;
    // distSq: small jitter (< 0.0001) -> rate ~ 28 (smooth factor ~0.60)
    // distSq: hand in motion (> 0.002) -> rate up to 200 (smooth factor >0.99 for ZERO lag lock)
    const rate = 28 + Math.min(180, distSq * 35000);
    const factor = 1 - Math.exp(-dt * rate);
    return {
      x: prevPt.x + dx * factor,
      y: prevPt.y + dy * factor,
      z: prevPt.z !== undefined && targetPt.z !== undefined
        ? prevPt.z + (targetPt.z - prevPt.z) * factor
        : targetPt.z || 0,
    };
  }

  function smoothHand(prev, landmarks, now) {
    if (!landmarks || !landmarks.length) return prev;
    const rawPoints = landmarks.map((lm) => ({
      x: lm[0],
      y: lm[1],
      z: lm[2] || 0,
    }));
    const rawTips = TIP_IDS.map((i) => rawPoints[i] || { x: 0.5, y: 0.5, z: 0 });
    const palm = avg(PALM_IDS.map((i) => rawPoints[i] || { x: 0.5, y: 0.5, z: 0 }));
    const size = dist(rawPoints[0] || { x: 0, y: 0 }, rawPoints[9] || { x: 0, y: 0 });
    const targetExt = getFingerExtensions(landmarks);

    if (!prev || !prev.points || prev.points.length !== rawPoints.length) {
      return {
        targetPoints: rawPoints,
        points: rawPoints.map((p) => ({ ...p })),
        targetTips: rawTips,
        tips: rawTips.map((p, i) => ({ ...p, ext: targetExt[i] ?? 1 })),
        targetPalm: palm,
        palm: { ...palm },
        targetSize: size,
        size,
        targetExt,
        ext: [...targetExt],
        seenAt: now,
        speed: 0,
        vis: 0.9,
      };
    }

    const moved = rawTips.reduce((s, p, i) => s + dist(p, prev.tips[i] || p), 0) / rawTips.length;
    return {
      targetPoints: rawPoints,
      points: prev.points,
      targetTips: rawTips,
      tips: prev.tips,
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
    const r = hand.size * Math.min(w, h) * 0.65;
    const cx = hand.palm.x * w;
    const cy = hand.palm.y * h;
    return Array.from({ length: SATELLITES }, (_, i) => {
      const phase = (now / 1000) * (0.6 + i * 0.15) + i * (Math.PI / 2) + idx * 1.5;
      const rr = r * (0.7 + 0.3 * Math.sin(phase * 1.2));
      return { x: cx + Math.cos(phase) * rr, y: cy + Math.sin(phase * 0.9) * rr };
    });
  }

  // Fast geometry builder with full skeletal finger tracking and sci-fi plexus webs
  function buildGeometry(handList, level, now, w, h) {
    const tipSets = [];
    const jointSets = [];
    const palms = handList.map((hand) => ({ x: hand.palm.x * w, y: hand.palm.y * h }));
    const sats = handList.flatMap((hand, i) => satellites(hand, i, now, w, h));
    const handAlpha = handList.map((hand) => level * hand.vis);
    const webAlpha = level * Math.min(1, ...handList.map((hand) => hand.vis));
    const segments = [];
    const facets = [];

    handList.forEach((hand, hi) => {
      const alpha = handAlpha[hi];
      if (alpha <= 0.001) return;

      const rawPoints = hand.points || hand.targetPoints || [];
      const pts = rawPoints.map((p) => ({
        x: p.x * w,
        y: p.y * h,
      }));

      // Fallback if landmark points are fewer than 21
      if (pts.length < 21) {
        tipSets.push(hand.tips.map((p) => ({ x: p.x * w, y: p.y * h, ext: p.ext ?? 1 })));
        return;
      }

      const extList = hand.ext || [1, 1, 1, 1, 1];
      const tips = TIP_IDS.map((tipIdx, fi) => ({
        x: pts[tipIdx].x,
        y: pts[tipIdx].y,
        ext: extList[fi] ?? 1,
        fingerIdx: fi,
      }));
      tipSets.push(tips);

      // Collect knuckles & joints for sleek joint node rendering
      const joints = KNUCKLE_INDICES.map((ki) => pts[ki]);
      jointSets.push(joints);

      const palm = palms[hi];

      // 1. Palm Arch Chassis: glowing foundation connecting palm knuckles
      PALM_ARCH_BONES.forEach(([a, b]) => {
        segments.push([pts[a], pts[b], 0.75 * alpha]);
      });

      // 2. Anatomical Finger Bones: perfectly tracking along each finger joint
      FINGER_CHAINS.forEach((chain, fi) => {
        const ext = extList[fi] ?? 1;
        const boneAlpha = alpha * (0.35 + 0.65 * ext);
        for (let j = 0; j < chain.length - 1; j += 1) {
          const p1 = pts[chain[j]];
          const p2 = pts[chain[j + 1]];
          const segAlpha = j === chain.length - 2 ? 0.95 * boneAlpha : 0.85 * boneAlpha;
          segments.push([p1, p2, segAlpha]);
        }
      });

      // 3. Sci-Fi Holographic Web between adjacent open fingertips & knuckles
      for (let fi = 0; fi < 4; fi += 1) {
        const tA = tips[fi];
        const tB = tips[fi + 1];
        const pairExt = (tA.ext ?? 1) * (tB.ext ?? 1);
        if (pairExt > 0.1) {
          segments.push([tA, tB, 0.75 * alpha * pairExt]);
          const mcpA = pts[FINGER_CHAINS[fi][1]];
          const mcpB = pts[FINGER_CHAINS[fi + 1][1]];
          facets.push([mcpA, tA, tB, (handList.length >= 2 ? 0.08 : 0.14) * alpha * pairExt]);
          facets.push([palm, mcpA, mcpB, 0.06 * alpha]);
        }
      }
    });

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

    // Orbiting satellite ring around palm base
    if (sats.length >= 2) {
      for (let i = 0; i < sats.length; i += 1) {
        const s1 = sats[i];
        const s2 = sats[(i + 1) % sats.length];
        segments.push([s1, s2, 0.22 * level]);
      }
    }

    return {
      tipSets,
      jointSets,
      palms,
      sats,
      segments,
      facets,
      handAlpha,
      sizes: handList.map((x) => x.size),
    };
  }

  function createPlexusRenderer() {
    const particles = FX.createParticles();
    const gestures = FX.createGestureManager ? FX.createGestureManager() : null;
    let hands = new Map();
    let rawDetected = [];
    let level = 1;
    let target = 1;
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
      const nextTarget = on ? 1 : 0;
      if (nextTarget === target) return;
      target = nextTarget;
      if (!on) {
        level = 0;
      }
      const origins = geom.tipSets.flat().filter((p) => (p.ext ?? 1) > 0.2);
      const center = [{ x: frame.w / 2, y: frame.h / 2 }];
      if (on && els().shards?.on) particles.burstShards(origins.length ? origins : center, scale(), 60);
      if (!on && els().dust?.on) particles.dustAlong(geom.segments, DISSOLVE_DUST, scale(), true);
    }

    function update(now, nextSettings, w, h) {
      settings = nextSettings || settings;
      frame = { w, h };
      if (settings.enabled === false) {
        target = 0;
        level = 0;
        return;
      }
      if (target === 0) target = 1;
      const dt = lastTick === null ? 0 : Math.min((now - lastTick) / 1000, 0.08);
      lastTick = now;
      const step = (dt * 1000) / FADE_MS;
      level = target > level ? Math.min(target, level + step) : Math.max(target, level - step);

      // Adaptive continuous interpolation towards target positions & finger extensions
      // Eliminates smoothing lag when hand moves while filtering webcam jitter when still
      const extFactor = 1 - Math.exp(-dt * 26);

      hands = new Map(
        [...hands]
          .filter(([, hd]) => now - hd.seenAt < HAND_TIMEOUT_MS)
          .map(([k, hd]) => {
            const visible = now - hd.seenAt < 340 ? 1 : 0;
            const updatedExt = (hd.ext || [1, 1, 1, 1, 1]).map((val, i) =>
              lerp(val, hd.targetExt ? hd.targetExt[i] : 1, extFactor)
            );
            const rawPts = hd.targetPoints || [];
            const prevPts = hd.points || rawPts;
            const updatedPoints = rawPts.map((tp, i) =>
              smoothPoint(prevPts[i] || tp, tp, dt)
            );
            const updatedTips = TIP_IDS.map((tipId, i) => {
              const pt = updatedPoints[tipId] || { x: 0.5, y: 0.5 };
              return {
                x: pt.x,
                y: pt.y,
                z: pt.z,
                ext: updatedExt[i] ?? 1,
              };
            });
            const updatedPalm = smoothPoint(hd.palm, hd.targetPalm, dt);
            const updatedSize = lerp(hd.size, hd.targetSize, Math.min(1, dt * 14));
            return [
              k,
              {
                ...hd,
                ext: updatedExt,
                points: updatedPoints,
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

      const gameFocus = Boolean(settings.targetGame?.on && settings.targetGame?.focusMode !== false);
      if (target === 1 && dt > 0 && !gameFocus) {
        if (els().dust?.on) {
          const dustRate = settings.ecoMode ? DUST_PER_SECOND * 0.15 : DUST_PER_SECOND;
          const n = Math.floor(dustRate * dt + Math.random());
          if (n > 0) particles.dustAlong(geom.segments, n, scale());
        }
        if (!settings.ecoMode) {
          list.forEach((hand, i) => {
            if (hand.speed > 0.015 && Math.random() < hand.speed * 20) {
              const openTips = geom.tipSets[i]?.filter((p) => p.ext > 0.25) || [];
              if (openTips.length > 0) {
                const tip = openTips[Math.floor(Math.random() * openTips.length)];
                if (els().shards?.on) particles.shedShard(tip.x, tip.y, scale());
                if (els().dust?.on) particles.dustAt([tip], 5, scale());
              }
            }
          });
        }
      }
      particles.update(dt, scale(), now);
      if (gestures && target > 0) gestures.update(rawDetected, now, settings, w, h);
    }

    function isIdle() {
      if (settings.enabled === false || (level === 0 && target === 0)) return true;
      const gActive = Boolean(
        (settings.gestures?.on && (rawDetected.length > 0 || level > 0)) ||
        settings.airDraw?.on ||
        settings.targetGame?.on
      );
      return level === 0 && target === 0 && particles.count() === 0 && !gActive;
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
        if (sprite) {
          const hr = radius * 3.5;
          ctx.globalAlpha = alpha * 0.5;
          ctx.drawImage(sprite, p.x - hr, p.y - hr, hr * 2, hr * 2);
          ctx.globalAlpha = 1;
        }
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

      if (e.triangles?.on && geom.facets.length) {
        if (settings.ecoMode) {
          ctx.fillStyle = `rgba(${triRgb}, 0.12)`;
          ctx.beginPath();
          geom.facets.forEach(([a, b, c]) => {
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
          });
          ctx.fill();
        } else {
          geom.facets.forEach((f) => fill(ctx, f, triRgb, glowRgb));
        }
      }
      if (e.glow?.on && !settings.ecoMode) strokeBatched(ctx, geom.segments, glowRgb, 6.5 * unit * audioPulse, 0.38);
      if (e.lines?.on) strokeBatched(ctx, geom.segments, lineRgb, (settings.ecoMode ? 1.5 : 1.8) * unit * audioPulse, 0.96);
      if (e.nodes?.on) {
        const haloOn = Boolean(e.glow?.on && !settings.ecoMode);
        geom.sats.forEach((p) => drawNode(ctx, p, 1.6 * unit, 0.6 * level, nodeRgb, unit, haloOn));
        geom.jointSets?.forEach((joints, hi) =>
          joints.forEach((p) => {
            const nodeAlpha = geom.handAlpha[hi] * 0.75;
            drawNode(ctx, p, 2.0 * unit, nodeAlpha, nodeRgb, unit, haloOn);
          }));
        geom.tipSets.forEach((tips, hi) =>
          tips.forEach((p) => {
            if ((p.ext ?? 1) < 0.08) return;
            const ext = p.ext ?? 1;
            const nodeAlpha = geom.handAlpha[hi] * ext;
            const nodeRadius = 3.4 * unit * (0.45 + 0.55 * ext);
            drawNode(ctx, p, nodeRadius, nodeAlpha, nodeRgb, unit, haloOn);
          }));
      }
    }

    function draw(ctx, w, h, now = performance.now()) {
      if (settings.enabled === false || (target === 0 && level === 0)) return;
      const unit = Math.min(w, h) / 720;
      const e = els();
      const isRainbow = settings.rainbow?.on;
      const rSpeed = settings.rainbow?.speed || 1;
      const dustRgb = isRainbow ? rainbowRgb(now, 240, rSpeed) : rgb(e.dust?.color || '#d6c4ff');
      const shardsRgb = isRainbow ? rainbowRgb(now, 300, rSpeed) : rgb(e.shards?.color || '#ffffff');
      const gameFocus = Boolean(settings.targetGame?.on && settings.targetGame?.focusMode !== false);

      ctx.save();
      if (!gameFocus) {
        ctx.globalCompositeOperation = 'lighter';
        drawWeb(ctx, unit, now);
        if (e.dust?.on) particles.drawDust(ctx, unit, dustRgb);
        ctx.globalCompositeOperation = 'source-over';
        if (e.shards?.on) {
          const triRgb = isRainbow ? rainbowRgb(now, 120, rSpeed) : rgb(e.triangles?.color || '#a878ff');
          particles.drawShards(ctx, unit, shardsRgb, triRgb);
        }
      } else {
        ctx.globalCompositeOperation = 'source-over';
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
      getGameStats: () => gestures?.getGameStats?.() || { score: 0, combo: 1, hits: 0 },
      resetGame: () => gestures?.resetGame?.(),
    };
  }

  FX.createPlexusRenderer = createPlexusRenderer;
  FX.getFingerExtensions = getFingerExtensions;
  if (typeof module !== 'undefined') module.exports = { createPlexusRenderer, getFingerExtensions };
})();
