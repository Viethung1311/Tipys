import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await sleep(10);
  }
  throw Error('Loading UI timeout');
}
test('animated loader stays visible while bootstrap is pending and disappears on completion or failure', async () => {
  for (const fail of [false, true]) {
    const dom = new JSDOM('<div id="root"></div>', {
      url: 'https://tipy.test',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    });
    const w = dom.window,
      d = w.document;
    let finish;
    w.fetch = () =>
      new Promise((resolve, reject) => {
        finish = () =>
          fail
            ? reject(Error('offline'))
            : resolve({
                ok: true,
                json: async () => ({ configured: false, user: null, games: [] }),
              });
      });
    const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((x) =>
      x.endsWith('.js'),
    );
    w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
    try {
      await until(() => finish && d.querySelector('.loading-fullscreen'));
      assert.equal(d.querySelector('.loading-letters').textContent.replace('\u00a0', ' '), 'A');
      assert.equal(d.querySelectorAll('.loading-letters span').length, 1);
      assert.equal(d.querySelectorAll('.loading-key').length, 1);
      assert.equal(d.querySelectorAll('.loading-space').length, 0);
      assert.equal(d.querySelector('.welcome-hero').classList.contains('hero-ready'), false);
      finish();
      await until(() => !d.querySelector('.loading-fullscreen'));
      assert.ok(d.querySelector('h1'));
      await until(() => d.querySelector('.welcome-hero').classList.contains('hero-ready'));
    } finally {
      w.close();
    }
  }
});
