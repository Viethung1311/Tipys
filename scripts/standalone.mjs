import { build } from 'vite';
await build({ mode: 'test', build: { outDir: '.standalone-dist' } });
import { readFile, writeFile, readdir } from 'node:fs/promises';
const directory = new URL('../.standalone-dist/assets/', import.meta.url),
  assets = await readdir(directory);
let js = await readFile(
  new URL(
    assets.find((x) => x.endsWith('.js')),
    directory,
  ),
  'utf8',
);
const css = await readFile(
  new URL(
    assets.find((x) => x.endsWith('.css')),
    directory,
  ),
  'utf8',
);
// Keep user-supplied artwork available in the standalone/offline version too.
for (const filename of assets) {
  const extension = filename.split('.').pop();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[
    extension
  ];
  if (mime) {
    const bytes = await readFile(new URL(filename, directory));
    js = js.replaceAll(`/assets/${filename}`, `data:${mime};base64,${bytes.toString('base64')}`);
  }
}
await writeFile(
  new URL('../../TIPY-STEM-choi-ngay.html', import.meta.url),
  `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TIPY STEM · Vườn phím nhỏ</title><style>${css}</style></head><body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>`,
);
console.log('Created standalone HTML: TIPY-STEM-choi-ngay.html');
