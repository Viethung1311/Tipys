import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountPoints } from '../src/game/points.js';
import { classMembersView } from '../server/modules/classrooms.js';
import { createStars } from '../server/modules/stars.js';
import { createHandler } from '../api/tipy.js';
test('one site total uses each game best and each lesson best stars without duplicate quest score', () => {
  const stats = [
    { best_play: { score: 500 }, games: { game_code: 'falling_letters' } },
    { best_play: { score: 300 }, games: { game_code: 'falling_letters' } },
    { best_play: { score: 1000 }, games: { game_code: 'keyboard_quest' } },
    { best_play: { score: 20 }, games: { game_code: 'future_game' } },
  ];
  const lessons = [
    { lesson_id: 'keys-as', best_stars: 3, games: { game_code: 'keyboard_quest' } },
    { lesson_id: 'keys-as', best_stars: 2, games: { game_code: 'keyboard_quest' } },
    { lesson_id: 'keys-asdf', best_stars: 1, games: { game_code: 'keyboard_quest' } },
    { lesson_id: 'unknown', best_stars: 3, games: { game_code: 'keyboard_quest' } },
  ];
  assert.equal(accountPoints(stats, lessons), 560);
  assert.equal(accountPoints(stats, [...lessons, ...lessons]), 560);
  assert.equal(
    classMembersView([
      {
        user_id: 'member',
        profiles: { full_name: 'Test', player_game_stats: stats, player_lesson_progress: lessons },
      },
    ])[0].best_score,
    undefined,
  );
});
test('star service reads only the current account, never a browser-supplied user or star amount', async () => {
  const calls = [];
  const service = createStars({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: { stars: 3, lessonStars: 3, weeklyStars: 0 } };
    },
  });
  assert.deepEqual(
    await service.stars(
      { user_id: 'current-admin', role: 'admin' },
      { userId: 'another-child', stars: 999 },
    ),
    { stars: 3, lessonStars: 3, weeklyStars: 0 },
  );
  assert.deepEqual(calls, [['tipy_star_total', { p_user: 'current-admin' }]]);
});
test('retired reset and direct point writes cannot be called through authenticated API', async () => {
  const handler = createHandler({
    makeBackend: () => ({
      session: async () => ({ profile: { user_id: 'child', role: 'student' } }),
    }),
  });
  for (const action of ['quest_reset', 'points']) {
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json() {
        return this;
      },
    };
    await handler(
      {
        method: 'POST',
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        body: { action, confirm: true, points: 99999 },
      },
      res,
    );
    assert.equal(res.code, 404);
  }
});
