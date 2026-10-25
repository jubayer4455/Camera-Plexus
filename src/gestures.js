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
    let energyBallAlpha = 0;
    let energyCenter = { x: 0, y: 0 };
    let energyRadius = 40;

    // Trigger cooldowns to prevent spamming single-shot bursts
    let lastPeaceAt = 0;
    let lastThumbAt = 0;
    let lastHeartAt = 0;

    // Cooldown duration
    const BURST_COOLDOWN_MS = 1200;

    function clearDrawings() {
      strokes = [];
      currentStroke = null;
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

      // Finger extended: tip is further from wrist than PIP
      const indexExt = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.15;
      const middleExt = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.15;
      const ringExt = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.15;
      const pinkyExt = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.15;

      // Finger curled: tip is close to MCP/wrist
      const ringCurled = dist(ringTip, wrist) < dist(ringPip, wrist) * 1.05;
      const pinkyCurled = dist(pinkyTip, wrist) < dist(pinkyPip, wrist) * 1.05;
      const indexCurled = dist(indexTip, wrist) < dist(indexPip, wrist) * 1.05;
      const middleCurled = dist(middleTip, wrist) < dist(middlePip, wrist) * 1.05;

      // Peace: Index + Middle extended, Ring + Pinky curled
      const isPeace = indexExt && middleExt && ringCurled && pinkyCurled &&
        dist(indexTip, middleTip) > 0.04 * aspect;

      // Thumbs Up: Thumb pointing up (tip y significantly lower than wrist y), others curled
      const thumbUp = (wrist.y - thumbTip.y) > 0.45 * hSize && (indexMcp.y - thumbTip.y) > 0.25 * hSize;
      const isThumbsUp = thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled;

      // Open Palm: All 4 fingers + thumb extended outward
      const isOpenPalm = indexExt && middleExt && ringExt && pinkyExt &&
        dist(thumbTip, pinkyTip) > 0.8 * hSize;

      // Pinch: Thumb tip very close to Index tip
      const isPinch = dist(thumbTip, indexTip) < 0.22 * hSize;

      // Pointing (Air draw trigger): Index extended, Middle/Ring/Pinky curled
      const isPoint = indexExt && middleCurled && ringCurled && pinkyCurled;

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

    function update(detectedHands, now, settings, w, h) {
      const aspect = w / h;
      const gConfig = settings.gestures || {};
      const gesturesActive = gConfig.on;
      const dt = 0.033; // ~30fps frame interval

      // 1. Analyze single hands
      const analyses = detectedHands.map((h) => analyzeHand(h, aspect)).filter(Boolean);

      // Check single-hand gestures
      analyses.forEach((a, idx) => {
        const px = a.indexTip.x * w;
        const py = a.indexTip.y * h;

        // Peace sign
        if (gesturesActive && gConfig.peace && a.isPeace && now - lastPeaceAt > BURST_COOLDOWN_MS) {
          lastPeaceAt = now;
          spawnConfetti({ x: px, y: py });
        }

        // Thumbs Up
        if (gesturesActive && gConfig.thumbsUp && a.isThumbsUp && now - lastThumbAt > BURST_COOLDOWN_MS) {
          lastThumbAt = now;
          spawnFireworks({ x: a.thumbTip.x * w, y: a.thumbTip.y * h });
        }

        // Mystic shield on open palm
        const sideKey = idx === 0 ? 'left' : 'right';
        const wantShield = gesturesActive && gConfig.mysticShield && a.isOpenPalm;
        shieldAlpha[sideKey] = lerp(shieldAlpha[sideKey], wantShield ? 1 : 0, 0.15);

        // Air Drawing
        if (settings.airDraw?.on) {
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

        if (gesturesActive && gConfig.heart && indexDist < 0.45 * avgSize && thumbDist < 0.45 * avgSize &&
            now - lastHeartAt > BURST_COOLDOWN_MS) {
          lastHeartAt = now;
          spawnHearts({ x: (i1.x + i2.x) / 2, y: (i1.y + i2.y) / 2 }, 6);
        }

        // Energy / Plasma Ball (two hands facing each other)
        const wantBall = gesturesActive && gConfig.energyBall &&
          palmDist > 0.6 * avgSize && palmDist < 2.4 * avgSize;
        energyBallAlpha = lerp(energyBallAlpha, wantBall ? 1 : 0, 0.12);
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
      } else {
        energyBallAlpha = lerp(energyBallAlpha, 0, 0.2);
        shieldAlpha.right = 0;
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
      ctx.shadowBlur = 14;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-15, -20, -30, 5, 0, 25);
      ctx.bezierCurveTo(30, 5, 15, -20, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    function draw(ctx, w, h, now, settings, smoothedHands) {
      ctx.save();

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
          ctx.shadowBlur = 10;

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
      if (smoothedHands && smoothedHands.length) {
        smoothedHands.forEach((hd, i) => {
          const sideKey = i === 0 ? 'left' : 'right';
          const a = shieldAlpha[sideKey];
          if (a > 0.01) {
            const cx = hd.palm.x * w;
            const cy = hd.palm.y * h;
            const r = Math.max(50, hd.size * Math.min(w, h) * 1.35);
            drawMysticMandala(ctx, cx, cy, r, a, now);
          }
        });
      }

      // 3. Energy / Plasma Ball
      if (energyBallAlpha > 0.01) {
        drawEnergyBall(ctx, energyCenter.x, energyCenter.y, energyRadius, energyBallAlpha, now);
      }

      // 4. Confetti Particles
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

      // 5. Sparks
      if (sparks.length) {
        sparks.forEach((s) => {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, s.life));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 6. Floaters (Heart, Thumb)
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

    return {
      update,
      draw,
      clearDrawings,
    };
  }

  FX.createGestureManager = createGestureManager;
})();
