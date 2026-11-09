import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 300; i++) {
    if (fn()) return;
    await sleep(10);
  }
  throw Error('Classroom UI timeout');
}
const classroom = {
  class_id: '11111111-1111-4111-8111-111111111111',
  name: 'STEM 3A',
  archived_at: null,
};
const child = {
  user_id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Bạn An',
  role: 'student',
};
const detail = {
  classroom,
  members: [
    {
      user_id: child.user_id,
      name: child.full_name,
      avatar: { animal: 'cat', color: 'sky', accessory: 'book' },
    },
  ],
  posts: [
    {
      post_id: 'p',
      title: 'Bài luyện số 1',
      body: 'Nội dung bài học',
      link: 'https://example.com/lesson',
      created_at: '2026-11-09T10:00:00Z',
      class_attachments: [],
    },
  ],
};
test('member navigates classroom, sees desks/posts and saves own zodiac avatar', async () => {
  const errors = [],
    requests = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole: vc,
  });
  const w = dom.window,
    d = w.document;
  w.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push(body || url);
    const action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    const values = {
      bootstrap: { configured: true, user: child, games: [], classes: [classroom] },
      classes: { classes: [classroom] },
      classroom: detail,
      leaderboard: { leaderboard: [] },
      avatar_save: { data: {} },
    };
    return { ok: true, json: async () => values[action] };
  };
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  try {
    await until(() => button('Lớp học') && !button('Lớp học').disabled);
    button('Lớp học').click();
    await until(() => d.querySelector('.class-desks'));
    assert.match(d.querySelector('.student-desk').textContent, /Bạn An/);
    assert.match(d.querySelector('.class-post').textContent, /Bài luyện số 1/);
    assert.equal(d.querySelector('.class-post a').href, 'https://example.com/lesson');
    assert.equal(d.querySelectorAll('.avatar-editor select')[0].options.length, 12);
    const select = d.querySelector('.avatar-editor select');
    select.value = 'dragon';
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(20);
    button('Lưu nhân vật').click();
    await until(() => requests.some((r) => r.action === 'avatar_save'));
    assert.equal(requests.find((r) => r.action === 'avatar_save').animal, 'dragon');
    assert.equal(d.querySelector('.class-composer'), null);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
test('guest cannot activate classroom navigation', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const w = dom.window,
    d = w.document;
  w.fetch = async () => ({
    ok: true,
    json: async () => ({ configured: true, user: null, games: [], classes: [] }),
  });
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  try {
    await until(() => d.querySelector('.main-nav'));
    assert.equal(
      [...d.querySelectorAll('.main-nav button')].find((b) => b.textContent === 'Lớp học').disabled,
      true,
    );
    assert.match(
      d.querySelector('.main-nav').textContent,
      /Trang chủ.*Gõ chữ.*Lớp học.*Tài khoản/s,
    );
  } finally {
    w.close();
  }
});
