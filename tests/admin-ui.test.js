import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) {
  for (let i = 0; i < 300; i++) {
    const value = check();
    if (value) return value;
    await sleep(10);
  }
  throw Error('Admin UI timeout');
}
test('dedicated admin page shows practice totals and edits difficulty with numeric controls', async () => {
  const errors = [],
    saved = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/admin',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole: console,
  });
  const w = dom.window,
    d = w.document;
  const levels = Object.fromEntries(
    ['easy', 'normal', 'hard'].map((key) => [
      key,
      { fall: 9, minFall: 5, spawn: 2, minSpawn: 1.2, max: 4 },
    ]),
  );
  const game = {
    game_id: 'g',
    game_code: 'falling_letters',
    engine_code: 'falling_letters',
    game_name: 'Chữ rơi',
    is_active: true,
    config: { levels },
  };
  w.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    let value;
    if (body?.action === 'save_game') {
      saved.push(body);
      value = { data: game };
    } else if (url.includes('students'))
      value = {
        students: [
          {
            user_id: 'u',
            full_name: 'Bạn An',
            username: 'an',
            total_active_seconds: 65,
            total_plays: 3,
            is_active: true,
          },
        ],
      };
    else if (url.includes('history')) value = { history: [] };
    else
      value = { configured: true, user: { role: 'admin', full_name: 'Giáo viên' }, games: [game] };
    return { ok: true, json: async () => value };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((x) =>
    x.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  try {
    await until(() => d.body.textContent.includes('Bạn An'));
    assert.ok(d.body.textContent.includes('1 phút 5 giây'));
    button('Tốc độ & độ khó').click();
    await until(() => d.querySelectorAll('.speed-grid input').length === 15);
    assert.equal(d.querySelector('.speed-grid input').type, 'number');
    button('Lưu cấu hình').click();
    await until(() => saved.length === 1);
    assert.equal(saved[0].config.levels.easy.fall, 9);
    assert.equal(saved[0].gameCode, 'falling_letters');
    assert.deepEqual(errors, []);
  } finally {
    w.close();
  }
});
