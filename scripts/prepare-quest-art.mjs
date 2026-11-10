/** Lossless PNG compression only. Dimensions, filtered pixels, alpha and other chunks stay unchanged. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ADVENTURE_ART } from '../src/features/keyboard-quest/adventure.js';
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw Error('Provide the folder containing the supplied PNG files.');
const output = path.resolve('public/quest-art');
await mkdir(output, { recursive: true });
const manifest = [];
for (const [id, art] of Object.entries(ADVENTURE_ART)) {
  const source = await readFile(path.join(sourceDirectory, art.source));
  assert.equal(source.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = [];
  for (let offset = 8; offset < source.length; ) {
    const length = source.readUInt32BE(offset),
      type = source.toString('ascii', offset + 4, offset + 8);
    const raw = source.subarray(offset, offset + length + 12);
    assert.equal(raw.length, length + 12);
    chunks.push({ type, data: raw.subarray(8, 8 + length), raw });
    offset += length + 12;
  }
  const original = Buffer.concat(
    chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data),
  );
  const pixels = inflateSync(original),
    candidate = deflateSync(pixels, { level: 9 });
  const compressed = candidate.length < original.length ? candidate : original;
  assert.ok(inflateSync(compressed).equals(pixels), 'Filtered pixel bytes must remain identical');
  const body = Buffer.concat([Buffer.from('IDAT'), compressed]),
    chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(compressed.length);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  let inserted = false;
  const encoded = Buffer.concat([
    source.subarray(0, 8),
    ...chunks.flatMap((value) => {
      if (value.type !== 'IDAT') return [value.raw];
      if (inserted) return [];
      inserted = true;
      return [chunk];
    }),
  ]);
  const optimized = encoded.length < source.length ? encoded : source;
  await writeFile(path.join(output, path.basename(art.src)), optimized);
  manifest.push({
    id,
    source: art.source,
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    filteredPixelsSha256: createHash('sha256').update(pixels).digest('hex'),
    src: art.src,
    width: source.readUInt32BE(16),
    height: source.readUInt32BE(20),
    sourceBytes: source.length,
    bytes: optimized.length,
    identicalFilteredPixels: true,
  });
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    images: manifest.length,
    originalBytes: manifest.reduce((sum, image) => sum + image.sourceBytes, 0),
    optimizedBytes: manifest.reduce((sum, image) => sum + image.bytes, 0),
    pixelDataUnchanged: true,
  }),
);
