// Gesture recognition and effects: Peace sign confetti, Thumbs Up fireworks,
// Heart sign floaters, Doctor Strange mystic mandala shields, Energy/Plasma ball,
// and Air Drawing (Air Canvas) via fingertip tracking.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});
  const S = () => globalThis.__plexusSettings || {};
  const rgb = (hex) => (S().rgb ? S().rgb(hex) : '255, 255, 255');
  const rainbowRgb = (now, offset, speed) =>
    (S().rainbowRgb ? S().rainbowRgb(now, offset, speed) : '255, 255, 255');

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => a + (b - a) * t;

  function createGestureManager() {
    // Air drawing state
    let strokes = []; // { points: [{x, y, t}], color, size }
    let currentStroke = null;
    let lastDrawPoint = null;

    // Gesture particles
    let confetti = []; // { x, y, vx, vy, rot, spin, color, size, life, decay }
    let floaters = []; // { x, y, vx, vy, size, life, decay, type, color, scale }
    let sparks = [];   // { x, y, vx, vy, color, size, life, decay }

    // Active continuous gesture states (for smooth fade in/out)
    let shieldAlpha = { left: 0, right: 0 };
    let shieldPositions = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    let shieldRadii = { left: 60, right: 60 };
    let energyBallAlpha = 0;
    let energyCenter = { x: 0, y: 0 };
    let energyRadius = 40;

    // Anime & Superhero continuous states
    let chidoriAlpha = { left: 0, right: 0 };
    let chidoriPositions = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    let chidoriRadii = { left: 50, right: 50 };
    let superSaiyanAlpha = 0;
    let laserSwordAlpha = { left: 0, right: 0 };
    let laserSwordAngles = { left: 0, right: 0 };
    let laserSwordPositions = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };

    // Spider-Man webs (stuck to screen glass & projectiles)
    let screenWebs = [];
    let webProjectiles = [];

    // Finger Gun Shooting Game State
    let gameScore = 0;
    let gameCombo = 1;
    let lastHitTime = 0;
    let targetsPopped = 0;
    let balloons = []; // { id, x, y, vx, vy, radius, color, seed, wobble }
    let bullets = []; // { x, y, vx, vy, angle, life, length }
    let scorePopups = []; // { x, y, text, alpha, life, vy, color }
    let muzzleFlashes = []; // { x, y, radius, alpha, color }
    let gunStates = { left: 'idle', right: 'idle' };
    let gunActive = { left: false, right: false };
    let gunAngles = { left: 0, right: 0 };
    let gunTipPositions = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    let lastGunFireAt = { left: 0, right: 0 };
    let lastBalloonSpawnAt = 0;

    // Trigger cooldowns to prevent spamming single-shot bursts
    let lastPeaceAt = 0;
    let lastThumbAt = 0;
    let lastHeartAt = 0;
    let lastWebShootAt = 0;
    let lastChidoriSoundAt = 0;
    let lastSaberSoundAt = 0;
    let lastSaiyanSoundAt = 0;

    // Cooldown duration
    const BURST_COOLDOWN_MS = 1200;
    let allowBlur = true;

    function clearDrawings() {
      strokes = [];
      currentStroke = null;
      screenWebs = [];
      webProjectiles = [];
      balloons = [];
      bullets = [];
      scorePopups = [];
      muzzleFlashes = [];
      gameScore = 0;
      gameCombo = 1;
      targetsPopped = 0;
    }

    // Single hand gesture detection
    function analyzeHand(hand, aspect) {
      const lm = hand.landmarks;
      if (!lm || lm.length < 21) return null;

      const toPt = (i) => ({ x: lm[i][0] * aspect, y: lm[i][1] });
      const wrist = toPt(0);
      const thumbTip = toPt(4);
      const thumbIp = toPt(3);
      const indexTip = toPt(8);
      const indexPip = toPt(6);
      const indexMcp = toPt(5);
      const middleTip = toPt(12);
      const middlePip = toPt(10);
      const middleMcp = toPt(9);
      const ringTip = toPt(16);
      const ringPip = toPt(14);
      const ringMcp = toPt(13);
      const pinkyTip = toPt(20);
      const pinkyPip = toPt(18);
      const pinkyMcp = toPt(17);

      const hSize = dist(wrist, middleMcp);
      if (hSize < 0.001) return null;

      // Finger extended: tip is further from wrist than PIP (unified threshold eliminates dead zone)
      const indexExt = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.12;
      const middleExt = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.12;
      const ringExt = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.12;
      const pinkyExt = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.12;

      // Finger curled: not extended
      const ringCurled = !ringExt;
      const pinkyCurled = !pinkyExt;
      const indexCurled = !indexExt;
      const middleCurled = !middleExt;
      const thumbCurled = dist(thumbTip, middleMcp) < 0.65 * hSize;
      const thumbExt = !thumbCurled;

      const tipGap = dist(indexTip, middleTip);
      const swordGapMax = Math.max(0.042 * aspect, 0.44 * hSize);

      // Peace: Index + Middle extended, Ring + Pinky curled, gap between tips is wide
      const isPeace = indexExt && middleExt && ringCurled && pinkyCurled &&
        tipGap > swordGapMax;

      // Laser Sword (Lightsaber): Index + Middle extended together
      const isSword = indexExt && middleExt && ringCurled && pinkyCurled &&
        tipGap <= swordGapMax;

      // Thumbs Up: Thumb pointing up (tip y significantly lower than wrist y), others curled
      const thumbUp = (wrist.y - thumbTip.y) > 0.42 * hSize &&
        (indexMcp.y - thumbTip.y) > 0.22 * hSize &&
        dist(thumbTip, indexMcp) > 0.45 * hSize;
      const isThumbsUp = thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled;

      // Chidori (Naruto Lightning Fist): All 4 fingers curled and not thumbs-up
      const isFist = indexCurled && middleCurled && ringCurled && pinkyCurled && !isThumbsUp;

      // Spider-Man (🤟): Index and Pinky extended; Middle and Ring curled
      const isSpiderMan = indexExt && pinkyExt && middleCurled && ringCurled;

      // Open Palm: All 4 fingers extended outward (natural open hand, even if thumb is relaxed)
      const isOpenPalm = indexExt && middleExt && ringExt && pinkyExt &&
        dist(indexTip, pinkyTip) > 0.35 * hSize;

      // Pinch: Thumb tip very close to Index tip
      const isPinch = dist(thumbTip, indexTip) < 0.24 * hSize;

      // Pointing (Air draw trigger): Index extended, Middle/Ring/Pinky curled
      const isPoint = indexExt && middleCurled && ringCurled && pinkyCurled;

      // 🔫 Finger Gun (Index extended, Middle/Ring/Pinky curled)
      const isGunShape = indexExt && middleCurled && ringCurled && pinkyCurled;
      const thumbDistRatio = dist(thumbTip, indexMcp) / hSize;
      // Thumb UP (cocked hammer) vs Thumb DOWN (trigger pull)
      const thumbCocked = isGunShape && (thumbDistRatio >= 0.38 || (wrist.y - thumbTip.y > 0.34 * hSize && thumbTip.y < indexMcp.y - 0.06 * hSize));
      const thumbPulled = isGunShape && !thumbCocked;
      const barrelAngle = Math.atan2(indexTip.y - indexMcp.y, indexTip.x - indexMcp.x);

      // Direction vector for laser sword blade
      const swordMidTip = { x: (indexTip.x + middleTip.x) / 2, y: (indexTip.y + middleTip.y) / 2 };
      const swordMidPip = { x: (indexPip.x + middlePip.x) / 2, y: (indexPip.y + middlePip.y) / 2 };
      const swordAngle = Math.atan2(swordMidTip.y - swordMidPip.y, swordMidTip.x - swordMidPip.x);

      // Palm center & normalized raw points
      const rawPalm = {
        x: (lm[0][0] + lm[5][0] + lm[9][0] + lm[17][0]) / 4,
        y: (lm[0][1] + lm[5][1] + lm[9][1] + lm[17][1]) / 4,
      };

      return {
        isPeace,
        isThumbsUp,
        isOpenPalm,
        isPinch,
        isPoint,
        isSword,
        isFist,
        isSpiderMan,
        isGunShape,
        thumbCocked,
        thumbPulled,
        barrelAngle,
        swordAngle,
        swordMidTip,
        hSize,
        wrist,
        thumbTip: { x: lm[4][0], y: lm[4][1] },
        indexTip: { x: lm[8][0], y: lm[8][1] },
        palm: rawPalm,
      };
    }

    function spawnConfetti(origin, count = 35) {
      const colors = ['#ff3366', '#33ccff', '#ffcc00', '#33ff99', '#cc33ff', '#ff9933'];
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
        const speed = 180 + Math.random() * 320;
        confetti.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 120,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 12,
          w: 8 + Math.random() * 8,
          h: 5 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
          decay: 0.35 + Math.random() * 0.45,
        });
      }
      FX.playSound?.('gesture');
    }

    function spawnFireworks(origin, count = 28) {
      const colors = ['#ffd700', '#ffaa00', '#ff4500', '#ffff88', '#ffffff'];
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 240;
        sparks.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 60,
          size: 2.5 + Math.random() * 3.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
          decay: 0.45 + Math.random() * 0.6,
        });
      }
      // Floating thumbs up badge
      floaters.push({
        x: origin.x,
        y: origin.y - 20,
        vx: 0,
        vy: -45,
        size: 32,
        life: 1,
        decay: 0.4,
        type: 'thumb',
        color: '#ffcc00',
      });
      FX.playSound?.('gesture');
    }

    function spawnHearts(origin, count = 4) {
      for (let i = 0; i < count; i += 1) {
        floaters.push({
          x: origin.x + (Math.random() - 0.5) * 50,
          y: origin.y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 40,
          vy: -60 - Math.random() * 50,
          size: 24 + Math.random() * 20,
          life: 1,
          decay: 0.35 + Math.random() * 0.25,
          type: 'heart',
          color: '#ff2d75',
        });
      }
      FX.playSound?.('gesture');
    }

    function spawnSpiderWeb(origin, w, h) {
      // Dynamic target on screen glass
      const targetX = w * (0.22 + Math.random() * 0.56);
      const targetY = h * (0.16 + Math.random() * 0.45);

      // Web projectile tracer (high-speed conical web line from hand to screen)
      webProjectiles.push({
        sx: origin.x,
        sy: origin.y,
        tx: targetX,
        ty: targetY,
        progress: 0,
        speed: 6.5,
      });

      // Spider web splat stuck on screen glass
      const spokes = 10;
      const rings = 5;
      const maxR = 125 + Math.random() * 65;
      const dripCount = 3;
      const drips = Array.from({ length: dripCount }, (_, i) => ({
        spokeIdx: 3 + i,
        length: 25 + Math.random() * 45,
      }));

      screenWebs.push({
        x: targetX,
        y: targetY,
        radius: 20,
        maxRadius: maxR,
        alpha: 1,
        life: 1,
        decay: 0.28, // lasts ~3.5 seconds
        rotation: Math.random() * Math.PI,
        spokes,
        rings,
        drips,
      });

      // Impact sparks
      for (let i = 0; i < 16; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        sparks.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          size: 2.2,
          color: '#00ffff',
          life: 1,
          decay: 1.2,
        });
      }
    }

    function update(detectedHands, now, settings, w, h) {
      const aspect = w / h;
      const gConfig = settings.gestures || {};
      const gesturesActive = Boolean(gConfig.on);
      const gameOn = Boolean(settings.targetGame?.on);
      const gameFocus = gameOn && (settings.targetGame?.focusMode !== false);
      const fxAllowed = gesturesActive && !gameFocus;
      const partyAllowed = fxAllowed && (gConfig.party !== false);
      const gunAllowed = gameOn || (gesturesActive && gConfig.fingerGun !== false);
      const dt = 0.033; // ~30fps frame interval

      // 1. Analyze single hands
      const analyses = detectedHands.map((h) => analyzeHand(h, aspect)).filter(Boolean);

      if (analyses.length === 0) {
        gunStates.left = 'idle';
        gunStates.right = 'idle';
        gunActive.left = false;
        gunActive.right = false;
        currentStroke = null;
      }
      if (analyses.length === 0 || !fxAllowed) {
        chidoriAlpha.left = lerp(chidoriAlpha.left, 0, 0.25);
        chidoriAlpha.right = lerp(chidoriAlpha.right, 0, 0.25);
        laserSwordAlpha.left = lerp(laserSwordAlpha.left, 0, 0.25);
        laserSwordAlpha.right = lerp(laserSwordAlpha.right, 0, 0.25);
        shieldAlpha.left = lerp(shieldAlpha.left, 0, 0.25);
        shieldAlpha.right = lerp(shieldAlpha.right, 0, 0.25);
        energyBallAlpha = lerp(energyBallAlpha, 0, 0.25);
        superSaiyanAlpha = lerp(superSaiyanAlpha, 0, 0.25);
      }

      // Check single-hand gestures
      analyses.forEach((a, idx) => {
        const px = a.indexTip.x * w;
        const py = a.indexTip.y * h;
        const sideKey = idx === 0 ? 'left' : 'right';
        const handPixelSize = (a.hSize / Math.max(0.5, aspect)) * Math.min(w, h);

        // Peace sign
        if (partyAllowed && gConfig.peace !== false && a.isPeace && now - lastPeaceAt > BURST_COOLDOWN_MS) {
          lastPeaceAt = now;
          spawnConfetti({ x: px, y: py });
        }

        // Thumbs Up
        if (partyAllowed && gConfig.thumbsUp !== false && a.isThumbsUp && now - lastThumbAt > BURST_COOLDOWN_MS) {
          lastThumbAt = now;
          spawnFireworks({ x: a.thumbTip.x * w, y: a.thumbTip.y * h });
        }

        // Mystic shield on open palm
        const wantShield = fxAllowed && gConfig.mysticShield !== false && a.isOpenPalm;
        shieldAlpha[sideKey] = lerp(shieldAlpha[sideKey], wantShield ? 1 : 0, 0.18);
        shieldPositions[sideKey] = { x: a.palm.x * w, y: a.palm.y * h };
        shieldRadii[sideKey] = Math.max(50, handPixelSize * 1.35);

        // ⚡ Chidori (Naruto Lightning Fist)
        const wantChidori = fxAllowed && gConfig.chidori !== false && a.isFist;
        chidoriAlpha[sideKey] = lerp(chidoriAlpha[sideKey], wantChidori ? 1 : 0, 0.22);
        chidoriPositions[sideKey] = { x: a.palm.x * w, y: a.palm.y * h };
        chidoriRadii[sideKey] = Math.max(45, handPixelSize * 0.95);
        if (wantChidori && now - lastChidoriSoundAt > 1400) {
          lastChidoriSoundAt = now;
          FX.playSound?.('chidori');
        }

        // 🕸️ Spider-Man Web Shoot (🤟)
        if (fxAllowed && gConfig.spiderWeb !== false && a.isSpiderMan && now - lastWebShootAt > 850) {
          lastWebShootAt = now;
          spawnSpiderWeb({ x: a.palm.x * w, y: a.palm.y * h }, w, h);
          FX.playSound?.('web');
        }

        // ⚔️ Laser Sword / Lightsaber
        const wantSword = fxAllowed && gConfig.laserSword !== false && a.isSword;
        laserSwordAlpha[sideKey] = lerp(laserSwordAlpha[sideKey], wantSword ? 1 : 0, 0.22);
        if (wantSword) {
          laserSwordAngles[sideKey] = a.swordAngle;
          laserSwordPositions[sideKey] = {
            x: (a.swordMidTip.x / aspect) * w,
            y: a.swordMidTip.y * h,
          };
          if (now - lastSaberSoundAt > 1800) {
            lastSaberSoundAt = now;
            FX.playSound?.('saber');
          }
        }

        // 🔫 Finger Gun (shooting laser bullets)
        if (gunAllowed && a.isGunShape) {
          gunActive[sideKey] = true;
          gunAngles[sideKey] = a.barrelAngle;
          gunTipPositions[sideKey] = { x: px, y: py };

          const fireBullet = () => {
            lastGunFireAt[sideKey] = now;
            let ang = a.barrelAngle;
            // In Target Game mode, gently assist aim toward nearest balloon within cone
            if (gameOn && balloons.length > 0) {
              let bestB = null;
              let bestDist = Infinity;
              balloons.forEach((b) => {
                const d = dist({ x: px, y: py }, { x: b.x + (b.wobble || 0), y: b.y });
                if (d < bestDist) {
                  bestDist = d;
                  bestB = b;
                }
              });
              if (bestB && bestDist < Math.max(w, h) * 0.55) {
                const targetAng = Math.atan2(bestB.y - py, (bestB.x + (bestB.wobble || 0)) - px);
                const diff = Math.atan2(Math.sin(targetAng - ang), Math.cos(targetAng - ang));
                if (Math.abs(diff) < 0.85) {
                  ang = targetAng;
                }
              }
            }
            const spd = 1650;
            bullets.push({
              x: px,
              y: py,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              angle: ang,
              life: 1,
              length: 36,
            });
            muzzleFlashes.push({
              x: px,
              y: py,
              radius: 26,
              alpha: 1,
              color: '#00ffff',
            });
            FX.playSound?.('laserGun');
          };

          if (a.thumbCocked && gunStates[sideKey] !== 'cocked') {
            gunStates[sideKey] = 'cocked';
          } else if (a.thumbPulled && gunStates[sideKey] === 'cocked' && now - lastGunFireAt[sideKey] > 240) {
            gunStates[sideKey] = 'fired';
            fireBullet();
          } else if (gameOn && now - lastGunFireAt[sideKey] > 550) {
            // Auto-pulse laser in Target Game while holding Finger Gun pose
            fireBullet();
          }
        } else {
          gunStates[sideKey] = 'idle';
          gunActive[sideKey] = false;
        }

        // Air Drawing (isolated during gameFocus)
        if (settings.airDraw?.on && !gameFocus) {
          const isDrawing = a.isPoint || a.isPinch;
          const drawPt = { x: px, y: py, t: now };
          if (isDrawing) {
            if (!currentStroke) {
              currentStroke = {
                points: [drawPt],
                color: settings.airDraw.color || '#00ffff',
                size: (settings.airDraw.size || 5) * (Math.min(w, h) / 720),
              };
              strokes.push(currentStroke);
            } else {
              const last = currentStroke.points[currentStroke.points.length - 1];
              if (dist(last, drawPt) > 3) {
                currentStroke.points.push(drawPt);
              }
            }
            // Emit spark from drawing fingertip
            if (Math.random() < 0.6) {
              sparks.push({
                x: px,
                y: py,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                size: 2,
                color: settings.airDraw.color || '#00ffff',
                life: 1,
                decay: 1.5,
              });
            }
          } else {
            currentStroke = null;
          }
        }
      });

      // 2. Two-hand gestures
      if (analyses.length >= 2) {
        const [h1, h2] = analyses;
        const p1 = { x: h1.palm.x * w, y: h1.palm.y * h };
        const p2 = { x: h2.palm.x * w, y: h2.palm.y * h };
        const palmDist = dist(p1, p2);
        const avgSize = (h1.hSize + h2.hSize) * 0.5 * Math.min(w, h);

        // Heart gesture (both index tips close AND both thumb tips close)
        const i1 = { x: h1.indexTip.x * w, y: h1.indexTip.y * h };
        const i2 = { x: h2.indexTip.x * w, y: h2.indexTip.y * h };
        const t1 = { x: h1.thumbTip.x * w, y: h1.thumbTip.y * h };
        const t2 = { x: h2.thumbTip.x * w, y: h2.thumbTip.y * h };
        const indexDist = dist(i1, i2);
        const thumbDist = dist(t1, t2);

        if (partyAllowed && gConfig.heart !== false && indexDist < 0.45 * avgSize && thumbDist < 0.45 * avgSize &&
            now - lastHeartAt > BURST_COOLDOWN_MS) {
          lastHeartAt = now;
          spawnHearts({ x: (i1.x + i2.x) / 2, y: (i1.y + i2.y) / 2 }, 6);
        }

        // Energy / Plasma Ball (two hands facing each other)
        const wantBall = fxAllowed && gConfig.energyBall !== false &&
          palmDist > 0.55 * avgSize && palmDist < 2.6 * avgSize;
        energyBallAlpha = lerp(energyBallAlpha, wantBall ? 1 : 0, 0.14);
        energyCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        energyRadius = Math.max(30, palmDist * 0.32);

        // Shed energy sparks
        if (energyBallAlpha > 0.3 && Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          const r = energyRadius * (0.6 + Math.random() * 0.8);
          sparks.push({
            x: energyCenter.x + Math.cos(a) * r,
            y: energyCenter.y + Math.sin(a) * r,
            vx: (Math.random() - 0.5) * 90,
            vy: (Math.random() - 0.5) * 90,
            size: 2.5,
            color: '#33ccff',
            life: 1,
            decay: 1.8,
          });
        }

        // 🔥 Super Saiyan Aura (Dragon Ball Z power-up pose: hands spread apart)
        const rawHandSpan = Math.abs(h1.wrist.x - h2.wrist.x) / aspect;
        const isSpread = rawHandSpan > 0.28;
        const isChestHeight = h1.wrist.y > 0.10 && h1.wrist.y < 0.98 && h2.wrist.y > 0.10 && h2.wrist.y < 0.98;
        const wantSaiyan = fxAllowed && gConfig.superSaiyan !== false && isSpread && isChestHeight;
        superSaiyanAlpha = lerp(superSaiyanAlpha, wantSaiyan ? 1 : 0, 0.16);
        if (wantSaiyan && now - lastSaiyanSoundAt > 2800) {
          lastSaiyanSoundAt = now;
          FX.playSound?.('superSaiyan');
        }
      } else {
        energyBallAlpha = lerp(energyBallAlpha, 0, 0.2);
        shieldAlpha.right = lerp(shieldAlpha.right, 0, 0.25);
        chidoriAlpha.right = lerp(chidoriAlpha.right, 0, 0.25);
        laserSwordAlpha.right = lerp(laserSwordAlpha.right, 0, 0.25);
        gunStates.right = 'idle';
        gunActive.right = false;
        superSaiyanAlpha = lerp(superSaiyanAlpha, 0, 0.2);
      }

      // 3. Update particle systems
      confetti = confetti.filter((p) => {
        p.life -= p.decay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt; // gravity
        p.vx *= 0.98; // air drag
        p.rot += p.spin * dt;
        return p.life > 0 && p.y < h + 50;
      });

      sparks = sparks.filter((s) => {
        s.life -= s.decay * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.94;
        s.vy *= 0.94;
        return s.life > 0;
      });

      floaters = floaters.filter((f) => {
        f.life -= f.decay * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        return f.life > 0;
      });

      // Update screen webs
      screenWebs = screenWebs.filter((w) => {
        w.life -= w.decay * dt;
        w.alpha = Math.max(0, Math.min(1, w.life));
        w.radius = lerp(w.radius, w.maxRadius, 0.25);
        return w.life > 0;
      });

      // Update web projectiles
      webProjectiles = webProjectiles.filter((p) => {
        p.progress += p.speed * dt;
        return p.progress < 1;
      });

      // --- Finger Gun & Target Game Systems ---
      // Reset combo if no target hit for > 3.2s
      if (now - lastHitTime > 3200 && gameCombo > 1) {
        gameCombo = 1;
      }

      if (gameOn) {
        // Spawn floating neon cyber balloons
        const speedMul = (settings.targetGame?.speed === 'fast') ? 1.45 : 1.0;
        const maxBalloons = FX.isMobile ? 3 : 5;
        const spawnInterval = (FX.isMobile ? 2200 : 1600) / speedMul;
        const colors = ['#00ffff', '#ff007f', '#ffff00', '#00ff66', '#a878ff', '#ff8800'];
        if (balloons.length === 0) {
          // Immediately populate screen when game starts so user sees targets right away
          const initialCount = FX.isMobile ? 2 : 3;
          for (let i = 0; i < initialCount; i += 1) {
            const col = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
            balloons.push({
              id: Math.random(),
              x: w * (0.2 + (i * 0.28) + (Math.random() - 0.5) * 0.1),
              y: h * (0.45 + Math.random() * 0.35),
              vx: (Math.random() - 0.5) * 45 * speedMul,
              vy: (-75 - Math.random() * 65) * speedMul,
              radius: (26 + Math.random() * 10) * (Math.min(w, h) / 720),
              color: col,
              seed: Math.random() * 100,
            });
          }
          lastBalloonSpawnAt = now;
        } else if (balloons.length < maxBalloons && now - lastBalloonSpawnAt > spawnInterval) {
          lastBalloonSpawnAt = now;
          const col = colors[Math.floor(Math.random() * colors.length)];
          balloons.push({
            id: Math.random(),
            x: w * (0.15 + Math.random() * 0.7),
            y: h + 30,
            vx: (Math.random() - 0.5) * 45 * speedMul,
            vy: (-75 - Math.random() * 65) * speedMul,
            radius: (26 + Math.random() * 10) * (Math.min(w, h) / 720),
            color: col,
            seed: Math.random() * 100,
          });
        }
      } else if (balloons.length > 0) {
        balloons = [];
      }

      // Update balloons
      balloons = balloons.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.wobble = Math.sin(now * 0.004 + b.seed) * 10;
        return b.y > -70 && b.x > -70 && b.x < w + 70;
      });

      // Update bullets and collision with balloons
      bullets = bullets.filter((bullet) => {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        let hit = false;
        for (let i = 0; i < balloons.length; i += 1) {
          const b = balloons[i];
          const bx = b.x + (b.wobble || 0);
          const by = b.y;
          const d = dist({ x: bullet.x, y: bullet.y }, { x: bx, y: by });
          if (d < b.radius + 14) {
            hit = true;
            balloons.splice(i, 1);
            targetsPopped += 1;

            if (now - lastHitTime < 3200) {
              gameCombo = Math.min(gameCombo + 1, 5);
            } else {
              gameCombo = 1;
            }
            lastHitTime = now;
            const pts = 100 * gameCombo;
            gameScore += pts;

            FX.playSound?.('balloonPop');
            scorePopups.push({
              x: bx,
              y: by,
              text: gameCombo > 1 ? `+${pts} (${gameCombo}x)` : `+${pts}`,
              alpha: 1,
              life: 1,
              vy: -60,
              color: b.color,
            });

            // Burst particle shower
            const burstCount = FX.isMobile ? 10 : 18;
            for (let k = 0; k < burstCount; k += 1) {
              const spdA = Math.random() * Math.PI * 2;
              const spd = 100 + Math.random() * 240;
              sparks.push({
                x: bx,
                y: by,
                vx: Math.cos(spdA) * spd,
                vy: Math.sin(spdA) * spd,
                size: 2.5 + Math.random() * 3,
                color: b.color,
                life: 1,
                decay: 1.3,
              });
            }
            break;
          }
        }

        const inBounds = bullet.x >= -60 && bullet.x <= w + 60 && bullet.y >= -60 && bullet.y <= h + 60;
        return !hit && inBounds;
      });

      // Update score popups
      scorePopups = scorePopups.filter((p) => {
        p.y += p.vy * dt;
        p.life -= 1.1 * dt;
        p.alpha = Math.max(0, p.life);
        return p.life > 0;
      });

      // Update muzzle flashes
      muzzleFlashes = muzzleFlashes.filter((f) => {
        f.alpha -= 9.0 * dt;
        return f.alpha > 0;
      });

      // Super Saiyan aura sparks (rising up rapidly)
      if (superSaiyanAlpha > 0.15 && Math.random() < 0.7) {
        sparks.push({
          x: Math.random() * w,
          y: h + 10,
          vx: (Math.random() - 0.5) * 80,
          vy: -350 - Math.random() * 450,
          size: 3 + Math.random() * 3.5,
          color: Math.random() < 0.65 ? '#ffea00' : '#ff9900',
          life: 1,
          decay: 0.8 + Math.random() * 0.5,
        });
      }

      // Chidori sparks (crackling around fist)
      ['left', 'right'].forEach((side) => {
        if (chidoriAlpha[side] > 0.2 && Math.random() < 0.6) {
          const fistPos = chidoriPositions[side];
          if (fistPos) {
            const a = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 160;
            sparks.push({
              x: fistPos.x,
              y: fistPos.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              size: 2.5,
              color: Math.random() < 0.7 ? '#00e5ff' : '#ffffff',
              life: 1,
              decay: 1.8,
            });
          }
        }
      });

      // Laser sword tip sparks
      ['left', 'right'].forEach((side) => {
        if (laserSwordAlpha[side] > 0.3 && Math.random() < 0.5) {
          const pos = laserSwordPositions[side];
          const ang = laserSwordAngles[side];
          const sLen = 300 * (Math.min(w, h) / 720);
          sparks.push({
            x: pos.x + Math.cos(ang) * sLen,
            y: pos.y + Math.sin(ang) * sLen,
            vx: (Math.random() - 0.5) * 120 + Math.cos(ang) * 50,
            vy: (Math.random() - 0.5) * 120 + Math.sin(ang) * 50,
            size: 2,
            color: '#ffffff',
            life: 1,
            decay: 2.2,
          });
        }
      });
    }

    // Drawing helper: Doctor Strange Mystic Mandala
    function drawMysticMandala(ctx, cx, cy, radius, alpha, now) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.translate(cx, cy);

      const rot1 = (now * 0.001) % (Math.PI * 2);
      const rot2 = (-now * 0.0015) % (Math.PI * 2);
      const gold = `rgba(255, 170, 40, ${alpha * 0.85})`;
      const glow = `rgba(255, 90, 10, ${alpha * 0.5})`;

      // Outer glow circle
      ctx.strokeStyle = glow;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer rune spokes (rotating forward)
      ctx.save();
      ctx.rotate(rot1);
      const spokes = 12;
      for (let i = 0; i < spokes; i += 1) {
        const a = (i * Math.PI * 2) / spokes;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (radius - 12), Math.sin(a) * (radius - 12));
        ctx.lineTo(Math.cos(a) * (radius + 6), Math.sin(a) * (radius + 6));
        ctx.stroke();
      }
      ctx.restore();

      // Middle rotating squares (rotating backwards)
      ctx.save();
      ctx.rotate(rot2);
      const sqR = radius * 0.68;
      for (let k = 0; k < 2; k += 1) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 4);
        ctx.strokeRect(-sqR / 2, -sqR / 2, sqR, sqR);
        ctx.restore();
      }
      ctx.restore();

      // Inner spinning core circle
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Central glowing orb
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.4);
      grad.addColorStop(0, `rgba(255, 230, 140, ${alpha * 0.6})`);
      grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Drawing helper: Energy / Plasma Ball (Rasengan)
    function drawEnergyBall(ctx, cx, cy, r, alpha, now) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.translate(cx, cy);

      // Core pulsating sphere
      const pulse = 1 + Math.sin(now * 0.008) * 0.12;
      const curR = r * pulse;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, curR * 1.5);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
      grad.addColorStop(0.35, `rgba(50, 200, 255, ${alpha * 0.75})`);
      grad.addColorStop(0.7, `rgba(20, 80, 255, ${alpha * 0.4})`);
      grad.addColorStop(1, 'rgba(0, 0, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, curR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Rotating plasma rings
      const rings = 3;
      for (let i = 0; i < rings; i += 1) {
        ctx.save();
        const spin = (now * 0.002 * (i % 2 === 0 ? 1 : -1)) + (i * Math.PI) / 3;
        ctx.rotate(spin);
        ctx.scale(1, 0.45);
        ctx.strokeStyle = `rgba(180, 240, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 1.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }

    // Drawing helper: Floating emojis (Hearts, Thumbs up)
    function drawHeart(ctx, x, y, size, alpha, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 30, size / 30);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = allowBlur ? 14 : 0;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-15, -20, -30, 5, 0, 25);
      ctx.bezierCurveTo(30, 5, 15, -20, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // Drawing helper: ⚡ Chidori / Lightning Fist (Naruto)
    function drawChidori(ctx, cx, cy, radius, alpha, now, settings) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.translate(cx, cy);

      const isEco = Boolean(settings?.ecoMode);
      // Core pulsating electrical sphere
      const pulse = 1 + Math.sin(now * 0.02) * 0.15;
      const curR = radius * pulse;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, curR * 1.6);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
      grad.addColorStop(0.25, `rgba(0, 229, 255, ${alpha * 0.85})`);
      grad.addColorStop(0.65, `rgba(0, 102, 255, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 30, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, curR * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Branching lightning bolts
      const boltCount = isEco ? 4 : 8;
      const segments = isEco ? 3 : 5;
      for (let i = 0; i < boltCount; i += 1) {
        const baseAngle = (i * Math.PI * 2) / boltCount + (Math.sin(now * 0.01 + i) * 0.3);
        const boltLen = curR * (1.2 + Math.sin(now * 0.025 + i * 2.3) * 0.6);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let s = 1; s <= segments; s += 1) {
          const t = s / segments;
          const a = baseAngle + ((Math.sin(now * 0.03 + s * 1.7 + i * 4.1) * 0.45));
          const r = boltLen * t;
          const nx = Math.cos(a) * r;
          const ny = Math.sin(a) * r;
          ctx.lineTo(nx, ny);

          // Sub-branch (skipped in Eco Mode)
          if (!isEco && s === 3) {
            ctx.moveTo(nx, ny);
            const branchA = a + (i % 2 === 0 ? 0.7 : -0.7);
            ctx.lineTo(nx + Math.cos(branchA) * (boltLen * 0.35), ny + Math.sin(branchA) * (boltLen * 0.35));
            ctx.moveTo(nx, ny);
          }
        }

        if (!isEco) {
          // Outer cyan glow
          ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.85})`;
          ctx.lineWidth = 4.5;
          ctx.stroke();
        }

        // Inner white hot core
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.lineWidth = isEco ? 2 : 1.8;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Drawing helper: 🕸️ Spider-Man Web on Screen Glass
    function drawSpiderWeb(ctx, web) {
      if (web.alpha <= 0.01) return;
      ctx.save();
      ctx.translate(web.x, web.y);
      ctx.rotate(web.rotation);

      const spokes = web.spokes;
      const rings = web.rings;
      const r = web.radius;
      const a = web.alpha;

      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = allowBlur ? 8 : 0;
      ctx.strokeStyle = `rgba(220, 245, 255, ${a * 0.9})`;
      ctx.lineWidth = 1.6;

      // 1. Radial spokes
      for (let i = 0; i < spokes; i += 1) {
        const ang = (i * Math.PI * 2) / spokes;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }

      // 2. Concentric web rings with sagging catenary curves
      for (let ring = 1; ring <= rings; ring += 1) {
        const ringR = (r * ring) / rings;
        ctx.beginPath();
        for (let i = 0; i <= spokes; i += 1) {
          const a1 = (i * Math.PI * 2) / spokes;
          const a2 = (((i + 1) % spokes) * Math.PI * 2) / spokes;
          const x1 = Math.cos(a1) * ringR;
          const y1 = Math.sin(a1) * ringR;
          const x2 = Math.cos(a2) * ringR;
          const y2 = Math.sin(a2) * ringR;
          const midA = (a1 + a2) / 2;
          const midR = ringR * 0.92;
          const cx = Math.cos(midA) * midR;
          const cy = Math.sin(midA) * midR;

          if (i === 0) ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(cx, cy, x2, y2);
        }
        ctx.stroke();
      }

      // 3. Central web knot
      ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.95})`;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // 4. Dewdrops at intersections
      ctx.fillStyle = `rgba(0, 240, 255, ${a * 0.8})`;
      for (let ring = 1; ring <= rings; ring += 1) {
        const ringR = (r * ring) / rings;
        for (let i = 0; i < spokes; i += 1) {
          const ang = (i * Math.PI * 2) / spokes;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * ringR, Math.sin(ang) * ringR, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Dripping strands
      if (web.drips && web.drips.length) {
        ctx.strokeStyle = `rgba(200, 240, 255, ${a * 0.75})`;
        ctx.lineWidth = 1.3;
        web.drips.forEach((drip) => {
          const spokeA = (drip.spokeIdx * Math.PI * 2) / spokes;
          const startX = Math.cos(spokeA) * r;
          const startY = Math.sin(spokeA) * r;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX, startY + drip.length);
          ctx.stroke();

          // Droplet at tip
          ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
          ctx.beginPath();
          ctx.arc(startX, startY + drip.length, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    }

    // Drawing helper: 🔥 Super Saiyan Aura (Dragon Ball Z)
    function drawSuperSaiyanAura(ctx, w, h, now, alpha, settings) {
      if (alpha <= 0.01) return;
      ctx.save();

      const isEco = Boolean(settings?.ecoMode);

      if (!isEco) {
        // Screen edge golden vignette pulse (skipped in Eco Mode)
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        vigGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
        vigGrad.addColorStop(0.7, `rgba(255, 170, 0, ${alpha * 0.18})`);
        vigGrad.addColorStop(1, `rgba(255, 120, 0, ${alpha * 0.4})`);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // Rising fiery Ki flame tongues from bottom of the screen
      const columns = isEco ? 6 : 16;
      const colWidth = w / columns;
      for (let i = 0; i < columns; i += 1) {
        const x = i * colWidth;
        const phase = now * 0.007 + i * 1.3;
        const flameH = (h * 0.45) + Math.sin(phase) * (h * 0.2) + Math.cos(phase * 1.7) * (h * 0.1);
        const flameW = colWidth * 1.4;

        if (isEco) {
          ctx.fillStyle = `rgba(255, 180, 20, ${alpha * 0.55})`;
        } else {
          const flameGrad = ctx.createLinearGradient(x, h, x, h - flameH);
          flameGrad.addColorStop(0, `rgba(255, 100, 0, ${alpha * 0.55})`);
          flameGrad.addColorStop(0.4, `rgba(255, 200, 0, ${alpha * 0.65})`);
          flameGrad.addColorStop(0.85, `rgba(255, 255, 120, ${alpha * 0.75})`);
          flameGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = flameGrad;
        }

        ctx.beginPath();
        ctx.moveTo(x - flameW * 0.3, h);
        const wave = Math.sin(now * 0.01 + i) * 20;
        ctx.quadraticCurveTo(x + wave, h - flameH * 0.6, x + colWidth * 0.5 + wave * 0.5, h - flameH);
        ctx.quadraticCurveTo(x + colWidth + wave * 0.2, h - flameH * 0.6, x + colWidth + flameW * 0.3, h);
        ctx.closePath();
        ctx.fill();
      }

      // Golden electric arcs (Super Saiyan 2 style)
      ctx.strokeStyle = `rgba(255, 250, 160, ${alpha * 0.85})`;
      ctx.lineWidth = isEco ? 1.8 : 2.5;
      const arcCount = isEco ? 2 : 3;
      for (let k = 0; k < arcCount; k += 1) {
        const lx = (w * (0.2 + k * 0.3)) + Math.sin(now * 0.015 + k * 3) * 60;
        const topY = h * (0.25 + Math.sin(now * 0.02 + k) * 0.2);
        ctx.beginPath();
        ctx.moveTo(lx, h);
        const segs = isEco ? 4 : 6;
        for (let s = 1; s <= segs; s += 1) {
          const sy = h - (h - topY) * (s / segs);
          const sx = lx + (Math.sin(now * 0.025 + s * 2 + k * 5) * 35);
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Drawing helper: ⚔️ Laser Sword / Lightsaber (Star Wars)
    function drawLaserSword(ctx, origin, angle, length, alpha, now, settings, unit) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(angle);

      const isRainbow = settings.rainbow?.on;
      const rSpeed = settings.rainbow?.speed || 1;
      const bladeColor = isRainbow
        ? rainbowRgb(now, 180, rSpeed)
        : (settings.elements?.glow?.color ? rgb(settings.elements.glow.color) : '0, 229, 255');

      const bLen = length;
      const bWidth = 14 * unit;

      // 1. Outer radiant glow bloom
      ctx.shadowColor = `rgb(${bladeColor})`;
      ctx.shadowBlur = allowBlur ? 24 * unit : 0;
      ctx.strokeStyle = `rgba(${bladeColor}, ${alpha * 0.4})`;
      ctx.lineWidth = bWidth * 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bLen, 0);
      ctx.stroke();

      // 2. Middle intense plasma aura
      ctx.strokeStyle = `rgba(${bladeColor}, ${alpha * 0.85})`;
      ctx.lineWidth = bWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bLen, 0);
      ctx.stroke();

      // 3. Inner blinding white-hot core
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = bWidth * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bLen, 0);
      ctx.stroke();

      // 4. Hilt plasma emitter ring
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(0, 0, bWidth * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Drawing helper: 🎈 Cyber Balloons (Target Game)
    function drawCyberBalloon(ctx, b, now, unit) {
      ctx.save();
      const cx = b.x + (b.wobble || 0);
      const cy = b.y;
      const r = b.radius;

      ctx.shadowColor = b.color;
      ctx.shadowBlur = allowBlur ? 16 * unit : 0;

      // Balloon body gradient
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.35, b.color);
      grad.addColorStop(0.85, 'rgba(15, 12, 28, 0.7)');
      grad.addColorStop(1, b.color);

      ctx.fillStyle = grad;
      ctx.strokeStyle = `rgba(255, 255, 255, 0.85)`;
      ctx.lineWidth = 2 * unit;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.28, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Tie knot
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(cx - 4 * unit, cy + r);
      ctx.lineTo(cx + 4 * unit, cy + r);
      ctx.lineTo(cx, cy + r + 6 * unit);
      ctx.closePath();
      ctx.fill();

      // Swaying string
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.2 * unit;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r + 6 * unit);
      const stringWave = Math.sin(now * 0.006 + b.seed) * 8 * unit;
      ctx.quadraticCurveTo(cx + stringWave, cy + r + 24 * unit, cx - stringWave * 0.5, cy + r + 45 * unit);
      ctx.stroke();

      // Inner glowing target cross
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.8 * unit;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy);
      ctx.lineTo(cx + r * 0.45, cy);
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.stroke();

      ctx.restore();
    }

    // Drawing helper: 🔫 Laser Bullets
    function drawLaserBullet(ctx, b, unit) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      const bLen = b.length * unit;
      const bW = 6 * unit;

      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = allowBlur ? 12 * unit : 0;

      // Outer neon trail
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.lineWidth = bW * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-bLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Inner white core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = bW;
      ctx.beginPath();
      ctx.moveTo(-bLen * 0.7, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      ctx.restore();
    }

    // Drawing helper: 🎯 Laser Sight Crosshair
    function drawAimSight(ctx, tip, angle, w, h, unit) {
      ctx.save();
      const crosshairDist = 260 * unit;
      const tx = tip.x + Math.cos(angle) * crosshairDist;
      const ty = tip.y + Math.sin(angle) * crosshairDist;

      // Dotted targeting laser line
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.4 * unit;
      ctx.setLineDash([6 * unit, 6 * unit]);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Neon reticle crosshair
      ctx.translate(tx, ty);
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = allowBlur ? 8 * unit : 0;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.lineWidth = 2 * unit;

      const r = 16 * unit;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair pips
      ctx.beginPath();
      ctx.moveTo(-r - 6 * unit, 0); ctx.lineTo(-r + 4 * unit, 0);
      ctx.moveTo(r - 4 * unit, 0); ctx.lineTo(r + 6 * unit, 0);
      ctx.moveTo(0, -r - 6 * unit); ctx.lineTo(0, -r + 4 * unit);
      ctx.moveTo(0, r - 4 * unit); ctx.lineTo(0, r + 6 * unit);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * unit, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Drawing helper: Muzzle Flash
    function drawMuzzleFlash(ctx, f, unit) {
      if (f.alpha <= 0.01) return;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = allowBlur ? 18 * unit : 0;

      const r = f.radius * unit * (0.8 + 0.4 * f.alpha);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI * 2) / 8;
        const curR = i % 2 === 0 ? r : r * 0.35;
        const x = Math.cos(a) * curR;
        const y = Math.sin(a) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Drawing helper: 🏆 Game Scoreboard
    function drawScoreboard(ctx, w, h, score, popped, combo, unit) {
      ctx.save();
      const badgeW = 340 * unit;
      const badgeH = 40 * unit;
      const bx = (w - badgeW) / 2;
      const by = 20 * unit;

      ctx.fillStyle = 'rgba(12, 10, 22, 0.88)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.6 * unit;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.35)';
      ctx.shadowBlur = allowBlur ? 12 * unit : 0;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, badgeW, badgeH, 12 * unit);
      } else {
        ctx.rect(bx, by, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = `bold ${Math.round(13 * unit)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textY = by + badgeH / 2;
      ctx.fillStyle = '#ffffff';
      const comboText = combo > 1 ? ` 🔥 ${combo}x` : '';
      ctx.fillText(`🎯 TARGETS: ${popped}   ⭐ SCORE: ${score}${comboText}`, w / 2, textY);

      ctx.restore();
    }

    // Drawing helper: Floating Score Indicators
    function drawScorePopups(ctx, unit) {
      if (!scorePopups.length) return;
      ctx.save();
      scorePopups.forEach((p) => {
        ctx.font = `bold ${Math.round(20 * unit)}px -apple-system, sans-serif`;
        ctx.fillStyle = p.color || '#ffff00';
        ctx.shadowColor = p.color || '#ffff00';
        ctx.shadowBlur = allowBlur ? 10 * unit : 0;
        ctx.globalAlpha = p.alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      });
      ctx.restore();
    }

    function draw(ctx, w, h, now, settings, smoothedHands) {
      ctx.save();
      const unit = Math.min(w, h) / 720;
      allowBlur = !FX.isMobile && !settings.ecoMode;

      // 0. 🔥 Super Saiyan Aura (DBZ Screen Flame Columns & Lightning)
      if (superSaiyanAlpha > 0.01) {
        drawSuperSaiyanAura(ctx, w, h, now, superSaiyanAlpha, settings);
      }

      // 1. Air Drawing strokes (Smooth Bézier canvas trails)
      if (strokes.length) {
        strokes.forEach((stroke) => {
          const pts = stroke.points;
          if (pts.length < 2) return;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = stroke.color;
          ctx.shadowBlur = allowBlur ? 10 : 0;

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i += 1) {
            const midX = (pts[i].x + pts[i + 1].x) * 0.5;
            const midY = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        });
      }

      // 2. Doctor Strange Mystic Shields on palms
      ['left', 'right'].forEach((sideKey, i) => {
        const a = shieldAlpha[sideKey];
        if (a > 0.01) {
          const hd = smoothedHands && smoothedHands[i];
          const cx = hd ? hd.palm.x * w : shieldPositions[sideKey].x;
          const cy = hd ? hd.palm.y * h : shieldPositions[sideKey].y;
          const r = hd ? Math.max(50, hd.size * Math.min(w, h) * 1.35) : shieldRadii[sideKey];
          drawMysticMandala(ctx, cx, cy, r, a, now);
        }
      });

      // 3. Energy / Plasma Ball (Rasengan)
      if (energyBallAlpha > 0.01) {
        drawEnergyBall(ctx, energyCenter.x, energyCenter.y, energyRadius, energyBallAlpha, now);
      }

      // 4. ⚡ Chidori (Naruto Lightning Fist)
      ['left', 'right'].forEach((sideKey, i) => {
        const ca = chidoriAlpha[sideKey];
        if (ca > 0.01) {
          const hd = smoothedHands && smoothedHands[i];
          const cx = hd ? hd.palm.x * w : chidoriPositions[sideKey].x;
          const cy = hd ? hd.palm.y * h : chidoriPositions[sideKey].y;
          const r = hd ? Math.max(45, hd.size * Math.min(w, h) * 0.95) : chidoriRadii[sideKey];
          drawChidori(ctx, cx, cy, r, ca, now, settings);
        }
      });

      // 5. ⚔️ Laser Sword / Lightsaber
      ['left', 'right'].forEach((sideKey) => {
        const sa = laserSwordAlpha[sideKey];
        if (sa > 0.01) {
          const pos = laserSwordPositions[sideKey];
          const ang = laserSwordAngles[sideKey];
          const sLen = 320 * unit;
          drawLaserSword(ctx, pos, ang, sLen, sa, now, settings, unit);
        }
      });

      // 6. 🕸️ Spider-Man Web Projectiles (Tracer threads from hand to screen)
      if (webProjectiles.length) {
        webProjectiles.forEach((p) => {
          const cx = lerp(p.sx, p.tx, p.progress);
          const cy = lerp(p.sy, p.ty, p.progress);
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = allowBlur ? 10 : 0;
          ctx.lineWidth = 3 * unit;
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(cx, cy);
          ctx.stroke();

          // Conical web spray
          ctx.lineWidth = 1.3 * unit;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
          for (let k = -2; k <= 2; k += 1) {
            if (k === 0) continue;
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(cx + k * 16 * unit, cy + k * 12 * unit);
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // 7. 🕸️ Spider-Man Screen Webs (Stuck on screen glass)
      if (screenWebs.length) {
        screenWebs.forEach((web) => drawSpiderWeb(ctx, web));
      }

      // 8. 🎯 Target Game: Cyber Balloons
      if (balloons.length) {
        balloons.forEach((b) => drawCyberBalloon(ctx, b, now, unit));
      }

      // 9. 🔫 Finger Gun: Laser Bullets & Muzzle Flashes
      if (bullets.length) {
        bullets.forEach((b) => drawLaserBullet(ctx, b, unit));
      }
      if (muzzleFlashes.length) {
        muzzleFlashes.forEach((f) => drawMuzzleFlash(ctx, f, unit));
      }

      // 10. 🎯 Finger Gun Aiming Crosshair
      ['left', 'right'].forEach((sideKey, i) => {
        if (gunActive[sideKey]) {
          const hd = smoothedHands && smoothedHands[i];
          const tip = (hd && hd.tips && hd.tips[1])
            ? { x: hd.tips[1].x * w, y: hd.tips[1].y * h }
            : gunTipPositions[sideKey];
          const ang = gunAngles[sideKey] || 0;
          drawAimSight(ctx, tip, ang, w, h, unit);
        }
      });

      // 11. Floating Score Popups
      if (scorePopups.length) {
        drawScorePopups(ctx, unit);
      }

      // 12. 🏆 Live Scoreboard (Top Screen)
      if (settings.targetGame?.on) {
        drawScoreboard(ctx, w, h, gameScore, targetsPopped, gameCombo, unit);
      }

      // 13. Confetti Particles
      if (confetti.length) {
        confetti.forEach((c) => {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rot);
          ctx.fillStyle = c.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.restore();
        });
      }

      // 14. Sparks
      if (sparks.length) {
        sparks.forEach((s) => {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, s.life));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 15. Floaters (Heart, Thumb)
      if (floaters.length) {
        floaters.forEach((f) => {
          if (f.type === 'heart') {
            drawHeart(ctx, f.x, f.y, f.size, f.life, f.color);
          } else if (f.type === 'thumb') {
            ctx.save();
            ctx.font = `${Math.round(f.size)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
            ctx.fillText('👍', f.x, f.y);
            ctx.restore();
          }
        });
      }

      ctx.restore();
    }

    function getGameStats() {
      return {
        score: gameScore,
        combo: gameCombo,
        hits: targetsPopped,
      };
    }

    function resetGame() {
      gameScore = 0;
      gameCombo = 1;
      targetsPopped = 0;
      balloons = [];
      bullets = [];
      scorePopups = [];
      muzzleFlashes = [];
    }

    const manager = {
      update,
      draw,
      clearDrawings,
      getGameStats,
      resetGame,
    };
    FX.activeGestures = manager;
    return manager;
  }

  FX.getGameStats = () => FX.activeGestures?.getGameStats?.() || { score: 0, combo: 1, hits: 0 };
  FX.resetGame = () => FX.activeGestures?.resetGame?.();
  FX.createGestureManager = createGestureManager;
  if (typeof module !== 'undefined') module.exports = { createGestureManager };
})();
