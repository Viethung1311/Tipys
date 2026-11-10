import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn) {
  for (let i = 0; i < 250; i++) {
    const v = fn();
    if (v) return v;
    await sleep(10);
  }
  throw Error('Timed out waiting for UI');
}
test('complete UI flow: setup, custom keys, input, pause, results, replay, persistence', async () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const w = dom.window,
    d = w.document;
  let now = 0;
  w.requestAnimationFrame = (cb) =>
    w.setTimeout(() => {
      now += 100;
      cb(now);
    }, 10);
  w.cancelAnimationFrame = (id) => w.clearTimeout(id);
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((x) =>
    x.endsWith('.js'),
  );
  const code = readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8');
  w.eval(code);
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = async (text) => {
    const el = await until(() => button(text));
    assert.ok(el);
    el.click();
    await sleep(30);
  };
  try {
    await until(() => d.querySelector('h1'));
    assert.match(d.body.textContent, /Học thật vui/);
    assert.match(d.body.textContent, /Scratch/);
    assert.match(d.body.textContent, /68 Phạm Tứ, Cẩm Lệ, Đà Nẵng/);
    assert.equal(d.querySelector('.game-card'), null);
    assert.equal(d.querySelector('.leaderboard'), null);
    await click('Khám phá trò chơi');
    await click('Chơi ngay');
    await click('Bỏ chọn tất cả');
    assert.equal(button('Bắt đầu chơi').disabled, true);
    await click('4 phím');
    d.querySelector('[aria-label="Chọn phím D"]').click();
    await sleep(20);
    assert.match(d.body.textContent, /Tùy chỉnh · Đã chọn: 5 phím/);
    await click('4 phím');
    await click('Bắt đầu chơi');
    await until(() => d.querySelector('.letter'));
    const first = d.querySelector('.letter').dataset.key;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Key' + first, repeat: true }));
    await sleep(20);
    assert.equal(d.querySelector('[data-testid="score"]').textContent, '0 điểm');
    w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Key' + first }));
    await until(() => d.querySelector('[data-testid="score"]').textContent === '10 điểm');
    w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyZ' }));
    await sleep(10);
    assert.ok(d.querySelector('[aria-label="Còn 3 mạng"]'));
    const letter = await until(() => d.querySelector('.letter'));
    d.querySelector(`[aria-label="Gõ ${letter.dataset.key}"]`).click();
    await until(() => d.querySelector('[data-testid="score"]').textContent === '20 điểm');
    d.querySelector('[aria-label="Tạm dừng"]').click();
    await until(() => d.querySelector('[role="dialog"]'));
    const frozen = d.querySelector('.timer strong').textContent;
    await sleep(100);
    assert.equal(d.querySelector('.timer strong').textContent, frozen);
    await click('Tiếp tục');
    d.dispatchEvent(new w.Event('visibilitychange')); // Visible event must not pause.
    await until(() => d.querySelector('.letter'));
    w.dispatchEvent(new w.Event('blur'));
    await until(() => d.querySelector('[role="dialog"]'));
    await click('Tiếp tục');
    await until(() => d.querySelector('.result-score'));
    assert.match(d.querySelector('.result-score').textContent, /20/);
    assert.match(d.querySelector('.result-grid').textContent, /67%/);
    assert.equal(JSON.parse(w.localStorage.getItem('tipy-best-easy-FGHJ')), 20);
    await click('Chơi lại nào');
    await until(() => d.querySelector('.countdown'));
    assert.match(d.querySelector('[data-testid="score"]').textContent, /^0/);
    d.querySelector('[aria-label="Tạm dừng"]').click();
    await until(() => d.querySelector('[role="dialog"]'));
    await click('Về trang chủ');
    await until(() => d.querySelector('.hero'));
    await click('Khám phá trò chơi');
    await click('Chơi ngay');
    assert.match(d.body.textContent, /Đã chọn: 4 phím/);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
