import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  ADVENTURE_ART,
  ADVENTURE_WORLDS,
  worldProgress,
} from '../src/features/keyboard-quest/adventure.js';
import { LESSONS, isUnlocked } from '../src/features/keyboard-quest/curriculum.js';

test('adventure uses five existing worlds and preserves lesson unlock rules including demos', () => {
  assert.equal(ADVENTURE_WORLDS.length, 5);
  for (const world of ADVENTURE_WORLDS) {
    assert.ok(world.x > 0 && world.x < 1 && world.y > 0 && world.y < 1);
    const status = worldProgress(world.id, []);
    assert.deepEqual(
      status.lessons,
      LESSONS.filter((lesson) => lesson.world === world.id),
    );
    assert.equal(
      status.state === 'open',
      status.lessons.some((lesson) => isUnlocked(lesson, [])),
    );
    const completed = status.lessons.map((lesson) => ({ lesson_id: lesson.id, completed: true }));
    assert.equal(worldProgress(world.id, completed).state, 'completed');
  }
  assert.equal(worldProgress(2, []).state, 'locked');
  assert.equal(worldProgress(3, []).state, 'open');
  assert.equal(worldProgress(4, []).state, 'open');
  assert.equal(worldProgress(5, []).state, 'locked');
});

test('supplied artwork copies preserve original PNG dimensions and exist for every configured scene', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/quest-art/manifest.json', import.meta.url)),
  );
  assert.equal(manifest.length, Object.keys(ADVENTURE_ART).length);
  for (const entry of manifest) {
    const png = readFileSync(new URL('../public' + entry.src, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), entry.width);
    assert.equal(png.readUInt32BE(20), entry.height);
    assert.equal(png.length, entry.bytes);
    assert.equal(entry.identicalFilteredPixels, true);
    const idat = [];
    for (let offset = 8; offset < png.length; ) {
      const length = png.readUInt32BE(offset);
      if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
        idat.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    assert.equal(
      createHash('sha256')
        .update(inflateSync(Buffer.concat(idat)))
        .digest('hex'),
      entry.filteredPixelsSha256,
    );
    assert.ok(entry.bytes <= entry.sourceBytes);
    assert.equal(entry.src, ADVENTURE_ART[entry.id].src);
  }
});
