import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  CHARACTERS,
  LEGACY_CHARACTERS,
  characterFor,
  normalizeAvatar,
} from '../src/characters/catalog.js';
import { JSDOM } from 'jsdom';

test('36 supplied character PNGs have unique stable IDs; every legacy avatar resolves to a valid image', () => {
  assert.equal(CHARACTERS.length, 36);
  assert.equal(new Set(CHARACTERS.map((c) => c.id)).size, 36);
  for (const c of CHARACTERS) {
    const bytes = readFileSync(new URL('../public' + c.src, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
  }
  for (const [old, id] of Object.entries(LEGACY_CHARACTERS)) assert.equal(characterFor(old).id, id);
  assert.equal(characterFor('unknown').id, 'icon_01');
  assert.deepEqual(normalizeAvatar({ animal: 'cat', color: 'sky', accessory: 'book' }), {
    animal: 'icon_24',
    color: 'sky',
    accessory: 'book',
  });
});

test('avatar migration preserves rows and metadata, is repeatable, validates IDs and keeps RLS', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema public_test;create table public.profiles(user_id uuid primary key); create table public.student_avatars(user_id uuid primary key references profiles,animal text not null default 'rat' constraint student_avatars_animal_check check(animal in ('rat','ox','tiger','cat','dragon','snake','horse','goat','monkey','rooster','dog','pig')),accessory text not null default 'none',color text not null default 'sun');alter table student_avatars enable row level security;`,
    );
    let i = 1;
    for (const old of Object.keys(LEGACY_CHARACTERS)) {
      const id = '00000000-0000-4000-8000-' + String(i++).padStart(12, '0');
      await db.query('insert into profiles values($1)', [id]);
      await db.query("insert into student_avatars values($1,$2,'book','sky')", [id, old]);
    }
    const sql = readFileSync(new URL('../db/character_avatars.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const rows = (await db.query('select * from student_avatars order by user_id')).rows;
    assert.equal(rows.length, 12);
    assert.deepEqual(
      rows.map((r) => r.animal),
      Object.values(LEGACY_CHARACTERS),
    );
    assert.ok(rows.every((r) => r.accessory === 'book' && r.color === 'sky'));
    for (const c of CHARACTERS)
      await db.query('update student_avatars set animal=$1 where user_id=$2', [
        c.id,
        rows[0].user_id,
      ]);
    await assert.rejects(db.exec("update student_avatars set animal='fake'"));
    assert.equal(
      (await db.query("select relrowsecurity from pg_class where oid='student_avatars'::regclass"))
        .rows[0].relrowsecurity,
      true,
    );
  } finally {
    await db.close();
  }
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) {
  for (let i = 0; i < 250; i++) {
    if (check()) return;
    await wait(10);
  }
  throw Error('avatar UI timeout');
}
function mount(state) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://tipy.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window: w } = dom;
  w.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null,
      action = body?.action || new URL(url, 'https://tipy.test').searchParams.get('action');
    state.calls.push(action);
    let data = {};
    if (action === 'bootstrap')
      data = { configured: true, user: state.user, games: [], classes: [] };
    if (action === 'avatar') data = { avatar: state.avatar };
    if (action === 'avatar_save') {
      if (state.delaySave) await state.delaySave;
      if (state.fail)
        return { ok: false, json: async () => ({ error: 'Chưa lưu được. Thử lại nhé.' }) };
      state.avatar = { animal: body.animal, color: body.color, accessory: body.accessory };
      data = { data: state.avatar };
    }
    if (action === 'logout') state.user = null;
    if (action === 'login') state.user = state.profile;
    return { ok: true, json: async () => data };
  };
  const bundle = readdirSync(new URL('../.test-dist/assets/', import.meta.url)).find((n) =>
    n.endsWith('.js'),
  );
  w.eval(readFileSync(new URL('../.test-dist/assets/' + bundle, import.meta.url), 'utf8'));
  return dom;
}

test('guest browses all characters without authenticated reads and must log in before saving', async () => {
  const state = { user: null, calls: [] },
    dom = mount(state),
    d = dom.window.document;
  try {
    await until(() => d.querySelector('.avatar-button'));
    d.querySelector('.avatar-button').click();
    await until(() => d.querySelectorAll('.character-options input').length === 36);
    d.querySelector('input[value="icon_36"]').click();
    d.querySelector('.character-confirm button').click();
    await until(() => d.querySelector('input[name="username"]'));
    assert.ok(!state.calls.includes('avatar_save'));
    assert.ok(!state.calls.includes('avatar'));
  } finally {
    dom.window.close();
  }
});
test('save failure can retry; saved avatar synchronizes header/profile and survives remount/login session', async () => {
  const state = {
    user: {
      user_id: '11111111-1111-4111-8111-111111111111',
      username: 'an',
      full_name: 'Bạn An',
      role: 'student',
    },
    avatar: { animal: 'dog', color: 'sky', accessory: 'book' },
    calls: [],
    fail: true,
  };
  state.profile = state.user;
  let dom = mount(state);
  try {
    let d = dom.window.document;
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_22.png'));
    d.querySelector('.avatar-button').click();
    await until(() => d.querySelectorAll('.character-options input').length === 36);
    d.querySelector('input[value="icon_36"]').click();
    d.querySelector('.character-confirm button').click();
    await until(() => d.querySelector('[role="alert"]'));
    assert.ok(d.querySelector('input[value="icon_36"]').checked);
    assert.ok(d.querySelector('.avatar-button img').src.endsWith('icon_22.png'));
    state.fail = false;
    d.querySelector('.character-confirm button').click();
    await until(() => d.querySelector('.avatar-button img').src.endsWith('icon_36.png'));
    assert.equal(state.avatar.accessory, 'book');
    assert.equal(state.avatar.color, 'sky');
    assert.equal(state.calls.filter((a) => a === 'avatar').length, 1);
    [...d.querySelectorAll('.account-tabs button')]
      .find((b) => b.textContent === 'Tài khoản')
      .click();
    await until(() => d.querySelector('.account-summary img'));
    assert.ok(d.querySelector('.account-summary img').src.endsWith('icon_36.png'));
    dom.window.close();
    dom = mount(state);
    d = dom.window.document;
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_36.png'));
    d.querySelector('.account-button').click();
    await until(() => d.querySelector('.account-summary'));
    [...d.querySelectorAll('button')].find((button) => button.textContent === 'Đăng xuất').click();
    await until(() => d.querySelector('input[name="username"]'));
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_01.png'));
    d.querySelector('input[name="username"]').value = 'an';
    d.querySelector('input[name="password"]').value = '1';
    d.querySelector('.account-form').dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true }),
    );
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_36.png'));
    assert.ok(d.querySelector('.account-summary img').src.endsWith('icon_36.png'));
  } finally {
    dom.window.close();
  }
});

test('a late avatar save cannot replace the guest avatar after logout', async () => {
  let finishSave;
  const state = {
    user: { user_id: '11111111-1111-4111-8111-111111111111', full_name: 'Bạn An', role: 'student' },
    avatar: { animal: 'icon_22', accessory: 'none', color: 'sun' },
    calls: [],
    delaySave: new Promise((resolve) => {
      finishSave = resolve;
    }),
  };
  const dom = mount(state),
    d = dom.window.document;
  try {
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_22.png'));
    d.querySelector('.avatar-button').click();
    await until(() => d.querySelectorAll('.character-options input').length === 36);
    d.querySelector('input[value="icon_36"]').click();
    d.querySelector('.character-confirm button').click();
    await until(() => state.calls.includes('avatar_save'));
    [...d.querySelectorAll('.account-tabs button')]
      .find((b) => b.textContent === 'Tài khoản')
      .click();
    await until(() => d.querySelector('.account-summary'));
    [...d.querySelectorAll('button')].find((b) => b.textContent === 'Đăng xuất').click();
    await until(() => d.querySelector('.avatar-button img')?.src.endsWith('icon_01.png'));
    finishSave();
    await wait(60);
    assert.ok(d.querySelector('.avatar-button img').src.endsWith('icon_01.png'));
  } finally {
    finishSave();
    dom.window.close();
  }
});
