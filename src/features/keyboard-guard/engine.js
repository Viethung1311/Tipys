import { GUARD_LEVEL } from './level.js';
import { ART } from './art.js';
import { guardWords, guardText, guardFold } from './words.js';
import { matchesTarget } from '../keyboard-quest/engine.js';

export function guardWaveConfig(s) {
  const c = s.config;
  return (
    c.waveSettings?.[s.wave - 1] || {
      totalTargets: c.targetsPerWave,
      maxActive: c.maxActive,
      spawnSeconds: c.spawnSeconds,
      fps: c.ship.flightFps,
      speedMultiplier: c.waveMultipliers?.[Math.min(s.wave - 1, 2)] ?? 1,
    }
  );
}
export function createGuard(
  config = GUARD_LEVEL,
  random = Math.random,
  words = guardWords(config.stage || 1),
) {
  const [, , width, height] = ART.meteor.crop;
  const initialSpeed =
    (config.speedMultiplier ?? 1) *
    (config.waveSettings?.[0]?.speedMultiplier ?? config.waveMultipliers?.[0] ?? 1);
  return {
    meteorRadius: Math.hypot((config.meteorSize * width) / height, config.meteorSize) / 2,
    config,
    totalTargets: config.totalTargets ?? config.waves * config.targetsPerWave,
    spawnedTotal: 0,
    movementTime: 0,
    speedMultiplier: config.speedMultiplier ?? 1,
    effectiveSpeed: initialSpeed,
    speedTarget: initialSpeed,
    speedFrom: initialSpeed,
    speedChangedAt: 0,
    spriteTime: 0,
    hurtAt: null,
    shieldAt: null,
    random,
    status: 'playing',
    time: 0,
    wave: 1,
    spawned: 0,
    resolved: 0,
    lives: config.lives,
    energy: 0,
    score: 0,
    destroyed: 0,
    hits: 0,
    presses: 0,
    targets: [],
    bullets: [],
    effects: [],
    protectedUntil: 0,
    spawnAt: 0,
    restUntil: null,
    nextId: 1,
    aim: 0,
    flashUntil: 0,
    events: [],
    words,
    input: '',
    committedInput: '',
    inputTargetId: null,
    composing: false,
    inputFeedback: 'empty',
    lastSubmission: null,
  };
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function guardPress(s, key, { repeat = false } = {}) {
  if (s.status !== 'playing' || repeat || typeof key !== 'string' || !key) return false;
  s.presses++;
  const ship = s.config.ship;
  const target = s.targets
    .filter((t) => t.state === 'falling' && t.key === key)
    .sort((a, b) => distance(a, ship) - distance(b, ship) || a.id - b.id)[0];
  if (!target) return false;
  s.hits++;
  launchTarget(s, target);
  return true;
}
function launchTarget(s, target) {
  const ship = s.config.ship;
  target.state = 'targeted';
  const d = distance(target, ship),
    dx = (target.x - ship.x) / d,
    dy = (target.y - ship.y) / d;
  s.aim = Math.atan2(dx, -dy);
  for (let i = 0; i < s.config.burstCount; i++) {
    s.bullets.push({
      targetId: target.id,
      x: ship.x + dx * ship.muzzleOffset,
      y: ship.y + dy * ship.muzzleOffset,
      dx,
      dy,
      angle: s.aim,
      at: s.time + i * s.config.burstInterval,
      emitted: false,
    });
  }
}
export function clearGuardInput(s, feedback = 'empty') {
  s.input = '';
  s.committedInput = '';
  s.composing = false;
  s.inputTargetId = null;
  s.inputFeedback = feedback;
}
export function guardInput(s, value, { composing = false, repeat = false } = {}) {
  if (s.status !== 'playing' || repeat) return false;
  const next = String(value ?? '')
    .normalize('NFC')
    .slice(0, 80);
  if (
    !composing &&
    s.lastSubmission?.value === next &&
    s.lastSubmission.at === s.time &&
    s.input === ''
  )
    return false;
  const wasComposing = s.composing;
  s.composing = composing;
  if (next === s.input && !wasComposing && !composing) return false;
  s.input = next;
  let target = s.targets.find((t) => t.id === s.inputTargetId && t.state === 'falling');
  if (!target && next) {
    target = s.targets
      .filter(
        (t) =>
          t.state === 'falling' &&
          t.y + s.config.meteorSize * 0.8 >= 0 &&
          guardFold(t.key).startsWith(guardFold(next)),
      )
      .sort((a, b) => distance(a, s.config.ship) - distance(b, s.config.ship) || a.id - b.id)[0];
    if (target) s.inputTargetId = target.id;
  }
  if (composing) {
    s.inputFeedback = 'composing';
    return false;
  }
  let common = 0;
  const previous = [...s.committedInput],
    current = [...next];
  while (
    common < previous.length &&
    common < current.length &&
    previous[common] === current[common]
  )
    common++;
  const added = current.length > previous.length ? current.length - common : 0;
  s.presses += added;
  const exactPrefix = target && guardText(target.key).startsWith(guardText(next));
  if (exactPrefix) s.hits += added;
  s.committedInput = next;
  s.inputFeedback = !next ? 'empty' : exactPrefix ? 'correct' : 'wrong';
  if (target && matchesTarget(guardText(next), guardText(target.key))) {
    launchTarget(s, target);
    s.lastSubmission = { value: next, at: s.time };
    clearGuardInput(s, 'fired');
    return true;
  }
  return false;
}
function finish(s, status) {
  s.status = status;
  s.bullets = [];
  s.targets = [];
  s.effects = [];
  clearGuardInput(s);
  s.events.push(status);
}
function resolve(s, t, shot) {
  if (!['falling', 'targeted'].includes(t.state)) return;
  t.state = shot ? 'destroyed' : 'collided';
  if (s.inputTargetId === t.id) clearGuardInput(s, 'lost-target');
  s.resolved++;
  if (shot) {
    s.destroyed++;
    s.score += s.config.points;
    s.energy = Math.min(s.config.energyMax, s.energy + 1);
    s.effects.push({
      x: t.x,
      y: t.y,
      at: s.time,
      until: s.time + s.config.explosionSeconds,
      points: s.config.points,
    });
    s.events.push('explosion');
  } else if (s.time >= s.protectedUntil) {
    if (s.energy === s.config.energyMax) {
      s.energy = 0;
      s.shieldAt = s.time;
      s.events.push('shield');
    } else {
      s.lives--;
      s.hurtAt = s.time;
      s.events.push('damage');
    }
    s.protectedUntil = s.time + s.config.protectionSeconds;
    if (s.lives <= 0) finish(s, 'lost');
  }
}
export function explosionFrame(effect, time, seconds) {
  return Math.max(0, Math.min(3, Math.floor(((time - effect.at) / seconds) * 4 + 1e-9)));
}
export function guardTick(s, seconds) {
  if (!['playing', 'clearing'].includes(s.status)) return;
  const dt = Math.max(0, Math.min(seconds, 0.05)),
    c = s.config;
  s.time += dt;
  if (s.restUntil !== null && s.time >= s.restUntil) {
    s.wave++;
    s.spawned = 0;
    s.spriteTime = 0;
    s.restUntil = null;
    s.spawnAt = s.time;
  }
  const wave = guardWaveConfig(s);
  const targetSpeed = s.speedMultiplier * wave.speedMultiplier;
  if (s.speedTarget !== targetSpeed) {
    s.speedFrom = s.effectiveSpeed;
    s.speedTarget = targetSpeed;
    s.speedChangedAt = s.time;
  }
  const progress = Math.min(
    1,
    Math.max(0, (s.time - s.speedChangedAt) / (c.transitionSeconds ?? 0.5)),
  );
  const smooth = progress * progress * (3 - 2 * progress);
  s.effectiveSpeed = s.speedFrom + (s.speedTarget - s.speedFrom) * smooth;
  const movementDt = dt * s.effectiveSpeed;
  s.movementTime += movementDt;
  s.spriteTime += dt * wave.fps;
  s.effects = s.effects.filter((e) => e.until > s.time);
  if (s.status === 'clearing') {
    if (!s.effects.length) finish(s, 'won');
    return;
  }
  if (
    s.restUntil === null &&
    s.spawned < wave.totalTargets &&
    s.spawnedTotal < s.totalTargets &&
    s.targets.length < wave.maxActive &&
    s.time >= s.spawnAt &&
    s.targets.every((t) => t.y > c.spawn.minGap - s.meteorRadius - 90)
  ) {
    const available = s.words.filter(
      (item) => !s.targets.some((t) => guardText(t.key) === guardText(item.word)),
    );
    if (available.length) {
      const radius = s.meteorRadius;
      const padding = radius + c.spawn.edgePadding;
      const labelPadding = Math.max(padding, 110);
      const x =
          labelPadding + s.random() * Math.max(0, c.world.width * c.spawn.maxXRatio - labelPadding),
        y = -(radius + 90);
      const distanceToShip = Math.hypot(c.ship.x - x, c.ship.y - y);
      // Keep the pre-fix speed; extending the path must not accelerate the meteor.
      const speed = Math.hypot(c.ship.x - x, c.ship.y - c.spawn.speedReferenceY) / c.travelSeconds;
      const word =
        available[Math.min(available.length - 1, Math.floor(s.random() * available.length))];
      s.targets.push({
        id: s.nextId++,
        key: word.word,
        topic: word.topicTitle,
        x,
        y,
        vx: ((c.ship.x - x) * speed) / distanceToShip,
        vy: ((c.ship.y - y) * speed) / distanceToShip,
        state: 'falling',
        rotation: s.random() * Math.PI,
      });
      s.spawned++;
      s.spawnedTotal++;
      s.spawnAt = s.time + wave.spawnSeconds;
    }
  }
  for (const t of s.targets) {
    if (t.state !== 'falling') continue;
    t.x += t.vx * movementDt;
    t.y += t.vy * movementDt;
    t.rotation += dt * 0.35;
    if (distance(t, c.ship) <= c.collisionRadius) resolve(s, t, false);
    if (s.status === 'lost') return;
  }
  for (const b of s.bullets) {
    const t = s.targets.find((t) => t.id === b.targetId && t.state === 'targeted');
    if (!t || s.time < b.at) continue;
    if (!b.emitted) {
      b.emitted = true;
      s.flashUntil = s.time + 0.07;
      s.events.push('shot');
    }
    const step = c.bulletSpeed * Math.min(dt, s.time - b.at);
    if ((t.x - b.x) * b.dx + (t.y - b.y) * b.dy <= step) {
      resolve(s, t, true);
    } else {
      b.x += b.dx * step;
      b.y += b.dy * step;
    }
  }
  // Remove the whole burst (including scheduled rounds) on the first impact.
  s.bullets = s.bullets.filter((b) =>
    s.targets.some((t) => t.id === b.targetId && t.state === 'targeted'),
  );
  s.targets = s.targets.filter((t) => ['falling', 'targeted'].includes(t.state));
  if (
    (s.spawned === wave.totalTargets || s.spawnedTotal === s.totalTargets) &&
    !s.targets.length &&
    s.restUntil === null
  ) {
    if (s.resolved === s.totalTargets) s.status = 'clearing';
    else {
      s.restUntil = s.time + c.waveRestSeconds;
      s.events.push('rest');
    }
  }
}
export function guardResult(s) {
  return {
    score: s.score,
    destroyed: s.destroyed,
    accuracy: s.presses ? Math.round((s.hits / s.presses) * 100) : 0,
    stars:
      s.status === 'won' ? s.config.stars.find((rule) => s.lives >= rule.minLives)?.stars || 0 : 0,
    won: s.status === 'won',
  };
}
