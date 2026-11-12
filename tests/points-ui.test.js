import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { LESSONS } from '../src/features/keyboard-quest/curriculum.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 250; i++) {
    const value = check();
    if (value) return value;
    await sleep(10);
  }
  throw Error('Points UI timed out');
}
test('shared account points refresh after a saved lesson, survive navigation and clear on logout despite stale reads', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/#typing/quest',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document;
  let user = { user_id: 'child', full_name: 'Test', role: 'student' },
    points = 100,
    hold = false,
    finishRead;
  const response = (data) => ({ ok: true, json: async () => data });
  w.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null,
      action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    if (action === 'bootstrap')
      return response({
        configured: true,
        user,
        games: [{ game_code: 'keyboard_quest', engine_code: 'keyboard_quest', is_active: true }],
        classes: [],
      });
    if (action === 'points') {
      if (hold)
        return new Promise((resolve) => {
          finishRead = () => resolve(response({ points: 999999 }));
        });
      return response({ points });
    }
    if (action === 'quest_progress') return response({ progress: [] });
    if (action === 'avatar') return response({ avatar: {} });
    if (action === 'start') return response({ data: { play_id: 'test-play' } });
    if (action === 'quest_finish') {
      points = 130;
      return response({
        data: { progress: { lesson_id: 'keys-as', completed: true, best_stars: 3 } },
      });
    }
    if (action === 'logout') {
      user = null;
      return response({ ok: true });
    }
    return response({});
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((file) =>
    file.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((el) => el.textContent.trim() === text);
  try {
    await until(() => d.querySelector('.account-points')?.textContent.includes('100'));
    (await until(() => d.querySelector('[data-world-id="1"]'))).click();
    (await until(() => button('Bắt đầu'))).click();
    (await until(() => button('Vào học'))).click();
    await until(() => d.querySelector('.quest-target'));
    for (const item of LESSONS[0].items) {
      d.querySelector(`[aria-label="Gõ ${item.target}"]`).click();
      await sleep(15);
    }
    await until(() => d.querySelector('.account-points').textContent.includes('130'));
    d.querySelector('[aria-label="Zunimo trang chủ"]').click();
    await until(() => d.querySelector('.welcome-hero'));
    assert.match(d.querySelector('.account-points').textContent, /130/);
    hold = true;
    w.dispatchEvent(new w.Event('tipy-points-changed'));
    await until(() => finishRead);
    d.querySelector('.account-button').click();
    (await until(() => button('Đăng xuất'))).click();
    await until(() => !d.querySelector('.account-points'));
    finishRead();
    await sleep(30);
    assert.equal(d.querySelector('.account-points'), null);
    assert.doesNotMatch(d.body.textContent, /999999/);
  } finally {
    dom.window.close();
  }
});
