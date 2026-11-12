// Frozen scoring rules for the weekly board; teacher practice settings stay independent.
export const RANKED_RULE = 'hard-v1';
export const RANKED_KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
export const RANKED_HARD = { fall: 3, minFall: 1, spawn: 0.95, minSpawn: 0.65, max: 10 };
export const rankedSettings = () => ({
  ranked: true,
  difficulty: 'hard',
  keys: [...RANKED_KEYS],
  levels: { hard: { ...RANKED_HARD } },
});
