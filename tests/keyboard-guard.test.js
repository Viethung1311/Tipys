import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuard,
  guardPress,
  guardTick,
  guardResult,
  explosionFrame,
} from '../src/features/keyboard-guard/engine.js';
import { GUARD_LEVEL } from '../src/features/keyboard-guard/level.js';
import { backgroundPosition, flightFrame } from '../src/features/keyboard-guard/animation.js';
import { ART, FLIGHT_BODY } from '../src/features/keyboard-guard/art.js';
import { readFileSync } from 'node:fs';
const advance = (s, seconds) => {
  for (let n = 0; n < seconds * 100; n++) guardTick(s, 0.01);
};
const target = (id, key, x, y) => ({ id, key, x, y, vx: 0, vy: 0, state: 'falling', rotation: 0 });
function empty() {
  const s = createGuard();
  s.spawnAt = 999;
  return s;
}
function hit(s, id = 1, x = 240, y = 150) {
  s.targets.push(target(id, 'A', x, y));
  guardPress(s, 'A');
  advance(s, 1);
}

test('meteors spawn fully above the top and preserve old speed along a longer path', () => {
  const [, , w, h] = ART.meteor.crop,
    c = GUARD_LEVEL;
  const radius = Math.hypot((c.meteorSize * w) / h, c.meteorSize) / 2;
  const positions = [];
  for (const random of [0, 0.5, 0.999]) {
    const s = createGuard({ ...c, waves: 1, targetsPerWave: 1 }, () => random);
    guardTick(s, 0);
    const t = s.targets[0];
    positions.push(t.x);
    assert.ok(t.y + radius < 0);
    assert.ok(t.x - radius >= c.spawn.edgePadding - 1e-8);
    assert.ok(t.x + radius < c.world.width * 0.7 - 30);
    const speed = Math.hypot(t.vx, t.vy),
      distance = Math.hypot(c.ship.x - t.x, c.ship.y - t.y);
    assert.ok(
      Math.abs(speed - Math.hypot(c.ship.x - t.x, c.ship.y - 200) / c.travelSeconds) < 1e-9,
    );
    const y = t.y;
    guardTick(s, 0.05);
    assert.ok(t.y - y < 2.1);
    let appearedAt;
    while (!s.resolved && s.time < 30) {
      guardTick(s, 0.01);
      if (appearedAt === undefined && t.y + radius >= 0) appearedAt = s.time;
    }
    assert.equal(s.resolved, 1);
    assert.ok(Math.abs(s.time - (distance - c.collisionRadius) / speed) < 0.02);
    assert.ok(s.time - appearedAt > 17);
    assert.ok(s.time - appearedAt < 20);
  }
  assert.equal(new Set(positions).size, 3);
});

test('5 HP / 0 energy; nearest duplicate receives one three-round burst; repeat/wrong ignored', () => {
  const s = empty();
  assert.equal(s.lives, 5);
  assert.equal(s.energy, 0);
  s.targets = [target(1, 'A', 240, 150), target(2, 'A', 240, 300)];
  assert.equal(guardPress(s, 'B'), false);
  assert.equal(guardPress(s, 'A', { repeat: true }), false);
  assert.equal(s.presses, 1);
  assert.equal(guardPress(s, 'A'), true);
  assert.equal(s.targets[1].state, 'targeted');
  assert.equal(s.targets[0].state, 'falling');
  assert.equal(s.bullets.length, 3);
  assert.deepEqual(
    s.bullets.map((b) => b.at),
    [0, 0.12, 0.24],
  );
  guardTick(s, 0.01);
  assert.equal(s.bullets.filter((b) => b.emitted).length, 1);
  assert.equal(s.score, 0);
  advance(s, 0.25);
  assert.equal(s.bullets.filter((b) => b.emitted).length, 3);
  assert.equal(s.score, 0);
  advance(s, 0.5);
  assert.equal(s.score, 10);
  assert.equal(s.energy, 1);
  assert.equal(s.bullets.length, 0);
  assert.equal(s.destroyed, 1);
  assert.equal(guardResult(s).accuracy, 50);
});

test('new status/flight/background assets have stable canvases and explicit paths', () => {
  const pngSize = (src) => {
    const b = readFileSync(new URL('../public' + src, import.meta.url));
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(pngSize(ART[`hp${i}`].src), [768, 320]);
    assert.deepEqual(pngSize(ART[`energy${i}`].src), [768, 320]);
    assert.deepEqual(pngSize(ART[`flight${i}`].src), [512, 512]);
  }
  for (let i = 0; i < 4; i++) assert.deepEqual(pngSize(ART[`space${i}`].src), [1024, 1536]);
  assert.equal(
    GUARD_LEVEL.ship.muzzleOffset,
    ((FLIGHT_BODY.y - FLIGHT_BODY.noseY) * GUARD_LEVEL.ship.length) / FLIGHT_BODY.length,
  );
});

test('background uses continuous downward remainder without a double shift; flight loops at 11fps', () => {
  const c = GUARD_LEVEL,
    bg = (t) => backgroundPosition(t, c.background.scrollSpeed, c.world);
  const height = bg(0).height,
    quarter = height / 4,
    stepTime = quarter / c.background.scrollSpeed;
  for (let i = 0; i < 4; i++) {
    const p = bg((i + 0.3) * stepTime);
    assert.equal(p.frame, i);
    assert.ok(Math.abs(p.offset - quarter * 0.3) < 1e-7);
    assert.ok(p.width >= c.world.width);
    assert.ok(p.height >= c.world.height);
    const before = bg((i + 1) * stepTime - 0.0001),
      after = bg((i + 1) * stepTime + 0.0001);
    const beforeEffective = (before.frame * quarter + before.offset) % height,
      afterEffective = (after.frame * quarter + after.offset) % height;
    assert.ok(
      Math.abs(
        ((afterEffective - beforeEffective + height) % height) - c.background.scrollSpeed * 0.0002,
      ) < 1e-7,
    );
  }
  assert.deepEqual(
    Array.from({ length: 7 }, (_, i) => flightFrame((i + 0.01) / 11, 11)),
    [0, 1, 2, 3, 4, 5, 0],
  );
  const s = createGuard();
  s.time = 2;
  s.status = 'paused';
  const frozen = bg(s.time),
    frame = flightFrame(s.time, c.ship.flightFps);
  advance(s, 30);
  assert.deepEqual(bg(s.time), frozen);
  assert.equal(flightFrame(s.time, c.ship.flightFps), frame);
  const replay = createGuard();
  assert.equal(bg(replay.time).frame, 0);
  assert.equal(flightFrame(replay.time, c.ship.flightFps), 0);
});
test('burst originates at muzzle, aim left/centre/right and each bullet keeps its own heading', () => {
  for (const x of [80, 240, 400]) {
    const s = empty();
    s.targets = [target(1, 'A', x, 200)];
    guardPress(s, 'A');
    const b = s.bullets[0],
      ship = s.config.ship;
    assert.ok(Math.abs(Math.hypot(b.x - ship.x, b.y - ship.y) - ship.muzzleOffset) < 1e-8);
    assert.equal(Math.sign(s.aim), Math.sign(x - ship.x));
    assert.equal(b.angle, s.aim);
    const aim = b.angle,
      dx = b.dx,
      dy = b.dy;
    s.targets.push(target(2, 'S', 480 - x, 200));
    guardPress(s, 'S');
    assert.equal(b.angle, aim);
    assert.equal(b.dx, dx);
    assert.equal(b.dy, dy);
  }
});
test('energy 1 to 5; charged shield consumes exactly one collision; invulnerability is separate', () => {
  const s = empty();
  for (let i = 1; i <= 5; i++) {
    hit(s, i);
    assert.equal(s.energy, i);
    assert.equal(s.score, i * 10);
    assert.equal(s.lives, 5);
  }
  s.targets.push(target(6, 'D', 240, 700), target(7, 'F', 240, 700));
  guardTick(s, 0.01);
  assert.equal(s.energy, 0);
  assert.equal(s.lives, 5);
  assert.equal(s.resolved, 7);
  assert.equal(s.destroyed, 5);
  assert.equal(s.score, 50);
  advance(s, 1.1);
  s.targets.push(target(8, 'D', 240, 700));
  guardTick(s, 0.01);
  assert.equal(s.lives, 4);
  assert.equal(s.energy, 0);
  s.targets.push(target(9, 'F', 240, 700));
  guardTick(s, 0.01);
  assert.equal(s.lives, 4);
  assert.equal(s.score, 50);
});
test('targeted meteor is harmless; near target first impact cancels remaining scheduled rounds', () => {
  const s = empty();
  s.targets = [target(1, 'A', 240, 660)];
  guardPress(s, 'A');
  advance(s, 0.02);
  assert.equal(s.lives, 5);
  assert.equal(s.energy, 1);
  assert.equal(s.score, 10);
  assert.equal(s.bullets.length, 0);
  advance(s, 2);
  assert.equal(s.score, 10);
  assert.equal(s.energy, 1);
});
test('four explosion frames keep one centre/size; pause freezes burst, effect and timers', () => {
  const s = empty();
  hit(s);
  const effect = s.effects[0];
  // Test frame boundaries independently of wall clock and renderer size.
  const e = { x: 123, y: 234, at: 0 };
  assert.deepEqual(
    [0, 0.1, 0.2, 0.3].map((t) => explosionFrame(e, t, 0.4)),
    [0, 1, 2, 3],
  );
  assert.deepEqual([e.x, e.y], [123, 234]);
  s.targets = [target(2, 'S', 80, 150)];
  guardPress(s, 'S');
  s.status = 'paused';
  const before = JSON.stringify(s);
  advance(s, 20);
  assert.equal(JSON.stringify(s), before);
  assert.equal(guardPress(s, 'A'), false);
  s.status = 'playing';
  guardTick(s, 100);
  assert.ok(s.time <= 1.051);
});
test('loss blocks delayed score/spawns; replay clean; 15 targets / 3 waves / rests / 3 active / star tiers', () => {
  const lost = empty();
  lost.lives = 1;
  lost.targets = [target(1, 'D', 240, 700), target(2, 'A', 80, 150)];
  guardPress(lost, 'A');
  guardTick(lost, 0.01);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.bullets.length, 0);
  advance(lost, 20);
  assert.equal(lost.score, 0);
  assert.equal(guardResult(lost).stars, 0);
  const s = createGuard(GUARD_LEVEL, () => 0.2);
  let previousWave = 1,
    rests = [];
  for (let n = 0; n < 30000 && s.status !== 'won'; n++) {
    const t = s.targets.find((t) => t.state === 'falling');
    if (t) guardPress(s, t.key);
    guardTick(s, 0.01);
    assert.ok(s.targets.length <= 3);
    assert.ok(s.bullets.length <= 9);
    if (s.restUntil !== null && !rests.some((r) => r.wave === s.wave))
      rests.push({ wave: s.wave, time: s.time });
    if (s.wave !== previousWave) {
      assert.ok(s.time - rests.at(-1).time >= 1.99);
      previousWave = s.wave;
    }
  }
  assert.equal(s.status, 'won');
  assert.equal(s.destroyed, 15);
  assert.equal(s.score, 150);
  assert.equal(s.energy, 5);
  assert.equal(rests.length, 2);
  for (const [hp, stars] of [
    [5, 3],
    [4, 2],
    [3, 2],
    [2, 1],
    [1, 1],
  ]) {
    s.lives = hp;
    assert.equal(guardResult(s).stars, stars);
  }
  const fresh = createGuard();
  assert.equal(fresh.lives, 5);
  assert.equal(fresh.energy, 0);
  assert.equal(fresh.bullets.length, 0);
  assert.equal(fresh.effects.length, 0);
});

test('0.5x / 1x / 2x share the same movement clock; animation and pause remain independent', () => {
  for (const speedMultiplier of [0.5, 1, 2]) {
    const s = createGuard({ ...GUARD_LEVEL, speedMultiplier });
    s.spawnAt = Infinity;
    s.targets = [{ ...target(1, 'A', 100, 100), vy: 10 }];
    advance(s, 1);
    assert.ok(Math.abs(s.targets[0].y - (100 + 10 * speedMultiplier)) < 1e-8);
    assert.ok(Math.abs(s.movementTime * 50 - 50 * speedMultiplier) < 1e-8);
    assert.equal(flightFrame(s.time, 11), flightFrame(1, 11));
    const before = JSON.stringify(s);
    s.status = 'paused';
    const paused = JSON.stringify(s);
    guardTick(s, 60);
    assert.equal(JSON.stringify(s), paused);
    s.status = 'playing';
    assert.equal(JSON.stringify(s), before);
    const position = s.movementTime;
    s.speedMultiplier = 1.5;
    guardTick(s, 0.01);
    assert.ok(s.movementTime > position);
    assert.ok(s.effectiveSpeed >= Math.min(speedMultiplier, 1.5));
    assert.ok(s.effectiveSpeed <= Math.max(speedMultiplier, 1.5));
    assert.ok(s.movementTime - position <= 0.02 + 1e-8);
  }
});
test('partial last waves spawn exactly the configured total, obey cap and never catch up in a burst', () => {
  for (const totalTargets of [1, 7, 13]) {
    const s = createGuard(
      { ...GUARD_LEVEL, totalTargets, maxActive: Math.min(2, totalTargets), spawnSeconds: 0.5 },
      () => 0.5,
    );
    const seen = new Set();
    let previousSpawnTime = null;
    for (let i = 0; i < 40000 && !['won', 'lost'].includes(s.status); i++) {
      const before = s.spawnedTotal;
      guardTick(s, 0.05);
      assert.ok(s.targets.length <= s.config.maxActive);
      assert.ok(s.spawnedTotal - before <= 1);
      if (s.spawnedTotal > before) {
        if (previousSpawnTime !== null) assert.ok(s.time - previousSpawnTime >= 0.5 - 1e-8);
        previousSpawnTime = s.time;
      }
      for (const t of s.targets) {
        seen.add(t.id);
        if (t.state === 'falling') guardPress(s, t.key);
      }
    }
    assert.equal(s.status, 'won');
    assert.equal(seen.size, totalTargets);
    assert.equal(s.spawnedTotal, totalTargets);
    assert.equal(s.resolved, totalTargets);
    assert.equal(s.destroyed, totalTargets);
    assert.equal(s.wave, Math.ceil(totalTargets / 5));
  }
});

test('a full screen waits for a free slot, then spawns only one replacement', () => {
  const s = createGuard(
    { ...GUARD_LEVEL, totalTargets: 7, maxActive: 2, spawnSeconds: 0.5 },
    () => 0.5,
  );
  advance(s, 12);
  assert.equal(s.targets.length, 2);
  assert.equal(s.spawnedTotal, 2);
  advance(s, 2);
  assert.equal(s.spawnedTotal, 2);
  guardPress(s, s.targets[0].key);
  advance(s, 2);
  assert.equal(s.spawnedTotal, 3);
  assert.equal(s.targets.length, 2);
  advance(s, 0.4);
  assert.equal(s.spawnedTotal, 3);
});
