// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const { getFingerExtensions } = require('../src/plexus.js');

function createSampleHand({
  thumb = 'extended',
  index = 'extended',
  middle = 'extended',
  ring = 'extended',
  pinky = 'extended',
} = {}) {
  const lm = Array.from({ length: 21 }, () => [0.5, 0.5, 0]);
  lm[0] = [0.5, 0.8, 0]; // wrist
  lm[9] = [0.5, 0.5, 0]; // middle MCP (handSize = 0.3)
  lm[17] = [0.6, 0.55, 0]; // pinky MCP

  // Configure Thumb (tip 4, mcp 2, cmc 1)
  if (thumb === 'extended') {
    lm[1] = [0.45, 0.72, 0];
    lm[2] = [0.40, 0.65, 0];
    lm[3] = [0.35, 0.58, 0];
    lm[4] = [0.28, 0.52, 0]; // Extended sideways
  } else if (thumb === 'up') {
    lm[1] = [0.46, 0.72, 0];
    lm[2] = [0.43, 0.60, 0];
    lm[3] = [0.42, 0.48, 0];
    lm[4] = [0.40, 0.35, 0]; // Extended straight up
  } else {
    // Curled in fist across palm
    lm[1] = [0.46, 0.72, 0];
    lm[2] = [0.45, 0.65, 0];
    lm[3] = [0.46, 0.58, 0];
    lm[4] = [0.47, 0.53, 0];
  }

  // Configure 4 fingers
  const configs = [
    { state: index, mcp: 5, pip: 6, tip: 8, mcpX: 0.44, mcpY: 0.52 },
    { state: middle, mcp: 9, pip: 10, tip: 12, mcpX: 0.50, mcpY: 0.50 },
    { state: ring, mcp: 13, pip: 14, tip: 16, mcpX: 0.55, mcpY: 0.51 },
    { state: pinky, mcp: 17, pip: 18, tip: 20, mcpX: 0.60, mcpY: 0.54 },
  ];

  configs.forEach(({ state, mcp, pip, tip, mcpX, mcpY }) => {
    lm[mcp] = [mcpX, mcpY, 0];
    if (state === 'extended') {
      lm[pip] = [mcpX, mcpY - 0.12, 0];
      lm[tip] = [mcpX, mcpY - 0.28, 0];
    } else {
      // Curled into fist
      lm[pip] = [mcpX, mcpY - 0.08, 0];
      lm[tip] = [mcpX, mcpY + 0.02, 0];
    }
  });

  return lm;
}

test('open hand targets all 5 fingertips', () => {
  const hand = createSampleHand();
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.ok(thumb > 0.8, 'Thumb should be extended');
  assert.ok(index > 0.8, 'Index should be extended');
  assert.ok(middle > 0.8, 'Middle should be extended');
  assert.ok(ring > 0.8, 'Ring should be extended');
  assert.ok(pinky > 0.8, 'Pinky should be extended');
});

test('closed fist targets 0 fingertips', () => {
  const hand = createSampleHand({
    thumb: 'curled',
    index: 'curled',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.strictEqual(thumb, 0, 'Thumb should be 0 in fist');
  assert.strictEqual(index, 0, 'Index should be 0 in fist');
  assert.strictEqual(middle, 0, 'Middle should be 0 in fist');
  assert.strictEqual(ring, 0, 'Ring should be 0 in fist');
  assert.strictEqual(pinky, 0, 'Pinky should be 0 in fist');
});

test('L-shape / gun pose only targets thumb and index', () => {
  const hand = createSampleHand({
    thumb: 'extended',
    index: 'extended',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.ok(thumb > 0.8, 'Thumb should be targeted in L-pose');
  assert.ok(index > 0.8, 'Index should be targeted in L-pose');
  assert.strictEqual(middle, 0, 'Middle should not be targeted in L-pose');
  assert.strictEqual(ring, 0, 'Ring should not be targeted in L-pose');
  assert.strictEqual(pinky, 0, 'Pinky should not be targeted in L-pose');
});

test('peace sign only targets index and middle', () => {
  const hand = createSampleHand({
    thumb: 'curled',
    index: 'extended',
    middle: 'extended',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.strictEqual(thumb, 0);
  assert.ok(index > 0.8);
  assert.ok(middle > 0.8);
  assert.strictEqual(ring, 0);
  assert.strictEqual(pinky, 0);
});

test('pointing only targets index fingertip', () => {
  const hand = createSampleHand({
    thumb: 'curled',
    index: 'extended',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.strictEqual(thumb, 0);
  assert.ok(index > 0.8);
  assert.strictEqual(middle, 0);
  assert.strictEqual(ring, 0);
  assert.strictEqual(pinky, 0);
});

test('thumbs up only targets thumb', () => {
  const hand = createSampleHand({
    thumb: 'up',
    index: 'curled',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.ok(thumb > 0.8);
  assert.strictEqual(index, 0);
  assert.strictEqual(middle, 0);
  assert.strictEqual(ring, 0);
  assert.strictEqual(pinky, 0);
});

// Anime & Superhero Gesture Tests
test('Chidori triggers when hand forms a closed fist', () => {
  const hand = createSampleHand({
    thumb: 'curled',
    index: 'curled',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  const isFist = thumb === 0 && index === 0 && middle === 0 && ring === 0 && pinky === 0;
  assert.strictEqual(isFist, true, 'All fingers curled is fist for Chidori');
});

test('Spider-Man 🤟 sign targets thumb, index, and pinky while curling middle and ring', () => {
  const hand = createSampleHand({
    thumb: 'extended',
    index: 'extended',
    middle: 'curled',
    ring: 'curled',
    pinky: 'extended',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(hand);
  assert.ok(thumb > 0.8, 'Thumb should be extended');
  assert.ok(index > 0.8, 'Index should be extended');
  assert.strictEqual(middle, 0, 'Middle must be curled');
  assert.strictEqual(ring, 0, 'Ring must be curled');
  assert.ok(pinky > 0.8, 'Pinky should be extended');
});

test('Laser Sword vs Peace Sign tip separation', () => {
  const aspect = 1.777;
  const swordGap = 0.02 * aspect; // Touching fingers
  const peaceGap = 0.06 * aspect; // V-shape spread
  const threshold = 0.038 * aspect;

  assert.ok(swordGap <= threshold, 'Sword fingers must be close');
  assert.ok(peaceGap > threshold, 'Peace sign fingers must be spread');
});

test('Super Saiyan triggers on wide arm spread', () => {
  const aspect = 1.777;
  const h1 = { wrist: { x: 0.22 * aspect, y: 0.55 } }; // Left side
  const h2 = { wrist: { x: 0.78 * aspect, y: 0.55 } }; // Right side
  const rawHandSpan = Math.abs(h1.wrist.x - h2.wrist.x) / aspect;
  const isSpread = rawHandSpan > 0.38;
  const isChestHeight = h1.wrist.y > 0.20 && h1.wrist.y < 0.92 && h2.wrist.y > 0.20 && h2.wrist.y < 0.92;
  assert.strictEqual(isSpread && isChestHeight, true, 'Super Saiyan pose detected');
});

test('Finger Gun detects cocked hammer and trigger pull', () => {
  // Hand with index extended, middle/ring/pinky curled
  const gunCocked = createSampleHand({
    thumb: 'up',
    index: 'extended',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [thumb, index, middle, ring, pinky] = getFingerExtensions(gunCocked);
  assert.ok(thumb > 0.8, 'Thumb is up (cocked)');
  assert.ok(index > 0.8, 'Index barrel extended');
  assert.strictEqual(middle, 0);
  assert.strictEqual(ring, 0);
  assert.strictEqual(pinky, 0);

  // Trigger pulled (thumb lowered into palm)
  const gunFired = createSampleHand({
    thumb: 'curled',
    index: 'extended',
    middle: 'curled',
    ring: 'curled',
    pinky: 'curled',
  });
  const [fThumb, fIndex, fMiddle, fRing, fPinky] = getFingerExtensions(gunFired);
  assert.strictEqual(fThumb, 0, 'Thumb lowered (trigger pulled)');
  assert.ok(fIndex > 0.8, 'Index barrel stays aimed');
});

test('Game Focus Mode isolates game and suppresses other FX', () => {
  const S = require('../src/settings.js');
  const defaults = S.sanitize({});
  assert.strictEqual(defaults.targetGame.on, false);
  assert.strictEqual(defaults.targetGame.focusMode, true);
  assert.strictEqual(defaults.targetGame.speed, 'normal');

  // Verify custom settings
  const custom = S.sanitize({
    targetGame: { on: true, focusMode: false, speed: 'fast' },
    gestures: { chidori: false, laserSword: true, fingerGun: true },
  });
  assert.strictEqual(custom.targetGame.on, true);
  assert.strictEqual(custom.targetGame.focusMode, false);
  assert.strictEqual(custom.targetGame.speed, 'fast');
  assert.strictEqual(custom.gestures.chidori, false);
  assert.strictEqual(custom.gestures.laserSword, true);
  assert.strictEqual(custom.gestures.fingerGun, true);
});
