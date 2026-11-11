import { studentPage } from './student-page-fixture.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGames } from '../server/modules/games.js';
import { createHandler } from '../api/tipy.js';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
const studentId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

test('student history rejects impersonation before queries; admin validates student and scopes snapshots', async () => {
  const calls = [];
  let exists = true;
  const snapshot = {
    play_id: 'p',
    score: 30,
    active_seconds: 5,
    started_at: '2026-11-10T00:00:00Z',
    result: 'quit',
  };
  const db = {
    from(table) {
      calls.push(['table', table]);
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        eq(key, value) {
          calls.push([table, key, value]);
          return q;
        },
        maybeSingle: async () => ({ data: exists ? { user_id: studentId } : null }),
        then(resolve) {
          return Promise.resolve({
            data: [
              {
                user_id: studentId,
                game_id: 'g',
                best_play: snapshot,
                latest_play: snapshot,
                total_active_seconds: 65,
                total_plays: 3,
                profiles: { full_name: 'An' },
                games: { game_name: 'Chữ rơi' },
              },
            ],
          }).then(resolve);
        },
      };
      return q;
    },
  };
  const service = createGames(db),
    student = { user_id: studentId, role: 'student' };
  await assert.rejects(service.history(student, { userId: otherId }), (e) => e.status === 403);
  assert.deepEqual(calls, []);
  await assert.rejects(
    service.history({ role: 'admin' }, { userId: 'invalid' }),
    (e) => e.status === 400,
  );
  assert.deepEqual(calls, []);
  const own = await service.history(student);
  assert.ok(
    calls.some((c) => c[0] === 'player_game_stats' && c[1] === 'user_id' && c[2] === studentId),
  );
  assert.equal(own.length, 1);
  assert.equal(own[0].result_type, 'best_recent');
  assert.equal(own[0].total_active_seconds, 65);
  calls.length = 0;
  await service.history({ role: 'admin' }, { userId: studentId });
  assert.ok(calls.some((c) => c[0] === 'profiles' && c[1] === 'role' && c[2] === 'student'));
  assert.ok(
    calls.some((c) => c[0] === 'player_game_stats' && c[1] === 'user_id' && c[2] === studentId),
  );
  exists = false;
  calls.length = 0;
  await assert.rejects(
    service.history({ role: 'admin' }, { userId: otherId }),
    (e) => e.status === 404,
  );
  assert.equal(
    calls.some((c) => c[1] === 'player_game_stats'),
    false,
  );
});

test('history HTTP action forwards the selected student to the authenticated service', async () => {
  let received;
  const profile = { role: 'admin', user_id: otherId };
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      TIPY_AUTH_SECRET: 'x'.repeat(40),
    },
    makeBackend: () => ({
      session: async () => ({ profile }),
      history: async (user, input) => {
        received = [user, input];
        return [];
      },
    }),
  });
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handler(
    { method: 'GET', headers: {}, query: { action: 'history', userId: studentId } },
    res,
  );
  assert.equal(res.code, 200);
  assert.deepEqual(received, [profile, { userId: studentId }]);
});

test('HTTP student cannot request another account even with a forged admin query parameter', async () => {
  let queries = 0;
  const service = createGames({
    from() {
      queries++;
      throw Error('Must not query');
    },
  });
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      TIPY_AUTH_SECRET: 'x'.repeat(40),
    },
    makeBackend: () => ({
      ...service,
      session: async () => ({ profile: { user_id: studentId, role: 'student' } }),
    }),
  });
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handler(
    { method: 'GET', headers: {}, query: { action: 'history', userId: otherId, role: 'admin' } },
    res,
  );
  assert.equal(res.code, 403);
  assert.equal(queries, 0);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let n = 0; n < 250; n++) {
    if (check()) return;
    await wait(10);
  }
  throw Error('History UI timeout');
}

test('admin chooses students, sees bounded results, retries failures and ignores an older response', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/admin',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document,
    reads = [];
  let fail = true,
    finishFirst;
  const row = (name) => ({
    user_id: studentId,
    game_id: 'g',
    profiles: { full_name: name },
    games: { game_name: 'Chữ rơi' },
    result_type: 'best_recent',
    score: 30,
    active_seconds: 5,
    total_active_seconds: 65,
    started_at: '2026-11-10T00:00:00Z',
    result: 'quit',
  });
  w.fetch = async (url) => {
    const params = new URL(url, 'https://tipy.test').searchParams,
      action = params.get('action');
    let data = {};
    if (action === 'bootstrap')
      data = {
        configured: true,
        user: { role: 'admin', user_id: 'admin' },
        games: [],
        classes: [],
      };
    if (action === 'students' || action === 'students_page')
      data = {
        students: [studentId, otherId].map((id, index) => ({
          user_id: id,
          full_name: index ? 'Bình' : 'An',
          username: index ? 'binh' : 'an',
          total_active_seconds: 65,
          total_plays: 3,
          is_active: true,
        })),
      };
    if (action === 'students_page') data = studentPage(data.students);
    if (action === 'history') {
      const id = params.get('userId');
      reads.push(id);
      if (fail) return { ok: false, json: async () => ({ error: 'Chưa tải được kết quả.' }) };
      if (id === studentId)
        return new Promise((resolve) => {
          finishFirst = () => resolve({ ok: true, json: async () => ({ history: [row('An')] }) });
        });
      data = {
        history: [
          row('Bình'),
          {
            ...row('Bình'),
            game_id: 'quest',
            games: { game_code: 'keyboard_quest', game_name: 'Bé chinh phục bàn phím' },
            score: 95,
          },
        ],
      };
    }
    return { ok: true, json: async () => data };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  try {
    await until(() => button('Lịch sử chơi'));
    button('Lịch sử chơi').click();
    await until(() => d.querySelector('.history-filters select'));
    assert.equal(reads.length, 0);
    const select = d.querySelector('.history-filters select');
    select.value = studentId;
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(() => d.querySelector('.student-history [role=alert]'));
    fail = false;
    button('Thử lại').click();
    await until(() => finishFirst);
    select.value = otherId;
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(() => d.querySelector('.student-history tbody')?.textContent.includes('Bình'));
    finishFirst();
    await wait(30);
    assert.equal(d.querySelector('.student-history tbody').textContent.includes('An'), false);
    assert.equal(d.querySelectorAll('.student-history tbody tr').length, 2);
    const gameFilter = d.querySelectorAll('.history-filters select')[1];
    gameFilter.value = 'quest';
    gameFilter.dispatchEvent(new w.Event('change', { bubbles: true }));
    await until(() => d.querySelectorAll('.student-history tbody tr').length === 1);
    assert.match(d.querySelector('.student-history tbody').textContent, /95%/);
    assert.match(d.querySelector('.student-history').textContent, /cao nhất và gần nhất/);
    assert.match(d.querySelector('.history-summary').textContent, /1 phút 5 giây/);
    assert.deepEqual(reads, [studentId, studentId, otherId]);
  } finally {
    finishFirst?.();
    w.close();
  }
});
