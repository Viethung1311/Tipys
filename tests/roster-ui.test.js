import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 350; i++) {
    if (fn()) return;
    await sleep(10);
  }
  throw Error('Roster UI timeout');
}
const classA = { class_id: 'a', name: 'STEM A', archived_at: null },
  classB = { class_id: 'b', name: 'STEM A', archived_at: null };
function setup({ fail = false } = {}) {
  const errors = [],
    requests = [],
    writes = [];
  let complete;
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/admin',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window,
    d = w.document;
  const students = [
    {
      user_id: 'an',
      username: 'an',
      full_name: 'Bạn An',
      is_active: true,
      total_active_seconds: 0,
      total_plays: 0,
      class_members: [classA, classB].map((c) => ({
        class_id: c.class_id,
        is_active: true,
        classes: c,
      })),
    },
    {
      user_id: 'binh',
      username: 'binh',
      full_name: 'Bạn Bình',
      is_active: true,
      total_active_seconds: 0,
      total_plays: 0,
      class_members: [],
    },
    {
      user_id: 'chi',
      username: 'chi',
      full_name: 'Bạn Chi',
      is_active: true,
      total_active_seconds: 0,
      total_plays: 0,
      class_members: [],
    },
    {
      user_id: 'locked',
      username: 'locked',
      full_name: 'Tài khoản khóa',
      is_active: false,
      total_active_seconds: 0,
      total_plays: 0,
      class_members: [],
    },
  ];
  w.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null,
      action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    requests.push(action);
    if (action === 'class_members') {
      writes.push(body);
      return new Promise((resolve) => {
        complete = () =>
          resolve({
            ok: !fail,
            json: async () =>
              fail
                ? { error: 'Mạng lỗi thử lại' }
                : { data: { classId: body.classId, userIds: body.userIds, active: body.active } },
          });
      });
    }
    const data = {
      bootstrap: { configured: true, user: { role: 'admin', full_name: 'Giáo viên' }, games: [] },
      students: { students },
      history: { history: [] },
      classes: { classes: [classA, classB] },
      class_roster: { userIds: ['an'] },
    };
    return { ok: true, json: async () => data[action] };
  };
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (name) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  const select = async () => {
    await until(() => button('Lớp học'));
    button('Lớp học').click();
    await until(() => d.querySelector('.admin-classes select option[value=a]'));
    const dropdown = d.querySelector('.admin-classes select');
    dropdown.value = 'a';
    dropdown.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(
      () =>
        d.querySelector('.roster-editor input[aria-label="Chọn Bạn Bình (binh)"]') &&
        !d.querySelector('.roster-editor input[aria-label="Chọn Bạn Bình (binh)"]').disabled,
    );
  };
  return { w, d, requests, writes, errors, button, select, finish: () => complete() };
}
test('bulk selection sends one request, preserves table, patches parent and supports remove one without reload', async () => {
  const s = setup();
  try {
    await s.select();
    const { d, button, writes } = s;
    const check = (name) => d.querySelector(`input[aria-label="Chọn ${name}"]`).click();
    check('Bạn An (an)');
    check('Bạn Bình (binh)');
    check('Bạn Chi (chi)');
    await until(() => button('Thêm vào lớp (2)'));
    const before = s.requests.length;
    button('Thêm vào lớp (2)').click();
    button('Thêm vào lớp (2)').click();
    await until(() => writes.length === 1);
    assert.deepEqual(writes[0].userIds, ['binh', 'chi']);
    assert.ok(d.querySelector('.roster-editor table'));
    assert.equal(d.querySelector('input[aria-label="Chọn Bạn Bình (binh)"]').checked, true);
    s.finish();
    await until(() => d.body.textContent.includes('Đã thêm 2 học sinh'));
    assert.equal(s.requests.length, before + 1);
    assert.equal(d.querySelector('input[aria-label="Chọn Bạn An (an)"]').checked, true);
    assert.equal(d.querySelector('input[aria-label="Chọn Bạn Bình (binh)"]').checked, false);
    button('Bỏ khỏi lớp (1)').click();
    await until(() => writes.length === 2);
    assert.equal(writes[1].active, false);
    assert.deepEqual(writes[1].userIds, ['an']);
    s.finish();
    await until(() => d.body.textContent.includes('Đã bỏ 1 học sinh'));
    assert.equal(s.requests.length, before + 2);
    button('Học sinh & thời gian').click();
    await until(() => d.querySelector('table tbody'));
    const row = [...d.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Bạn An'));
    assert.equal(row.cells[2].textContent, 'STEM A');
    assert.deepEqual(s.errors, []);
  } finally {
    s.w.close();
  }
});
test('filtered select-all selects only visible rows and failure keeps selection for retry', async () => {
  const s = setup({ fail: true });
  try {
    await s.select();
    const { d, w, button } = s;
    assert.equal(
      d.querySelector('input[aria-label="Chọn Tài khoản khóa (locked)"]').disabled,
      true,
    );
    const search = d.querySelector('input[type=search]');
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    setter.call(search, 'Bình');
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await until(() => d.querySelectorAll('.roster-editor tbody tr').length === 1);
    d.querySelector('input[aria-label="Chọn tất cả học sinh đang hiển thị"]').click();
    await until(() => button('Thêm vào lớp (1)') && !button('Thêm vào lớp (1)').disabled);
    button('Thêm vào lớp (1)').click();
    await until(() => s.writes.length === 1);
    assert.deepEqual(s.writes[0].userIds, ['binh']);
    s.finish();
    await until(() => d.querySelector('[role=alert]'));
    assert.equal(d.querySelector('input[aria-label="Chọn Bạn Bình (binh)"]').checked, true);
    assert.equal(search.value, 'Bình');
    assert.equal(button('Thêm vào lớp (1)').disabled, false);
    assert.deepEqual(s.errors, []);
  } finally {
    s.w.close();
  }
});
