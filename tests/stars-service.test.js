import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStars } from '../server/modules/stars.js';
import { createGames } from '../server/modules/games.js';
import { validateProgress } from '../server/modules/game-validation.js';
import { createHandler } from '../api/tipy.js';
const id = '00000000-0000-4000-8000-000000000001';
test('ranked start accepts only the server-defined game and never uses browser scoring settings', async () => {
  const calls = [];
  const service = createGames({
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({
        data: {
          game_id: id,
          game_code: 'falling_letters',
          engine_code: 'falling_letters',
          config: { levels: {} },
        },
      }),
    }),
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: { play_id: 'test' } };
    },
  });
  await service.start(
    { user_id: id },
    { gameCode: 'falling_letters', ranked: true, difficulty: 'easy', keys: ['F'], stars: 999 },
  );
  assert.deepEqual(calls, [['tipy_begin_ranked', { p_user: id, p_game: id }]]);
  const play = {
    started_at: new Date(Date.now() - 10000).toISOString(),
    active_seconds: 0,
    score: 0,
    games: { engine_code: 'falling_letters' },
    metrics: { config_snapshot: { ranked_rule: 'hard-v1' } },
  };
  assert.throws(
    () =>
      validateProgress(play, {
        seconds: 1,
        score: 350,
        result: 'game_over',
        metrics: { correct: 35, wrong: 6, missed: 0 },
      }),
    /sinh chữ/,
  );
});
test('class star board forwards authenticated identity and rejects malformed scopes and lost membership', async () => {
  const calls = [];
  const service = createStars({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { error: { message: 'Class access denied' } };
    },
  });
  await assert.rejects(service.classStars({ user_id: id }, { classId: 'bad' }));
  await assert.rejects(service.classStars({ user_id: id }, { classId: id, week: 'not-a-date' }));
  assert.equal(calls.length, 0);
  await assert.rejects(
    service.classStars(
      { user_id: id },
      { classId: id, week: '2026-11-09', userId: 'forged-admin' },
    ),
    (e) => e.status === 403,
  );
  assert.deepEqual(calls[0][1], { p_actor: id, p_class: id, p_week: '2026-11-09' });
});
test('no browser endpoint awards stars, settles weeks or exposes the retired common-points total', async () => {
  const handler = createHandler({
    makeBackend: () => ({ session: async () => ({ profile: { user_id: id, role: 'student' } }) }),
  });
  for (const action of ['stars', 'award_stars', 'close_star_weeks', 'class_stars', 'points']) {
    const response = {
      setHeader() {},
      status(n) {
        this.code = n;
        return this;
      },
      json() {},
    };
    await handler(
      {
        method: action === 'points' ? 'GET' : 'POST',
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        query: { action },
        body: { action, amount: 999 },
      },
      response,
    );
    assert.equal(response.code, 404);
  }
});
