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
test('child signup accepts a one-character PIN; history tab is absent and logout works', async () => {
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
    } else if (url.includes('history')) value = { history: [] };
    else value = { configured: true, user, games: [] };
    return { ok: true, json: async () => value };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((name) =>
    name.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = async (text) => {
    (await until(() => button(text))).click();
    await sleep(25);
  };
  try {
    await until(() => d.querySelector('.main-nav'));
    (
      await until(() =>
        [...d.querySelectorAll('.main-nav button')].find((b) => b.textContent === 'Gõ chữ'),
      )
    ).click();
    assert.equal(d.querySelector('.leaderboard'), null);
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
    assert.equal(
      requests.some((r) => typeof r === 'string' && r.includes('leaderboard')),
      false,
    );
    assert.equal(button('Lịch sử chơi'), undefined);
    assert.equal(
      requests.some((r) => typeof r === 'string' && r.includes('action=history')),
      false,
    );
    await click('Đăng xuất');
    await until(() => d.querySelector('[name="password"]'));
    assert.equal(user, null);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
