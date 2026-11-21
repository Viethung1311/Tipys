import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuard,
  guardInput,
  guardTick,
  guardResult,
} from '../src/features/keyboard-guard/engine.js';
import { guardWords, guardText } from '../src/features/keyboard-guard/words.js';
import { GUARD_LEVEL } from '../src/features/keyboard-guard/level.js';
import { VOCABULARY } from '../src/features/keyboard-quest/content.js';
import {
  defaultGuardSettings,
  saveGuardSettings,
  loadGuardSettings,
  guardLevel,
} from '../src/features/keyboard-guard/settings.js';
const advance = (s, seconds) => {
  for (let n = 0; n < seconds * 100; n++) guardTick(s, 0.01);
};
const target = (id, key, x, y) => ({ id, key, x, y, vx: 0, vy: 0, state: 'falling', rotation: 0 });
function state() {
  const s = createGuard();
  s.spawnAt = 999;
  return s;
}

test('guard words are exact shared vocabulary values, stage appropriate, no duplicate active words', () => {
  const source = VOCABULARY.flatMap((t) => t.words);
  const words = guardWords(1);
  assert.ok(words.length >= 5);
  assert.ok(words.every((w) => source.includes(w.word) && [...w.word].length <= 8));
  const s = createGuard({ ...GUARD_LEVEL, targetsPerWave: 3 }, () => 0);
  for (let n = 0; n < 1400; n++) {
    guardTick(s, 0.01);
    assert.equal(new Set(s.targets.map((t) => guardText(t.key))).size, s.targets.length);
  }
  assert.ok(s.spawned >= 2);
});
test('locks nearest common prefix, keeps it on mistakes, Backspace edit and NFC complete one burst', () => {
  const s = state();
  s.targets = [target(1, 'con mèo', 100, 200), target(2, 'cá heo', 240, 400)];
  guardInput(s, 'c');
  assert.equal(s.inputTargetId, 2);
  guardInput(s, 'con');
  assert.equal(s.inputTargetId, 2);
  assert.equal(s.inputFeedback, 'wrong');
  assert.equal(s.bullets.length, 0);
  guardInput(s, 'c');
  guardInput(s, 'cá');
  guardInput(s, 'cá he');
  assert.equal(s.bullets.length, 0);
  assert.equal(guardInput(s, 'cá heo'.normalize('NFD')), true);
  assert.equal(s.bullets.length, 3);
  assert.equal(s.input, '');
  guardInput(s, 'cá heo'.normalize('NFD'));
  assert.equal(s.bullets.length, 3);
  advance(s, 1);
  assert.equal(s.score, 10);
  assert.equal(s.energy, 1);
  assert.equal(s.destroyed, 1);
});
test('IME draft never fires, final composition and duplicate input fire once; accents required', () => {
  const s = state();
  s.targets = [target(1, 'em bé', 240, 300)];
  guardInput(s, 'em be');
  assert.equal(s.bullets.length, 0);
  assert.equal(s.inputFeedback, 'wrong');
  guardInput(s, 'em bé', { composing: true });
  assert.equal(s.bullets.length, 0);
  assert.equal(s.inputFeedback, 'composing');
  guardInput(s, 'em bé');
  assert.equal(s.bullets.length, 3);
  guardInput(s, 'em bé');
  assert.equal(s.bullets.length, 3);
  assert.equal(guardInput(s, 'em bé', { repeat: true }), false);
});
test('collision clears the word lock and draft; no reward; paused input blocked', () => {
  const s = state();
  s.targets = [target(1, 'em bé', 240, 670), target(2, 'ông bà', 100, 100)];
  guardInput(s, 'em');
  guardTick(s, 0.01);
  assert.equal(s.input, '');
  assert.equal(s.inputTargetId, null);
  assert.equal(s.inputFeedback, 'lost-target');
  assert.equal(s.score, 0);
  assert.equal(s.energy, 0);
  s.status = 'paused';
  guardInput(s, 'ông bà');
  assert.equal(s.bullets.length, 0);
});
test('local Admin config validates, blocks other roles and is snapshotted for each new play', () => {
  const before = globalThis.localStorage,
    store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  try {
    const defaults = defaultGuardSettings();
    assert.equal(defaults.shipPercent, 80);
    assert.equal(defaults.meteorPercent, 80);
    assert.equal(guardLevel(defaults).ship.length, 76.8);
    assert.equal(guardLevel(defaults).meteorSize, 56);
    for (const role of ['student', 'teacher', undefined])
      assert.throws(() => saveGuardSettings(defaults, { role }));
    const bad = { ...defaults, shipPercent: 200 };
    assert.throws(() => saveGuardSettings(bad, { role: 'admin' }));
    assert.equal(store.size, 0);
    const playing = createGuard(guardLevel(defaults));
    const snapshot = JSON.stringify(playing.config);
    const custom = {
      ...defaults,
      shipPercent: 120,
      meteorPercent: 50,
      stages: Object.fromEntries(
        [175, 50, 150].map((speed, i) => [i + 1, { ...defaults.stages[i + 1], speed }]),
      ),
    };
    saveGuardSettings(custom, { role: 'admin' });
    assert.deepEqual(loadGuardSettings(), custom);
    assert.equal(JSON.stringify(playing.config), snapshot);
    const next = guardLevel(loadGuardSettings());
    assert.ok(Math.abs(next.ship.length - 115.2) < 1e-9);
    assert.equal(next.meteorSize, 35);
    assert.equal(next.speedMultiplier, 1.75);
    assert.equal(guardLevel(custom, 2).speedMultiplier, 0.5);
    saveGuardSettings(defaultGuardSettings(), { role: 'admin' });
    assert.equal(guardLevel().ship.length, 76.8);
  } finally {
    globalThis.localStorage = before;
  }
});

test('local settings migrate v1 without losing sizes and validate each stage cross-field constraints', () => {
  const previous = globalThis.localStorage;
  let raw = JSON.stringify({
    version: 1,
    shipPercent: 90,
    meteorPercent: 70,
    stages: { 1: { speed: 50 }, 2: { speed: 150 }, 3: { speed: 175 } },
  });
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  try {
    const settings = loadGuardSettings();
    assert.equal(settings.version, 3);
    assert.equal(settings.shipPercent, 90);
    assert.equal(settings.stages[2].speed, 150);
    assert.equal(
      settings.stages[2].waves.reduce((n, w) => n + w.totalTargets, 0),
      15,
    );
    for (const [key, value] of [
      ['speed', 201],
      ['totalTargets', 1.5],
      ['maxActive', 16],
      ['spawnSeconds', 0],
      ['spawnSeconds', Infinity],
    ]) {
      const bad = structuredClone(settings);
      if (key === 'speed') bad.stages[1][key] = value;
      else bad.stages[1].waves[0][key] = value;
      assert.throws(() => saveGuardSettings(bad, { role: 'admin' }));
    }
    settings.stages[2].speed = 200;
    settings.stages[2].waves = settings.stages[2].waves.map((w, i) => ({
      ...w,
      totalTargets: i === 0 ? 3 : 2,
      maxActive: 2,
      spawnSeconds: 0.5,
    }));
    saveGuardSettings(settings, { role: 'admin' });
    const run = guardLevel(loadGuardSettings(), 2);
    assert.equal(run.totalTargets, 7);
    assert.equal(run.waves, 3);
    assert.equal(run.maxActive, 2);
    assert.equal(run.speedMultiplier, 2);
    settings.stages[2].waves[0].totalTargets = 1;
    assert.equal(run.totalTargets, 7);
  } finally {
    globalThis.localStorage = previous;
  }
});
