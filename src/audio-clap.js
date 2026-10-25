// Listens to a clone of the microphone for sharp, loud transients. These only
// count as claps when a hand was in view, and it takes two claps to toggle, so
// speech or desk bumps alone never toggle the effect.
// Also calculates audio energy for voice/music-reactive visual pulsing and provides
// synthesized UI sound effects.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});

  const POLL_MS = 20;
  const PEAK_MIN = 0.28;
  const RISE_FACTOR = 4;
  const REFRACTORY_MS = 150;

  FX.audioLevel = 0;
  FX.getAudioLevel = () => FX.audioLevel || 0;

  let audioOutputCtx = null;
  function getAudioOutputCtx() {
    if (!audioOutputCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioOutputCtx = new AudioCtx();
    }
    if (audioOutputCtx && audioOutputCtx.state === 'suspended') {
      audioOutputCtx.resume().catch(() => {});
    }
    return audioOutputCtx;
  }

  FX.playSound = (type) => {
    try {
      const ctx = getAudioOutputCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'on') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'off') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === 'gesture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.exponentialRampToValueAtTime(1174, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'chidori') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(2400, now + 0.08);
        osc.frequency.linearRampToValueAtTime(800, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'web') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'saber') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.02, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'superSaiyan') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.35);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (_) {}
  };

  function listenForTransients(track, onTransient) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let baseline = 0.02;
    let lastHit = -Infinity;

    const timer = setInterval(() => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      let energy = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        energy += v * v;
      }
      const rms = Math.sqrt(energy / buf.length);
      FX.audioLevel = FX.audioLevel * 0.65 + Math.min(1, rms * 12) * 0.35;

      const now = performance.now();
      if (peak >= PEAK_MIN && rms > baseline * RISE_FACTOR && now - lastHit > REFRACTORY_MS) {
        lastHit = now;
        onTransient(now);
      }
      baseline = baseline * 0.95 + rms * 0.05;
    }, POLL_MS);

    return () => {
      clearInterval(timer);
      FX.audioLevel = 0;
      track.stop();
      ctx.close().catch(() => {});
    };
  }

  FX.listenForTransients = listenForTransients;
})();
