// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/settings.js');

test('empty or garbage input falls back to defaults', () => {
  assert.deepStrictEqual(S.sanitize(undefined), S.sanitize({}));
  assert.deepStrictEqual(S.sanitize('nope').elements.lines, S.DEFAULTS.elements.lines);
  assert.strictEqual(S.sanitize({}).darken, 25);
});

test('invalid colors and out-of-range numbers are rejected or clamped', () => {
  const s = S.sanitize({
    elements: { lines: { on: 'yes', color: 'red' }, dust: { on: false, color: '#ABCDEF' } },
    darken: 500,
    lightSpill: { on: true, strength: -20 },
    personLight: { on: true, strength: 'x' },
  });
  assert.deepStrictEqual(s.elements.lines, S.DEFAULTS.elements.lines);
  assert.deepStrictEqual(s.elements.dust, { on: false, color: '#abcdef' });
  assert.strictEqual(s.darken, 60);
  assert.strictEqual(s.lightSpill.strength, 0);
  assert.strictEqual(s.personLight.strength, S.DEFAULTS.personLight.strength);
});

test('presets change colors but keep on/off choices', () => {
  const base = S.sanitize({ elements: { shards: { on: false } } });
  const ice = S.applyPreset(base, 'Ice');
  assert.strictEqual(ice.elements.glow.color, S.PRESETS.Ice.glow);
  assert.strictEqual(ice.elements.shards.on, false);
  assert.strictEqual(base.elements.glow.color, S.DEFAULTS.elements.glow.color); // not mutated
});

test('rgb converts hex to an rgba() component list', () => {
  assert.strictEqual(S.rgb('#a878ff'), '168, 120, 255');
});

test('eco mode toggles on/off and sanitizes correctly without losing state', () => {
  const ecoOn = S.sanitize({ ecoMode: true });
  assert.strictEqual(ecoOn.ecoMode, true);
  const ecoOff = S.sanitize({ ecoMode: false });
  assert.strictEqual(ecoOff.ecoMode, false);

  const switchedPreset = S.applyPreset(ecoOn, 'Matrix');
  assert.strictEqual(switchedPreset.ecoMode, true, 'Preset change preserves ecoMode state');
});

test('manifest.json is valid for Chrome Web Store publication and all referenced files exist', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

  assert.strictEqual(manifest.manifest_version, 3);
  assert.ok(manifest.description.length <= 132, `Description length (${manifest.description.length}) must be <= 132 chars for Chrome Web Store`);

  const filesToCheck = [
    manifest.icons['48'],
    manifest.icons['128'],
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((cs) => cs.js),
  ];
  for (const rel of filesToCheck) {
    assert.ok(fs.existsSync(path.join(root, rel)), `Referenced file ${rel} must exist`);
  }
});

test('floating in-page HUD defaults to disabled and toolbar popup has all required tabs and controls', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');

  // 1. Ensure floating HUD defaults to false
  const defaults = S.sanitize({});
  assert.strictEqual(defaults.hudVisible, false, 'hudVisible must default to false to prevent obstructing video calls/chat');

  // 2. Ensure popup.html contains all 5 tabs and their matching panes
  const html = fs.readFileSync(path.join(root, 'popup', 'popup.html'), 'utf8');
  const expectedTabs = ['powers', 'game', 'draw', 'themes', 'setup'];
  for (const tab of expectedTabs) {
    assert.ok(html.includes(`data-tab="${tab}"`), `Tab ${tab} button must exist in popup.html`);
    assert.ok(html.includes(`id="pane-${tab}"`), `Tab pane id="pane-${tab}" must exist in popup.html`);
  }

  // 3. Ensure essential control IDs exist in popup.html
  const requiredIds = [
    'toggle', 'state', 'gesturesOn', 'targetGameOn', 'airDrawOn',
    'gameScoreVal', 'gameComboVal', 'gameHitsVal', 'gameSpeedBtn', 'gameResetBtn',
    'airDrawClearBtn', 'airDrawColor', 'airDrawSize', 'presets', 'elements',
    'ecoMode', 'reset',
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `Control #${id} must exist in popup.html`);
  }
});
