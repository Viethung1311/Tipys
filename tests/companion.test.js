import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companionKey, normalizeCompanion } from '../src/characters/companion-settings.js';
test('companion preferences reject malformed positions and stay scoped to each account', () => {
  assert.deepEqual(normalizeCompanion(null), { visible: true, x: 1, y: 1, size: 100 });
  assert.deepEqual(normalizeCompanion({ visible: false, x: -5, y: 42 }), {
    visible: false,
    x: 0,
    y: 1,
    size: 100,
  });
  assert.deepEqual(normalizeCompanion({ visible: 'false', x: NaN, y: '0.5' }), {
    visible: true,
    x: 1,
    y: 1,
    size: 100,
  });
  assert.notEqual(companionKey('a'), companionKey('b'));
  assert.notEqual(companionKey(), companionKey('a'));
});

test('companion sizes clamp unsafe data and retain legacy defaults', () => {
  assert.equal(normalizeCompanion({ size: 10000 }).size, 160);
  assert.equal(normalizeCompanion({ size: -10 }).size, 60);
  assert.equal(normalizeCompanion({ size: '160' }).size, 100);
  assert.equal(normalizeCompanion({ size: NaN }).size, 100);
});
