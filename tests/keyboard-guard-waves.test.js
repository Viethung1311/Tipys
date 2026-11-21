import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGuard,
  guardTick,
  guardPress,
  guardWaveConfig,
} from '../src/features/keyboard-guard/engine.js';
import { shipSprite } from '../src/features/keyboard-guard/animation.js';
import {
  defaultGuardSettings,
  guardLevel,
  loadGuardSettings,
  saveGuardSettings,
} from '../src/features/keyboard-guard/settings.js';
import { ART, SHIP_ANCHORS } from '../src/features/keyboard-guard/art.js';
import { renderGuard } from '../src/features/keyboard-guard/render.js';
const advance = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 100); i++) guardTick(s, 0.01);
};
const collider = (s, id = 999) => ({
  id,
  key: 'em bé',
  x: s.config.ship.x,
  y: s.config.ship.y,
  vx: 0,
  vy: 0,
  rotation: 0,
  state: 'falling',
});
test('wave assets have stable canvases, cockpit/nose anchor and one complete ship per draw', () => {
  for (const [prefix, count] of [
    ['boost', 6],
    ['boost_vfx', 6],
    ['hurt', 3],
  ])
    for (let i = 1; i <= count; i++) {
      const filename = `${prefix}_${String(i).padStart(2, '0')}.png`;
      const copy = readFileSync(new URL(`../public/guard-art/${filename}`, import.meta.url));
      assert.deepEqual([copy.readUInt32BE(16), copy.readUInt32BE(20)], [512, 512]);
    }
  for (const anchor of Object.values(SHIP_ANCHORS)) {
    assert.ok(Math.abs(((anchor.y - anchor.noseY) * 76.8) / anchor.length - 38.4) < 1e-9);
  }
  const cockpit = { flight: 162.5, boost: 152.5, boostVfx: 153, hurt: 203.5 };
  for (const [name, y] of Object.entries(cockpit)) {
    const a = SHIP_ANCHORS[name];
    assert.ok(Math.abs(((y - a.y) * 76.8) / a.length + 3.26) < 0.2);
  }
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    const draws = [],
      ctx = new Proxy(
        { drawImage: (img, ...args) => draws.push({ name: img.name, args }) },
        { get: (o, k) => o[k] || (() => {}) },
      );
    const canvas = {
      width: 480,
      height: 800,
      getBoundingClientRect: () => ({ width: 480, height: 800 }),
      getContext: () => ctx,
    };
    const images = Object.fromEntries(
      Object.keys(ART).map((name) => [name, { name, naturalWidth: 512, naturalHeight: 512 }]),
    );
    const s = createGuard(guardLevel());
    for (const wave of [1, 2, 3]) {
      s.wave = wave;
      s.spriteTime = 2;
      renderGuard(canvas, { children: [] }, s, images, false, true);
      const ships = draws.filter((d) => /^(flight|boost|boostVfx|hurt)\d+$/.test(d.name));
      assert.equal(ships.length, 1);
      assert.equal(ships[0].name, ['flight2', 'boost2', 'boostVfx2'][wave - 1]);
      s.hurtAt = s.time;
      draws.length = 0;
      renderGuard(canvas, { children: [] }, s, images, false, true);
      assert.equal(draws.filter((d) => /^(flight|boost|boostVfx|hurt)\d+$/.test(d.name)).length, 1);
      assert.ok(draws.some((d) => d.name === 'hurt0'));
      s.hurtAt = null;
      draws.length = 0;
    }
  } finally {
    globalThis.window = previous;
  }
});
test('three real waves use their own budgets, caps, intervals and sprites; replay resets boost', () => {
  const settings = defaultGuardSettings();
  settings.stages[1].waves = settings.stages[1].waves.map((w, i) => ({
    ...w,
    totalTargets: i + 1,
    maxActive: Math.min(i + 1, 2),
    spawnSeconds: 0.5,
    fps: 10 + i,
  }));
  const s = createGuard(guardLevel(settings), () => 0.5),
    seen = new Map(),
    frames = new Map();
  for (let i = 0; i < 60000 && !['won', 'lost'].includes(s.status); i++) {
    guardTick(s, 0.01);
    const w = guardWaveConfig(s),
      sprite = shipSprite(s);
    assert.equal(sprite.set, ['flight', 'boost', 'boostVfx'][s.wave - 1]);
    assert.ok(s.targets.length <= w.maxActive);
    if (!frames.has(s.wave)) frames.set(s.wave, new Set());
    frames.get(s.wave).add(sprite.frame);
    for (const t of s.targets) {
      seen.set(t.id, s.wave);
      if (t.state === 'falling') guardPress(s, t.key);
    }
  }
  assert.equal(s.status, 'won');
  assert.deepEqual(
    [1, 2, 3].map((n) => [...seen.values()].filter((w) => w === n).length),
    [1, 2, 3],
  );
  for (const set of frames.values()) assert.equal(set.size, 6);
  const replay = createGuard(guardLevel(settings));
  assert.equal(replay.wave, 1);
  assert.equal(replay.effectiveSpeed, 1);
  assert.equal(shipSprite(replay).set, 'flight');
  assert.equal(replay.spriteTime, 0);
});
test('rest keeps previous mode; 500ms smooth transition multiplies base once and integrates background', () => {
  const config = guardLevel();
  config.speedMultiplier = 1.5;
  const s = createGuard(config);
  s.spawnAt = Infinity;
  s.restUntil = 0.5;
  advance(s, 0.49);
  assert.equal(s.wave, 1);
  assert.equal(shipSprite(s).set, 'flight');
  assert.equal(s.effectiveSpeed, 1.5);
  advance(s, 0.01);
  assert.equal(s.wave, 2);
  assert.equal(shipSprite(s).set, 'boost');
  assert.equal(s.effectiveSpeed, 1.5);
  const offset = s.movementTime;
  advance(s, 0.25);
  assert.ok(s.effectiveSpeed > 1.5 && s.effectiveSpeed < 1.875);
  assert.ok(s.movementTime > offset);
  advance(s, 0.25);
  assert.ok(Math.abs(s.effectiveSpeed - 1.875) < 1e-8);
  const spriteClock = s.spriteTime,
    position = s.movementTime;
  s.status = 'paused';
  advance(s, 10);
  assert.equal(s.spriteTime, spriteClock);
  assert.equal(s.movementTime, position);
  s.status = 'playing';
  s.spawnAt = Infinity;
  advance(s, 1);
  assert.ok(Math.abs(s.movementTime - position - 1.875) < 1e-7);
  assert.ok(Math.abs(s.spriteTime - spriteClock - 11) < 1e-7);
});
test('hurt plays three frames only after actual HP loss, resumes current wave and never revives a loss', () => {
  for (const wave of [1, 2, 3]) {
    const s = createGuard(guardLevel());
    s.wave = wave;
    s.spawnAt = Infinity;
    s.targets = [collider(s)];
    guardTick(s, 0.01);
    assert.equal(s.lives, 4);
    assert.deepEqual(shipSprite(s), { set: 'hurt', frame: 0 });
    advance(s, 0.11);
    assert.deepEqual(shipSprite(s), { set: 'hurt', frame: 1 });
    s.status = 'paused';
    const before = JSON.stringify(s);
    advance(s, 10);
    assert.equal(JSON.stringify(s), before);
    s.status = 'playing';
    advance(s, 0.1);
    assert.deepEqual(shipSprite(s), { set: 'hurt', frame: 2 });
    advance(s, 0.1);
    assert.equal(shipSprite(s).set, ['flight', 'boost', 'boostVfx'][wave - 1]);
  }
  const s = createGuard(guardLevel());
  s.spawnAt = Infinity;
  s.targets = [collider(s)];
  s.energy = 5;
  guardTick(s, 0.01);
  assert.equal(s.lives, 5);
  assert.equal(s.energy, 0);
  assert.equal(s.hurtAt, null);
  assert.equal(s.shieldAt, s.time);
  s.targets = [collider(s, 1000)];
  guardTick(s, 0.01);
  assert.equal(s.lives, 5);
  assert.equal(s.hurtAt, null);
  advance(s, 1);
  s.targets = [collider(s, 1001)];
  guardTick(s, 0.01);
  assert.equal(s.lives, 4);
  s.restUntil = s.time + 0.1;
  advance(s, 0.32);
  assert.equal(s.wave, 2);
  assert.equal(shipSprite(s).set, 'boost');
  advance(s, 1);
  s.lives = 1;
  s.targets = [collider(s, 1002)];
  guardTick(s, 0.01);
  assert.equal(s.status, 'lost');
  const lost = JSON.stringify(s);
  advance(s, 10);
  assert.equal(JSON.stringify(s), lost);
});
test('migration and validation preserve old totals, clamp tiny legacy rounds, and freeze each new run config', () => {
  const previous = globalThis.localStorage;
  let raw = JSON.stringify({
    version: 2,
    shipPercent: 80,
    meteorPercent: 80,
    stages: {
      1: { speed: 100, totalTargets: 7, maxActive: 3, spawnSeconds: 2 },
      2: { speed: 150, totalTargets: 1, maxActive: 1, spawnSeconds: 1 },
      3: { speed: 200, totalTargets: 15, maxActive: 3, spawnSeconds: 4.5 },
    },
  });
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: (_, v) => {
      raw = v;
    },
  };
  try {
    const s = loadGuardSettings();
    assert.equal(s.version, 3);
    assert.deepEqual(
      s.stages[1].waves.map((w) => w.totalTargets),
      [3, 2, 2],
    );
    assert.deepEqual(
      s.stages[2].waves.map((w) => w.totalTargets),
      [1, 1, 1],
    );
    const run = guardLevel(s);
    const before = JSON.stringify(run);
    for (const [key, value] of [
      ['speed', 0],
      ['totalTargets', 2.5],
      ['maxActive', 6],
      ['spawnSeconds', 0],
      ['fps', 25],
    ]) {
      const bad = structuredClone(s);
      bad.stages[1].waves[0][key] = value;
      assert.throws(() => saveGuardSettings(bad, { role: 'admin' }));
    }
    for (const [key, value] of [
      ['backgroundSpeed', 0],
      ['transitionSeconds', 0.05],
    ]) {
      const bad = structuredClone(s);
      bad.stages[1][key] = value;
      assert.throws(() => saveGuardSettings(bad, { role: 'admin' }));
    }
    s.stages[1].waves[0].speed = 200;
    s.stages[1].waves[0].fps = 20;
    saveGuardSettings(s, { role: 'admin' });
    assert.equal(JSON.stringify(run), before);
    assert.equal(guardLevel(loadGuardSettings()).waveSettings[0].fps, 20);
  } finally {
    globalThis.localStorage = previous;
  }
});
