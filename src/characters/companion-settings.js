import { load, save } from '../game/config.js';
export const companionKey = (userId) => `tipy-companion:${userId || 'guest'}`;
export const companionSize = (size) =>
  typeof size === 'number' && Number.isFinite(size) ? Math.max(60, Math.min(160, size)) : 100;
export function normalizeCompanion(value) {
  const coordinate = (n) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  return {
    visible: value?.visible !== false,
    x: coordinate(value?.x),
    y: coordinate(value?.y),
    size: companionSize(value?.size),
  };
}
export const readCompanion = (key) => normalizeCompanion(load(key, {}));
export function saveCompanion(key, value) {
  save(key, normalizeCompanion(value));
}
