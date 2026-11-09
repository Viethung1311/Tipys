import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, physicalKey, PRESETS } from '../src/game/config.js';
import { createGame, press, advance } from '../src/game/engine.js';
import { validateProgress } from '../server/backend.js';
import { resultRows } from '../src/game/results.js';
test('five wrong presses are allowed, sixth ends immediately and further presses cannot score', () => {
  const state = createGame(DEFAULT);
  state.status = 'playing';
  for (let i = 0; i < 5; i++) press(state, 'Z');
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 3);
  press(state, 'Z');
  assert.equal(state.status, 'result');
  assert.equal(state.endReason, 'wrong_limit');
  assert.equal(state.wrong, 6);
  const snapshot = JSON.stringify(state);
  press(state, 'F');
  advance(state, 20);
  assert.equal(JSON.stringify(state), snapshot);
});
test('number and punctuation keys work on physical and touch input', () => {
  for (const [code, key] of [
    ['Digit1', '1'],
    ['Digit0', '0'],
    ['Numpad9', '9'],
    ['Semicolon', ';'],
    ['Quote', "'"],
    ['Comma', ','],
    ['Period', '.'],
    ['Slash', '/'],
  ])
    assert.equal(physicalKey(code), key);
  assert.equal(physicalKey('Space'), null);
  assert.equal(new Set(PRESETS['Tất cả']).size, 41);
  for (const key of "1234567890;',./") {
    const state = createGame({ ...DEFAULT, keys: [key] });
    state.status = 'playing';
    state.letters = [{ id: 1, key, y: 0.5 }];
    press(state, key);
    assert.equal(state.score, 10);
  }
});
test('server accepts loss by sixth mistake with lives left, rejects early or excessive claims', () => {
  const play = {
    score: 0,
    active_seconds: 0,
    started_at: new Date(0).toISOString(),
    metrics: {},
    games: { engine_code: 'falling_letters' },
  };
  const input = {
    seconds: 2,
    score: 0,
    result: 'game_over',
    metrics: { correct: 0, wrong: 6, missed: 0 },
  };
  assert.equal(validateProgress(play, input, 2000).result, 'game_over');
  assert.throws(() =>
    validateProgress(play, { ...input, metrics: { correct: 0, wrong: 5, missed: 0 } }, 2000),
  );
  assert.throws(() =>
    validateProgress(play, { ...input, metrics: { correct: 0, wrong: 7, missed: 0 } }, 2000),
  );
});
test('best and recent are at most two rows and one shared round is never duplicated', () => {
  const base = {
    user_id: 'u',
    game_id: 'g',
    total_active_seconds: 100,
    total_plays: 4,
    profiles: { full_name: 'An' },
    games: { game_name: 'Typing' },
  };
  assert.equal(
    resultRows([
      { ...base, best_play: { play_id: 'a', score: 90 }, latest_play: { play_id: 'b', score: 10 } },
    ]).length,
    2,
  );
  const rows = resultRows([
    { ...base, best_play: { play_id: 'a', score: 90 }, latest_play: { play_id: 'a', score: 90 } },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result_type, 'best_recent');
  assert.equal(rows[0].total_active_seconds, 100);
});
