import { findLesson } from '../features/keyboard-quest/curriculum.js';
/** Derived from saved best results; retries cannot mint points or count quest accuracy twice. */
export function accountPoints(stats = [], lessons = []) {
  const games = new Map(),
    stars = new Map();
  for (const stat of stats) {
    const code = stat.games?.game_code;
    if (!code || code === 'keyboard_quest') continue;
    const score = Number(stat.best_score ?? stat.best_play?.score ?? 0);
    if (Number.isFinite(score)) games.set(code, Math.max(games.get(code) || 0, score));
  }
  for (const row of lessons) {
    if (row.games?.game_code !== 'keyboard_quest' || !findLesson(row.lesson_id)) continue;
    const score = Number(row.best_stars);
    if (Number.isInteger(score) && score >= 0 && score <= 3)
      stars.set(row.lesson_id, Math.max(stars.get(row.lesson_id) || 0, score));
  }
  return (
    [...games.values()].reduce((n, value) => n + value, 0) +
    10 * [...stars.values()].reduce((n, value) => n + value, 0)
  );
}
