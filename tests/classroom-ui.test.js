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
      class_attachments: [
        { attachment_id: 'file-one', name: 'anh.jpg', mime_type: 'image/jpeg', size_bytes: 500000 },
      ],
    },
  ],
};
detail.posts = Array.from({ length: 20 }, (_, index) => ({
  ...detail.posts[0],
  post_id: 'post-' + index,
}));

test('member sees square roster and class top, then changes avatar through account', async () => {
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
      class_posts: { posts: [{ ...detail.posts[0], post_id: 'older-post', title: 'Bài cũ hơn' }] },
      class_file: {
        url: 'https://files.test/original.jpg',
        previewUrl: 'https://files.test/preview.webp',
      },
      avatar: { avatar: detail.members[0].avatar },
      avatar_save: { data: { animal: 'icon_29', accessory: 'book', color: 'sky' } },
    };
    return { ok: true, json: async () => values[action] };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  try {
    await until(() => button('Lớp học') && !button('Lớp học').disabled);
    button('Lớp học').click();
    await until(() => d.querySelector('.class-desks'));
    assert.match(d.querySelector('.student-desk').textContent, /Bạn An/);
    assert.match(d.querySelector('.class-post').textContent, /Bài luyện số 1/);
    assert.equal(d.querySelector('.class-post a').href, 'https://example.com/lesson');
    assert.equal(d.querySelectorAll('.class-desks > li').length, 1);
    assert.match(d.querySelector('.class-achievements').textContent, /Top thành tích/);
    assert.equal(d.querySelector('.avatar-editor'), null);
    assert.equal(
      requests.filter((r) => typeof r === 'string' && r.includes('action=classes&')).length,
      0,
    );
    button('📎 anh.jpg').click();
    await until(() => d.querySelector('.class-attachment img'));
    assert.equal(d.querySelector('.class-attachment img').src, 'https://files.test/preview.webp');
    button('📎 anh.jpg').click();
    await sleep(20);
    assert.equal(
      requests.filter((r) => typeof r === 'string' && r.includes('action=class_file')).length,
      2,
    );
    button('Trang chủ').click();
    await until(() => d.querySelector('.welcome-hero'));
    button('Lớp học').click();
    await until(() => d.querySelector('.class-desks'));
    assert.equal(
      requests.filter((r) => typeof r === 'string' && r.includes('action=classroom')).length,
      2,
    );
    button('Xem bài cũ hơn').click();
    await until(() => d.querySelectorAll('.class-post').length === 21);
    assert.equal(
      requests.filter((r) => typeof r === 'string' && r.includes('action=classroom')).length,
      2,
    );
    assert.ok(
      requests.some(
        (r) => typeof r === 'string' && r.includes('action=class_posts') && r.includes('offset=20'),
      ),
    );
    button('Tài khoản · Bạn An').click();
    await until(() => button('Nhân vật'));
    button('Nhân vật').click();
    await until(() => d.querySelectorAll('.character-options input').length === 36);
    await until(() => !d.querySelector('.account-avatar-editor fieldset').disabled);
    d.querySelector('.character-options input[value="icon_29"]').click();
    await sleep(20);
    button('Lưu nhân vật').click();
    await until(() => requests.some((r) => r.action === 'avatar_save'));
    await until(() => d.body.textContent.includes('Đã lưu nhân vật'));
    assert.equal(requests.find((r) => r.action === 'avatar_save').animal, 'icon_29');
    assert.equal(requests.find((r) => r.action === 'avatar_save').classId, undefined);
    d.querySelector('[aria-label="Đóng chọn nhân vật"]').click();
    await until(() => !d.querySelector('[role=dialog]'));
    assert.ok(
      d
        .querySelector('.student-desk .student-avatar > img')
        .src.endsWith('/characters/icon_29.png'),
    );
    assert.ok(d.querySelector('.avatar-button img').src.endsWith('/characters/icon_29.png'));
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
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  try {
    await until(() => d.querySelector('.main-nav'));
    assert.equal(
      [...d.querySelectorAll('.main-nav button')].find((b) => b.textContent === 'Lớp học'),
      undefined,
    );
    assert.match(d.querySelector('.main-nav').textContent, /Trang chủ.*Gõ chữ.*Tài khoản/s);
  } finally {
    w.close();
  }
});
