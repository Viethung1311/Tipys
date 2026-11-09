import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, speed, advance } from '../src/game/engine.js';
import { DEFAULT } from '../src/game/config.js';
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
test('removed global leaderboard is not available to authenticated users', async () => {
  let read = false;
  const handler = createHandler({
    makeBackend: () => ({
      session: async () => ({ profile: { user_id: 'u', role: 'student' } }),
      leaderboard: async () => {
        read = true;
      },
    }),
  });
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await handler({ method: 'GET', headers: {}, query: { action: 'leaderboard' } }, res);
  assert.equal(res.code, 404);
  assert.equal(read, false);
});
