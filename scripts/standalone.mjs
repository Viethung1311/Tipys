import {readFile,writeFile,readdir} from 'node:fs/promises';
const assets=await readdir(new URL('../dist/assets/',import.meta.url));
const js=await readFile(new URL('../dist/assets/'+assets.find(x=>x.endsWith('.js')),import.meta.url),'utf8');
const css=await readFile(new URL('../dist/assets/'+assets.find(x=>x.endsWith('.css')),import.meta.url),'utf8');
await writeFile(new URL('../../TIPY-STEM-choi-ngay.html',import.meta.url),`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TIPY STEM · Vườn phím nhỏ</title><style>${css}</style></head><body><div id="root"></div><script type="module">${js.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('Created standalone HTML: TIPY-STEM-choi-ngay.html');
