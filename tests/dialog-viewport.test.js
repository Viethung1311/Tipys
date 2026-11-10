import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 250; i++) {
    if (fn()) return;
    await sleep(10);
  }
  throw Error('Dialog viewport timeout');
}
test('account and audio dialogs track the visible viewport and remove listeners on close', async () => {
  const errors = [],
    vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window,
    d = w.document;
  const listeners = new Map();
  const viewport = {
    width: 390,
    height: 844,
    offsetTop: 0,
    offsetLeft: 0,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type).delete(fn);
    },
  };
  Object.defineProperty(w, 'visualViewport', { value: viewport });
  w.fetch = async () => ({
    ok: true,
    json: async () => ({ configured: true, user: null, games: [], classes: [] }),
  });
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((x) =>
    x.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const click = async (text) => {
    await until(() => [...d.querySelectorAll('button')].some((b) => b.textContent.includes(text)));
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text)).click();
    await sleep(20);
  };
  try {
    await click('Tài khoản · Đăng nhập');
    await until(
      () =>
        d.querySelector('.dialog-viewport')?.style.getPropertyValue('--dialog-height') === '844px',
    );
    assert.equal(d.querySelector('[role=dialog]').parentElement.className, 'dialog-viewport');
    viewport.height = 320;
    viewport.offsetTop = 52;
    for (const fn of listeners.get('resize')) fn();
    await until(
      () =>
        d.querySelector('.dialog-viewport').style.getPropertyValue('--dialog-height') === '320px',
    );
    assert.equal(
      d.querySelector('.dialog-viewport').style.getPropertyValue('--dialog-top'),
      '52px',
    );
    await click('Đóng');
    await until(() => !d.querySelector('[role=dialog]'));
    assert.equal(listeners.get('resize').size, 0);
    d.querySelector('[aria-label="Cài đặt âm thanh"]').click();
    await until(() => d.querySelector('.audio-settings'));
    assert.equal(d.querySelector('[role=dialog]').parentElement.className, 'dialog-viewport');
    viewport.height = 390;
    viewport.width = 844;
    viewport.offsetTop = 0;
    for (const fn of listeners.get('resize')) fn();
    await until(
      () =>
        d.querySelector('.dialog-viewport').style.getPropertyValue('--dialog-width') === '844px',
    );
    await click('Xong rồi');
    await until(() => !d.querySelector('[role=dialog]'));
    assert.equal(listeners.get('resize').size, 0);
    assert.equal(listeners.get('scroll').size, 0);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
