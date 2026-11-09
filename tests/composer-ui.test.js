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
  throw Error('Composer preview timeout');
}
test('teacher sees side-by-side local draft preview; images are revoked and unsafe links are not clickable', async () => {
  const requests = [],
    errors = [],
    revoked = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/#classroom',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole: vc,
  });
  const w = dom.window,
    d = w.document;
  const c = { class_id: 'c', name: 'Lớp Scratch', archived_at: null };
  w.URL.createObjectURL = () => 'blob:local-draft';
  w.URL.revokeObjectURL = (url) => revoked.push(url);
  w.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null,
      action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    requests.push(action);
    const values = {
      bootstrap: {
        configured: true,
        user: { user_id: 'admin', role: 'admin', full_name: 'Giáo viên' },
        games: [],
        classes: [c],
      },
      classes: { classes: [c] },
      classroom: { classroom: c, members: [], achievements: [], posts: [] },
    };
    return { ok: true, json: async () => values[action] };
  };
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((x) =>
    x.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  const fill = (selector, value) => {
    const input = d.querySelector(selector),
      proto =
        input.tagName === 'TEXTAREA'
          ? w.HTMLTextAreaElement.prototype
          : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  try {
    await until(() => d.querySelector('.composer-layout'));
    assert.ok(d.querySelector('.composer-layout .composer-form'));
    assert.ok(d.querySelector('.composer-layout .composer-preview'));
    fill('.composer-form [name=title]', 'Bài Scratch vui');
    fill('.composer-form [name=body]', '<img src=x onerror=alert(1)>');
    fill('.composer-form [name=link]', 'https://example.com/lesson');
    await until(() => d.querySelector('.preview-paper h3').textContent === 'Bài Scratch vui');
    assert.equal(d.querySelector('.preview-paper > p').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(d.querySelector('.preview-paper img'), null);
    assert.equal(d.querySelector('.preview-paper a').href, 'https://example.com/lesson');
    fill('.composer-form [name=link]', 'javascript:alert(1)');
    await until(() => !d.querySelector('.preview-paper a'));
    const input = d.querySelector('.composer-form [name=files]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new w.File(['pixel'], 'picture.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(() => d.querySelector('.preview-image img'));
    assert.equal(d.querySelector('.preview-image img').getAttribute('src'), 'blob:local-draft');
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(() => revoked.length === 1);
    assert.deepEqual(revoked, ['blob:local-draft']);
    assert.equal(requests.includes('class_upload'), false);
    assert.equal(requests.includes('class_post'), false);
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
