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
  throw Error('Quest UI timed out');
}
async function setup(user = null, progress = []) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test/#typing/quest',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    calls = [];
  w.localStorage.setItem('tipy-quest-guest-v1', JSON.stringify(progress));
  w.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null,
      action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    calls.push({ action, body });
    let data = {};
    if (action === 'bootstrap')
      data = {
        configured: true,
        user,
        games: [
          {
            game_code: 'keyboard_quest',
            engine_code: 'keyboard_quest',
            game_name: 'Bé chinh phục bàn phím',
            is_active: true,
          },
        ],
        classes: [],
      };
    if (action === 'quest_progress') data = { progress: [] };
    if (action === 'start') data = { data: { play_id: '11111111-1111-4111-8111-111111111111' } };
    if (action === 'quest_finish')
      data = { data: { progress: { lesson_id: 'keys-as', completed: true, best_stars: 3 } } };
    return { ok: true, json: async () => data };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((file) =>
    file.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  await until(() => w.document.querySelector('.quest-lessons'));
  const click = async (text) => {
    const button = await until(() =>
      [...w.document.querySelectorAll('button')].find((el) => el.textContent.trim() === text),
    );
    button.click();
    await sleep(25);
  };
  return { dom, w, d: w.document, calls, click };
}
test('guest quest completes with physical/touch keys, pauses, unlocks next lesson and keeps one local summary', async () => {
  const { dom, w, d, calls, click } = await setup();
  try {
    assert.equal(d.querySelectorAll('.quest-lesson').length, 30);
    assert.equal(
      [...d.querySelectorAll('.quest-lesson button')].filter((el) => el.disabled).length,
      26,
    );
    await click('Vào học');
    await until(() => d.querySelector('.quest-target'));
    w.dispatchEvent(new w.Event('blur'));
    await until(() => d.querySelector('[role="dialog"]'));
    await click('Tiếp tục');
    for (let i = 0; i < LESSONS[0].items.length; i++) {
      const key = LESSONS[0].items[i].target;
      if (i % 2) d.querySelector(`[aria-label="Gõ ${key}"]`).click();
      else w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Key' + key }));
      await sleep(12);
    }
    await until(() => d.body.textContent.includes('Đã lưu bản chơi thử'));
    assert.doesNotMatch(d.body.textContent, /Lần trước:/);
    assert.equal(JSON.parse(w.localStorage.getItem('tipy-quest-guest-v1')).length, 1);
    assert.ok(!calls.some((row) => ['start', 'quest_finish'].includes(row.action)));
    await click('Bài tiếp');
    await until(() => d.querySelector('.quest-player-top')?.textContent.includes('Bốn người bạn'));
  } finally {
    dom.window.close();
  }
});
test('signed-in quest reads own progress and saves through existing authenticated API once', async () => {
  const { dom, w, d, calls, click } = await setup({
    user_id: 'test-user',
    role: 'student',
    full_name: 'Test',
  });
  try {
    await click('Vào học');
    await until(() => d.querySelector('.quest-target'));
    for (const item of LESSONS[0].items) {
      d.querySelector(`[aria-label="Gõ ${item.target}"]`).click();
      await sleep(12);
    }
    await until(() => d.body.textContent.includes('Đã lưu vào tài khoản TIPY'));
    assert.equal(calls.filter((row) => row.action === 'quest_finish').length, 1);
    assert.equal(calls.find((row) => row.action === 'start').body.lessonId, 'keys-as');
    assert.equal(w.localStorage.getItem('tipy-quest-guest-v1'), '[]');
    assert.equal(calls.find((row) => row.action === 'quest_finish').body.answers.length, 10);
  } finally {
    dom.window.close();
  }
});
test('text exercises wait for composition and accept normalized Vietnamese without global key interception', async () => {
  const { dom, w, d } = await setup();
  try {
    const card = [...d.querySelectorAll('.quest-lesson')].find((el) =>
      el.textContent.includes('Phép thuật Telex'),
    );
    card.querySelector('button').click();
    const input = await until(() => d.querySelector('textarea'));
    input.dispatchEvent(new w.CompositionEvent('compositionstart', { bubbles: true }));
    const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, 'a\u0301');
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    input.dispatchEvent(
      new w.KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        isComposing: true,
        bubbles: true,
      }),
    );
    await sleep(25);
    assert.equal(d.querySelector('.quest-target').textContent, 'á');
    input.dispatchEvent(new w.CompositionEvent('compositionend', { bubbles: true }));
    input.dispatchEvent(
      new w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
    await until(() => d.querySelector('.quest-target').textContent === 'à');
  } finally {
    dom.window.close();
  }
});

const seedLesson = (lesson) => ({
  lesson_id: lesson.id,
  completed: true,
  best_stars: 3,
  best_accuracy: 100,
  last_accuracy: 100,
});
test('mixed lessons switch from physical keys to editable text and race mode follows progress', async () => {
  const { dom, w, d } = await setup(null, LESSONS.slice(0, 5).map(seedLesson));
  try {
    const select = d.querySelector('.quest-recommend select');
    select.value = 'race';
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(20);
    const lesson = LESSONS.find((item) => item.stage === 6);
    [...d.querySelectorAll('.quest-lesson')]
      .find((el) => el.textContent.includes(lesson.title))
      .querySelector('button')
      .click();
    await until(() => d.querySelector('.quest-race'));
    for (const item of lesson.items) {
      if (item.kind === 'key') d.querySelector('[aria-label="Gõ ' + item.target + '"]').click();
      else {
        const input = d.querySelector('textarea');
        assert.ok(input);
        Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set.call(
          input,
          item.target,
        );
        input.dispatchEvent(new w.Event('input', { bubbles: true }));
        input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
      await sleep(15);
    }
    await until(() => d.body.textContent.includes('Đã lưu bản chơi thử'));
    assert.equal(
      JSON.parse(w.localStorage.getItem('tipy-quest-guest-v1')).find(
        (row) => row.lesson_id === lesson.id,
      ).completed,
      true,
    );
  } finally {
    dom.window.close();
  }
});
test('missing-letter lesson accepts corrections without replacing the prompt by its answer', async () => {
  const lesson = LESSONS.find((item) => item.stage === 13);
  const { dom, w, d } = await setup(null, [
    seedLesson(LESSONS.find((item) => item.id === 'picture-words')),
  ]);
  try {
    [...d.querySelectorAll('.quest-lesson')]
      .find((el) => el.textContent.includes(lesson.title))
      .querySelector('button')
      .click();
    const input = await until(() => d.querySelector('textarea'));
    assert.equal(d.querySelector('.quest-target').textContent, 'b_n');
    const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set;
    for (const value of ['z', '', 'a']) {
      setter.call(input, value);
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      await sleep(10);
    }
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await until(() => d.querySelector('.quest-target').textContent === 'c_c');
  } finally {
    dom.window.close();
  }
});
test('vocabulary opens after all 30 lessons without treasure, store or reset controls', async () => {
  const { dom, w, d, click, calls } = await setup(null, LESSONS.map(seedLesson));
  try {
    await click('Từ vựng');
    assert.equal(d.querySelectorAll('.quest-lesson').length, 9);
    assert.ok([...d.querySelectorAll('.quest-lesson button')].every((button) => !button.disabled));
    await click('Tiến bộ');
    assert.match(d.body.textContent, /Chứng nhận chinh phục bàn phím/);
    assert.doesNotMatch(d.body.textContent, /xu đã kiếm|Kho báu|Đặt lại|Bộ sưu tập sticker/);

    assert.ok(!calls.some((call) => call.action === 'avatar_save'));
  } finally {
    dom.window.close();
  }
});
