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
