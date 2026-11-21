import { GUARD_LEVEL } from './level.js';
import { load, save } from '../../game/config.js';
export const GUARD_CODE = 'keyboard_guard';
const KEY = 'tipy-guard-config-v1';
export const GUARD_LIMITS = {
  speed: [50, 200],
  waveSpeed: [50, 300],
  totalTargets: [1, 100],
  maxActive: [1, 6],
  spawnSeconds: [0.5, 10],
  fps: [6, 24],
  backgroundSpeed: [10, 120],
  transitionSeconds: [0.2, 2],
  shipPercent: [50, 120],
  meteorPercent: [50, 120],
};
export const defaultGuardSettings = () => ({
  version: 3,
  shipPercent: 80,
  meteorPercent: 80,
  stages: Object.fromEntries(
    [100, 115, 130].map((speed, i) => [
      i + 1,
      {
        speed,
        backgroundSpeed: 50,
        transitionSeconds: 0.5,
        waves: [100, 125, 160].map((speed) => ({
          speed,
          totalTargets: 5,
          maxActive: 3,
          spawnSeconds: 4.5,
          fps: 11,
        })),
      },
    ]),
  ),
});
export function validGuardSettings(s) {
  const within = (v, [min, max], integer = true) =>
    typeof v === 'number' &&
    Number.isFinite(v) &&
    (!integer || Number.isInteger(v)) &&
    v >= min &&
    v <= max;
  return (
    s?.version === 3 &&
    within(s.shipPercent, GUARD_LIMITS.shipPercent) &&
    within(s.meteorPercent, GUARD_LIMITS.meteorPercent) &&
    [1, 2, 3].every((i) => {
      const stage = s.stages?.[i];
      return (
        stage &&
        within(stage.speed, GUARD_LIMITS.speed) &&
        within(stage.backgroundSpeed, GUARD_LIMITS.backgroundSpeed) &&
        within(stage.transitionSeconds, GUARD_LIMITS.transitionSeconds, false) &&
        Array.isArray(stage.waves) &&
        stage.waves.length === 3 &&
        stage.waves.every(
          (w) =>
            w &&
            within(w.speed, GUARD_LIMITS.waveSpeed) &&
            within(w.totalTargets, GUARD_LIMITS.totalTargets) &&
            within(w.maxActive, GUARD_LIMITS.maxActive) &&
            w.maxActive <= w.totalTargets &&
            within(w.spawnSeconds, GUARD_LIMITS.spawnSeconds, false) &&
            within(w.fps, GUARD_LIMITS.fps),
        )
      );
    })
  );
}
export function loadGuardSettings() {
  let s = load(KEY, null);
  if (s?.version === 1 || s?.version === 2) {
    const defaults = defaultGuardSettings();
    s = {
      ...s,
      version: 3,
      stages: Object.fromEntries(
        [1, 2, 3].map((i) => {
          const old = s.stages?.[i] || {},
            stage = defaults.stages[i];
          // Three positive waves require at least three targets when upgrading an old tiny round.
          const total =
            Number.isInteger(old.totalTargets) && old.totalTargets > 0
              ? Math.max(3, old.totalTargets)
              : 15;
          return [
            i,
            {
              ...stage,
              speed: old.speed ?? stage.speed,
              waves: stage.waves.map((w, index) => {
                const totalTargets = Math.floor(total / 3) + (index < total % 3 ? 1 : 0);
                return {
                  ...w,
                  totalTargets,
                  maxActive: Math.min(old.maxActive ?? 3, totalTargets),
                  spawnSeconds: old.spawnSeconds ?? 4.5,
                };
              }),
            },
          ];
        }),
      ),
    };
  }
  return validGuardSettings(s) ? s : defaultGuardSettings();
}
export function saveGuardSettings(s, user) {
  if (user?.role !== 'admin') throw new Error('Chỉ Admin được chỉnh cấu hình.');
  if (!validGuardSettings(s)) throw new Error('Thông số không nằm trong giới hạn cho phép.');
  save(KEY, s);
  if (JSON.stringify(load(KEY, null)) !== JSON.stringify(s))
    throw new Error('Trình duyệt chưa lưu được cấu hình.');
}
export function guardLevel(settings = loadGuardSettings(), stage = 1) {
  const s = validGuardSettings(settings) ? settings : defaultGuardSettings();
  const chosen = s.stages[stage] || s.stages[1];
  const shipRatio = s.shipPercent / 80,
    meteorRatio = s.meteorPercent / 80;
  return {
    ...GUARD_LEVEL,
    stage,
    ship: {
      ...GUARD_LEVEL.ship,
      length: GUARD_LEVEL.ship.length * shipRatio,
      muzzleOffset: GUARD_LEVEL.ship.muzzleOffset * shipRatio,
    },
    meteorSize: GUARD_LEVEL.meteorSize * meteorRatio,
    collisionRadius: GUARD_LEVEL.collisionRadius * shipRatio,
    speedMultiplier: chosen.speed / 100,
    transitionSeconds: chosen.transitionSeconds,
    waveSettings: chosen.waves.map((w) => ({ ...w, speedMultiplier: w.speed / 100 })),
    totalTargets: chosen.waves.reduce((sum, w) => sum + w.totalTargets, 0),
    waves: 3,
    maxActive: Math.max(...chosen.waves.map((w) => w.maxActive)),
    spawnSeconds: chosen.waves[0].spawnSeconds,
    spawn: { ...GUARD_LEVEL.spawn },
    background: { ...GUARD_LEVEL.background, scrollSpeed: chosen.backgroundSpeed },
  };
}
