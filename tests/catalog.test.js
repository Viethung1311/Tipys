import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableGames, gameScreen } from '../src/game/catalog.js';
test('game library uses offline fallback, honors active catalog and does not launch unregistered games', () => {
  const offline = availableGames(null);
  assert.equal(offline.length, 3);
  assert.equal(gameScreen(offline[1]), 'quest');
  assert.equal(gameScreen(offline[0]), 'setup');
  assert.equal(gameScreen(offline[2]), 'guard');
  assert.deepEqual(
    availableGames([...offline].reverse()).map((g) => g.game_code),
    ['falling_letters', 'keyboard_quest', 'keyboard_guard'],
  );
  assert.deepEqual(availableGames([]), []);
  const future = { game_code: 'future_game', engine_code: 'future_engine', is_active: true };
  const rows = availableGames([future, { ...offline[0], is_active: false }]);
  assert.deepEqual(rows, [future]);
  assert.equal(gameScreen(future), null);
  assert.equal(gameScreen({ ...offline[0], engine_code: 'unknown' }), undefined);
});
