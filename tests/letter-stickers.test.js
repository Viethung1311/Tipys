import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LETTER_STICKERS, stickerFor } from '../src/features/keyboard-quest/letter-stickers.js';

test('32 exact-character stickers use local transparent PNGs, NFC is display-only, and missing accents never lose their marks', () => {
  assert.equal(Object.keys(LETTER_STICKERS).length, 32);
  assert.equal(
    readdirSync(new URL('../src/assets/alphabet/', import.meta.url)).filter((n) =>
      n.endsWith('.png'),
    ).length,
    32,
  );
  for (const [character, file] of Object.entries(LETTER_STICKERS)) {
    const png = readFileSync(new URL('../src/assets/alphabet/' + file, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, 'RGBA transparency preserved');
    assert.ok(png.length < 50000);
    assert.equal(stickerFor(character), file);
  }
  assert.equal(stickerFor('A\u0306'), 'A_breve.png');
  for (const character of ['Đ', 'đ', 'á', 'ấ', 'ă', 'a', '0', ';', 'Space', 'BA', 'Em yêu mẹ.'])
    assert.equal(stickerFor(character), null);
});
