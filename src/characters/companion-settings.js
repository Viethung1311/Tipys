import { load, save } from '../game/config.js';
export const companionKey = (userId) => `tipy-companion:${userId || 'guest'}`;
export function normalizeCompanion(value) {
  const coordinate = (n) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  return { visible: value?.visible !== false, x: coordinate(value?.x), y: coordinate(value?.y) };
}
export const readCompanion = (key) => normalizeCompanion(load(key, {}));
export function saveCompanion(key, value) {
  save(key, normalizeCompanion(value));
}
