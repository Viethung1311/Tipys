import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, speed, advance } from '../src/game/engine.js';
import { DEFAULT } from '../src/game/config.js';
import { createBackend } from '../server/backend.js';
import { createHandler } from '../api/tipy.js';
test('speed changes exactly at 500-point milestones and ignores elapsed time', () => {
  const s = createGame(DEFAULT),
    initial = speed(s);
  s.elapsed = 9999;
  assert.deepEqual(speed(s), initial);
  for (const [score, step] of [
    [499, 0],
    [500, 1],
    [999, 1],
    [1000, 2],
    [1499, 2],
    [1500, 3],
  ]) {
    s.score = score;
    const v = speed(s);
    assert.equal(v.fall, initial.fall - step * 0.5);
    assert.ok(Math.abs(v.spawn - (initial.spawn - step * 0.1)) < 1e-9);
  }
  s.status = 'playing';
  s.score = 500;
  s.spawnIn = 100;
  s.letters = [{ id: 1, key: 'F', y: 0, fall: initial.fall }];
  advance(s, 0.1);
  assert.ok(Math.abs(s.letters[0].y - 0.1 / speed(s).fall) < 1e-10);
});
test('class leaderboard filters active students and game, orders numeric best score and bounds output', async () => {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'not', 'order'])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  query.limit = async (n) => {
    calls.push(['limit', n]);
    return {
      data: [
        {
          user_id: 'child',
          profiles: { full_name: 'Bạn An' },
          best_play: { score: 1000, active_seconds: 50, difficulty: 'easy' },
        },
      ],
    };
  };
  const backend = createBackend(
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only',
      TIPY_AUTH_SECRET: 'x'.repeat(32),
    },
    () => ({ from: () => query }),
  );
  assert.deepEqual(await backend.leaderboard(), [
    { rank: 1, user_id: 'child', name: 'Bạn An', score: 1000, seconds: 50, difficulty: 'easy' },
  ]);
  assert.ok(calls.some((x) => x[0] === 'eq' && x[1] === 'profiles.role' && x[2] === 'student'));
  assert.ok(
    calls.some((x) => x[0] === 'order' && x[1] === 'best_play->score' && x[2].ascending === false),
  );
  assert.ok(calls.some((x) => x[0] === 'limit' && x[1] === 50));
});
test('leaderboard requires a valid session before reading class data', async () => {
  let read = false;
  const handler = createHandler({
    makeBackend: () => ({
      session: async () => {
        throw Object.assign(new Error('login'), { status: 401 });
      },
      leaderboard: async () => {
        read = true;
      },
    }),
  });
  const res = {
    setHeader() {},
    status(n) {
      this.code = n;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
  await handler({ method: 'GET', headers: {}, query: { action: 'leaderboard' } }, res);
  assert.equal(read, false);
});
