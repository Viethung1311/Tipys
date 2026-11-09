import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 250; i++) {
    const value = check();
    if (value) return value;
    await sleep(10);
  }
  throw Error('Timed out waiting for account UI');
}
test('child account signup needs no email and accepts a one-character PIN; history and logout work', async () => {
  const errors = [],
    requests = [];
  let user = null;
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy-account.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const w = dom.window,
    d = w.document;
  let reveal,
    disconnected = false;
  w.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(el) {
      if (el.classList.contains('leaderboard')) reveal = this.callback;
    }
    disconnect() {
      disconnected = true;
    }
  };
  w.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push(body || url);
    let value;
    if (body?.action === 'signup') {
      user = {
        user_id: 'child',
        username: body.username,
        full_name: body.fullName,
        role: 'student',
      };
      value = { user };
    } else if (body?.action === 'logout') {
      user = null;
      value = { ok: true };
    } else if (url.includes('leaderboard'))
      value = {
        leaderboard: [
          { rank: 1, user_id: 'child', name: 'Bạn An', score: 500, difficulty: 'easy' },
        ],
      };
    else if (url.includes('history')) value = { history: [] };
    else value = { configured: true, user, games: [] };
    return { ok: true, json: async () => value };
  };
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((name) =>
    name.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = async (text) => {
    (await until(() => button(text))).click();
    await sleep(25);
  };
  try {
    await until(() => reveal);
    assert.equal(d.querySelector('.leaderboard').classList.contains('is-revealed'), false);
    reveal([{ isIntersecting: false }]);
    assert.equal(disconnected, false);
    reveal([{ isIntersecting: true }]);
    await until(() => d.querySelector('.leaderboard').classList.contains('is-revealed'));
    assert.equal(disconnected, true);
    await click('Đăng nhập');
    await click('Đăng ký');
    assert.equal(d.querySelector('[name="email"]'), null);
    assert.equal(d.querySelector('[name="password"]').hasAttribute('minlength'), false);
    d.querySelector('[name="fullName"]').value = 'Bạn An';
    d.querySelector('[name="username"]').value = 'banan';
    d.querySelector('[name="password"]').value = '1';
    d.querySelector('form').dispatchEvent(
      new w.Event('submit', { bubbles: true, cancelable: true }),
    );
    await until(() => d.body.textContent.includes('Xin chào, Bạn An!'));
    assert.equal(requests.find((r) => r.action === 'signup').password, '1');
    assert.equal(d.body.textContent.includes('Quản lý game'), false);
    await until(() => d.querySelector('.ranking-list'));
    assert.match(d.querySelector('.ranking-list').textContent, /Bạn An.*500/s);
    await click('Lịch sử chơi');
    await until(() => d.body.textContent.includes('Chưa có lượt chơi'));
    await click('Tài khoản');
    await click('Đăng xuất');
    await until(() => d.querySelector('[name="password"]'));
    assert.equal(user, null);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
