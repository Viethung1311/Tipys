import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGames } from '../server/modules/games.js';
import { defaultGuardSettings } from '../src/features/keyboard-guard/settings.js';
const out = 'test-results/guard-release';
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4208';
let row = {
  game_id: '33333333-3333-4333-8333-333333333333',
  game_code: 'keyboard_guard',
  engine_code: 'keyboard_guard',
  game_name: 'Vệ binh bàn phím',
  description: 'Gõ từ để bảo vệ tàu qua ba đợt tăng tốc.',
  is_active: true,
  config: defaultGuardSettings(),
};
const other = [
  {
    game_id: 'fall',
    game_code: 'falling_letters',
    engine_code: 'falling_letters',
    game_name: 'Chữ rơi',
    is_active: true,
    config: {},
  },
  {
    game_id: 'quest',
    game_code: 'keyboard_quest',
    engine_code: 'keyboard_quest',
    game_name: 'Bé chinh phục bàn phím',
    is_active: true,
    config: {},
  },
];
const db = {
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      upsert(values) {
        row = { ...row, ...structuredClone(values) };
        return this;
      },
      single: async () => ({ data: structuredClone(row) }),
    };
  },
};
const service = createGames(db),
  browser = await chromium.launch({ channel: 'chrome', headless: true }),
  report = [];
async function open(role, width = 1440, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } }),
    page = await context.newPage(),
    calls = [],
    errors = [],
    missing = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/guard-art/') && r.status() !== 200) missing.push(r.url());
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      action =
        req.method() === 'POST'
          ? req.postDataJSON()?.action
          : new URL(req.url()).searchParams.get('action');
    calls.push({ method: req.method(), action });
    const user = role
      ? { role, user_id: `${role}-test`, full_name: 'Tài khoản thử', is_active: true }
      : null;
    try {
      let value = {};
      if (action === 'bootstrap')
        value = {
          configured: true,
          user,
          games: [...other, structuredClone(row)],
          classes: [],
          notifications: null,
        };
      else if (action === 'guard_config') value = await service.guardConfig();
      else if (action === 'save_game')
        value = { data: await service.saveGame(user, req.postDataJSON()) };
      else if (action === 'avatar') value = { avatar: null };
      else if (action === 'stars' || action === 'points') value = { stars: 0, points: 0 };
      else if (action === 'quest_progress') value = { progress: [] };
      else if (action === 'students_page')
        value = {
          students: [],
          summary: { students: 0, seconds: 0, plays: 0 },
          pagination: { page: 1, total: 0, totalPages: 1 },
        };
      await route.fulfill({ status: 200, json: value });
    } catch (error) {
      await route.fulfill({ status: error.status || 500, json: { error: error.message } });
    }
  });
  return { context, page, calls, errors, missing };
}
try {
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [844, 390],
  ]) {
    const { context, page, calls, errors, missing } = await open('student', width, height);
    await page.goto(`${base}/#typing`);
    const cards = page.locator('.game-card');
    await cards.nth(2).waitFor();
    assert.deepEqual(await cards.locator('h3').allTextContents(), [
      'Chữ rơi',
      'Bé chinh phục bàn phím',
      'Vệ binh bàn phím',
    ]);
    await page.locator('.guard-card-ship').evaluate(async (img) => {
      await img.decode();
    });
    const art = await page.locator('.guard-card-art').boundingBox();
    assert.ok(art.width > 0 && art.height > 0);
    assert.equal(await cards.nth(2).locator('svg image').count(), 1);
    await cards.nth(2).scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        !document.querySelector('.guard-card').parentElement.classList.contains('reveal-pending'),
    );
    await page.screenshot({ path: `${out}/library-${width}.png` });
    await cards.nth(2).getByRole('button', { name: 'Chơi ngay', exact: true }).click();
    await page.getByRole('heading', { name: 'Vệ binh bàn phím', exact: true }).waitFor();
    assert.ok(page.url().endsWith('#typing/guard'));
    await page.reload();
    await page.getByRole('button', { name: 'Chơi', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.guard-intro .tipy-button').disabled);
    const before = calls.length;
    await page.getByRole('button', { name: 'Chơi', exact: true }).dblclick();
    await page.locator('.guard-battle').waitFor();
    assert.equal(calls.slice(before).filter((c) => c.action === 'guard_config').length, 1);
    assert.equal(await page.getByRole('button', { name: 'Cài đặt', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.getByRole('button', { name: 'Rời lượt chơi', exact: true }).click();
    await cards.nth(2).waitFor();
    await cards.nth(0).getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.getByRole('heading', { name: /Chọn thử thách của bạn/ }).waitFor();
    assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    report.push({
      width,
      height,
      thirdCard: true,
      directReload: true,
      doubleStartReads: 1,
      studentSettings: false,
      oldGame: true,
      writes: 0,
    });
    await context.close();
  }
  const first = await open('admin');
  const { page, calls } = first;
  await page.goto(`${base}/#typing/guard`);
  await page.waitForFunction(
    () =>
      document.querySelector('.guard-intro .tipy-button') &&
      !document.querySelector('.guard-intro .tipy-button').disabled,
  );
  await page.getByRole('button', { name: 'Chơi', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  const form = page.locator('.guard-settings');
  await form.getByLabel('Màn cấu hình').selectOption('2');
  await form.getByLabel('Đợt cấu hình').selectOption('1');
  await form.getByLabel('Hệ số tốc độ đợt', { exact: true }).fill('1.5');
  let start = calls.length;
  await form.getByRole('button', { name: 'Lưu', exact: true }).dblclick();
  await form
    .getByText('Đã lưu cấu hình dùng chung. Áp dụng từ lượt chơi mới trên mọi thiết bị.', {
      exact: true,
    })
    .waitFor();
  assert.equal(calls.slice(start).filter((c) => c.action === 'save_game').length, 1);
  assert.equal(row.config.stages[2].waves[1].speed, 150);
  await form.getByLabel('Tổng thiên thạch trong đợt', { exact: true }).fill('0');
  start = calls.length;
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  assert.equal(calls.length, start);
  await page.screenshot({ path: `${out}/admin-settings.png` });
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByText('Đã phá 0/15', { exact: true }).waitFor();
  const second = await open('admin', 390, 844);
  await second.page.goto(`${base}/#typing/guard`);
  await second.page.waitForFunction(
    () =>
      document.querySelector('.guard-intro .tipy-button') &&
      !document.querySelector('.guard-intro .tipy-button').disabled,
  );
  await second.page.getByRole('button', { name: 'Chơi', exact: true }).click();
  await second.page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await second.page.getByLabel('Màn cấu hình').selectOption('2');
  await second.page.getByLabel('Đợt cấu hình').selectOption('1');
  assert.equal(
    await second.page.getByLabel('Hệ số tốc độ đợt', { exact: true }).inputValue(),
    '1.5',
  );
  assert.deepEqual(first.errors, []);
  assert.deepEqual(second.errors, []);
  report.push({
    adminSharedAcrossDevices: true,
    saveWrites: 1,
    invalidWrites: 0,
    activeSnapshot: true,
  });
  await first.context.close();
  await second.context.close();
  writeFileSync(`${out}/checks.json`, JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
