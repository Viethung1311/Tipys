import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 300; i++) {
    const value = fn();
    if (value) return value;
    await sleep(10);
  }
  throw Error('Timed out waiting for audio UI');
}
test('audio controls persist independently; countdown plays once per beat and opening settings pauses music', async () => {
  const errors = [],
    notes = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy-audio.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const w = dom.window,
    d = w.document;
  let now = 0,
    closed = false;
  class Parameter {
    setValueAtTime(value) {
      this.value = value;
    }
    exponentialRampToValueAtTime() {}
    setTargetAtTime() {}
    cancelScheduledValues() {}
  }
  w.AudioContext = class {
    state = 'running';
    destination = {};
    get currentTime() {
      return now / 1000;
    }
    createGain() {
      return { gain: new Parameter(), connect() {}, disconnect() {} };
    }
    createOscillator() {
      const item = {
        frequency: new Parameter(),
        connect() {},
        disconnect() {},
        start() {
          notes.push(item.frequency.value);
        },
        stop() {},
      };
      return item;
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      closed = true;
      return Promise.resolve();
    }
  };
  w.requestAnimationFrame = (cb) =>
    w.setTimeout(() => {
      now += 50;
      cb(now);
    }, 10);
  w.cancelAnimationFrame = (id) => w.clearTimeout(id);
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url)).find((x) =>
    x.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../dist/assets/' + bundle, import.meta.url), 'utf8'));
  const button = (text) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = async (text) => {
    (await until(() => button(text))).click();
    await sleep(25);
  };
  try {
    await until(() => d.querySelector('.hero'));
    d.querySelector('[aria-label="Cài đặt âm thanh"]').click();
    await until(() => d.querySelector('[role="dialog"]'));
    assert.equal(d.querySelector('[aria-label="Hiệu ứng"]').getAttribute('aria-checked'), 'true');
    assert.equal(d.querySelector('[aria-label="Nhạc nền"]').getAttribute('aria-checked'), 'false');
    assert.equal(d.querySelector('#effects-volume').value, '55');
    assert.equal(d.querySelector('#music-volume').value, '25');
    d.querySelector('[aria-label="Nhạc nền"]').click();
    await sleep(25);
    let saved = JSON.parse(w.localStorage.getItem('tipy-audio'));
    assert.equal(saved.musicEnabled, true);
    assert.equal(saved.effectsEnabled, true);
    await click('Xong rồi');
    await click('Khám phá trò chơi');
    await click('Chơi ngay');
    notes.length = 0;
    await click('Bắt đầu chơi');
    await until(() => d.querySelector('.letter'));
    assert.equal(notes.filter((x) => x === 580).length, 2);
    assert.equal(notes.filter((x) => x === 780).length, 1);
    assert.ok(notes.includes(990));
    await until(() => notes.includes(523.25));
    d.querySelector('[aria-label="Cài đặt âm thanh"]').click();
    await until(() => d.querySelector('.audio-settings'));
    const count = notes.length;
    await sleep(120);
    assert.equal(notes.length, count);
    d.querySelector('[aria-label="Hiệu ứng"]').click();
    await sleep(25);
    saved = JSON.parse(w.localStorage.getItem('tipy-audio'));
    assert.equal(saved.effectsEnabled, false);
    assert.equal(saved.musicEnabled, true);
    await click('Xong rồi');
    await until(() => d.querySelector('[role="dialog"]').textContent.includes('Nghỉ một chút'));
    assert.deepEqual(errors, []);
    assert.equal(closed, false);
  } finally {
    w.close();
  }
});
