/** Real HTTP/SSE + API + isolated PGlite. Only Realtime delivery is a local event bus. */
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { notificationsFixture, id } from '../tests/notifications-fixture.js';
import { createHandler } from '../api/tipy.js';
import { createNotificationEvents } from '../api/notification-events.js';
import { createStars } from '../server/modules/stars.js';
import { ApiError } from '../server/errors.js';
const f = await notificationsFixture(),
  bus = new EventEmitter(),
  calls = [];
await f.db.exec(readFileSync('db/star_deductions.sql', 'utf8'));
await f.db.exec(readFileSync('db/class_week_stars.sql', 'utf8'));
let subscriptions = 0,
  maxSubscriptions = 0;
const backend = {
  ...f.assessments,
  ...f.notifications,
  ...createStars({ rpc: f.rpc }),
  session: async (access) => {
    if (!access || !/^[0-9a-f-]{36}$/.test(access))
      throw new ApiError(401, 'Bạn đăng nhập trước nhé.');
    const p = await f.q('select * from profiles where user_id=$1', [access]);
    if (!p?.is_active) throw new ApiError(401, 'Bạn đăng nhập trước nhé.');
    return { profile: p, access };
  },
  auth: async (action, input) => {
    const p = await f.q('select * from profiles where username=$1', [input.username]);
    if (!p || input.password !== '1')
      throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
    return {
      profile: p,
      session: { access_token: p.user_id, refresh_token: 'fixture', expires_in: 3600 },
    };
  },
  logout: async () => {},
  games: async () =>
    (await f.db.query('select game_id,game_name,game_code,config from games where is_active')).rows,
  classes: async (profile) =>
    (
      await f.db.query(
        'select c.* from classes c join class_members m using(class_id) where m.user_id=$1 and m.is_active and c.archived_at is null',
        [profile.user_id],
      )
    ).rows,
  avatar: async () => ({ animal: 'icon_01' }),
  start: async () => ({ play_id: id(999) }),
  progress: async () => ({ saved: true }),
  watchNotifications(profile, changed, status) {
    subscriptions++;
    maxSubscriptions = Math.max(maxSubscriptions, subscriptions);
    bus.on(profile.user_id, changed);
    queueMicrotask(() => status('SUBSCRIBED'));
    return async () => {
      subscriptions--;
      bus.off(profile.user_id, changed);
    };
  },
};
const dist = resolve('dist'),
  contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
  };
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`,
  env = {
    APP_ORIGIN: base,
    NODE_ENV: 'development',
    SUPABASE_URL: 'fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture',
    TIPY_AUTH_SECRET: 'x'.repeat(40),
  };
const handler = createHandler({ env, makeBackend: () => backend }),
  stream = createNotificationEvents({ env, makeBackend: () => backend });
server.on('request', async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (url.pathname.startsWith('/api/')) {
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (json) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(json));
      };
      req.query = Object.fromEntries(url.searchParams);
      if (req.method === 'POST') {
        let text = '';
        for await (const chunk of req) text += chunk;
        req.body = JSON.parse(text);
      }
      calls.push({
        action:
          url.pathname === '/api/notification-events'
            ? 'stream'
            : req.body?.action || req.query.action || 'bootstrap',
        user: req.headers.cookie,
        write: req.method === 'POST',
      });
      await (url.pathname === '/api/notification-events' ? stream : handler)(req, res);
      return;
    }
    let file = resolve(dist, '.' + decodeURIComponent(url.pathname));
    if (file !== dist && !file.startsWith(dist + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(file) || url.pathname === '/' || url.pathname === '/admin')
      file = resolve(dist, 'index.html');
    res.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/notifications', { recursive: true });
const results = [],
  notify = (n = 1) => bus.emit(id(n));
try {
  for (const width of [320, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    await context.addCookies([{ name: 'tipy_access', value: id(1), url: base }]);
    await context.addInitScript(() => {
      window.__speech = [];
      window.addEventListener('tipy-companion-speech', (e) => {
        if (e.detail.startsWith('notification_')) window.__speech.push(e.detail);
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const list = () => f.notifications.notifications(f.person(1));
    const presented = (await list()).items
      .filter((n) => !n.presented_at)
      .map((n) => n.notification_id);
    if (presented.length)
      await f.notifications.notificationsPresent(f.person(1), { ids: presented, speak: false });
    await page.goto(base);
    const bell = () => page.getByRole('button', { name: /^Thông báo/ });
    await bell().waitFor();
    await page.locator('.tipy-companion').waitFor();
    await page.waitForTimeout(400);
    const idleStart = calls.length;
    await page.waitForTimeout(3000);
    assert.equal(calls.length, idleStart, 'idle has no HTTP requests');
    const emptyStart = calls.length;
    await bell().click();
    const dialog = page.getByRole('dialog');
    if ((await list()).total === 0)
      await dialog.getByText('Em chưa có thông báo mới.', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(calls.length, emptyStart, 'cached open/close has no request');
    const schedule = {
      mode: 'scheduled',
      opensAt: new Date(Date.now() + 86400000).toISOString(),
      closesAt: new Date(Date.now() + 172800000).toISOString(),
    };
    const exam = 80 + [320, 768, 1440].indexOf(width);
    await f.publish(exam, { classIds: [id(50)], userIds: [] }, schedule);
    await f.gift(id(1000 + width), 5);
    await f.gift(id(1000 + width), 5);
    const eventStart = calls.length;
    notify();
    notify();
    notify();
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Thầy Hùng tặng em 5 sao!/);
    assert.match(await dialog.innerText(), /Mở lúc/);
    const panel = await dialog.boundingBox();
    assert.ok(
      panel.x >= 0 &&
        panel.y >= 0 &&
        panel.x + panel.width <= width + 1 &&
        panel.y + panel.height <= 1001,
    );
    const closeBox = await dialog.getByRole('button', { name: 'Đóng', exact: true }).boundingBox();
    assert.ok(closeBox.width >= 48 && closeBox.height >= 48);
    await page.screenshot({ path: `test-results/notifications/panel-${width}.png` });
    assert.equal(calls.length, eventStart, 'SSE snapshot adds no HTTP requests');
    const fresh = (await list()).items.filter((n) => !n.presented_at);
    assert.equal(fresh.length, 2);
    const beforeAck = calls.filter((c) => c.action === 'notifications_present').length;
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.waitForFunction(() => window.__speech.length === 1);
    assert.equal(calls.filter((c) => c.action === 'notifications_present').length, beforeAck + 1);
    assert.equal((await list()).unread, 0);
    assert.equal(await page.evaluate(() => window.__speech[0]), 'notification_batch');
    await page.screenshot({ path: `test-results/notifications/home-${width}.png` });
    await page.reload();
    await bell().waitFor();
    await page.waitForTimeout(400);
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    const historyStart = calls.length;
    await bell().click();
    await dialog.getByText(`Bài kiểm tra thử ${exam}`, { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(calls.length, historyStart);
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    await bell().click();
    await dialog.getByRole('button', { name: 'Xem bài', exact: true }).first().click();
    await page.locator('.assessment-summary').waitFor();
    assert.match(await page.locator('.assessment-summary').innerText(), /Chưa đến giờ/);
    assert.match(await page.locator('.assessment-summary').innerText(), /Thầy Hùng/);
    await page.getByRole('button', { name: 'Trang chủ', exact: true }).click();
    await page.waitForTimeout(300);
    // Hide the companion before delivery, then show it again: old history must not speak.
    await page.evaluate(
      (userId) =>
        localStorage.setItem(
          `tipy-companion:${userId}`,
          JSON.stringify({ x: 1, y: 1, visible: false, size: 100 }),
        ),
      id(1),
    );
    await page.reload();
    await bell().waitFor();
    assert.equal(await page.locator('.tipy-companion').count(), 0);
    await f.gift(id(2000 + width), 3);
    notify();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    await page.evaluate(
      (userId) =>
        localStorage.setItem(
          `tipy-companion:${userId}`,
          JSON.stringify({ x: 0, y: 1, visible: true, size: 100 }),
        ),
      id(1),
    );
    await page.reload();
    await page.locator('.tipy-companion').waitFor();
    await page.waitForTimeout(400);
    const box = await bell().boundingBox(),
      buddy = await page.locator('.tipy-companion').boundingBox();
    assert.ok(
      !(
        box.x < buddy.x + buddy.width &&
        box.x + box.width > buddy.x &&
        box.y < buddy.y + buddy.height &&
        box.y + box.height > buddy.y
      ),
    );
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    // A real engine is active, but fixture start/checkpoint handlers never touch hosted data.
    await page.goto(base + '/#typing/setup');
    await page.reload();
    await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
    await page.locator('.arena').waitFor();
    await page.waitForTimeout(3500);
    await f.gift(id(3000 + width), 2);
    notify();
    await page.getByRole('button', { name: 'Thông báo, 1 chưa xem', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    await page.getByRole('button', { name: 'Trang chủ', exact: true }).click();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__speech.length === 1);
    // Two loaded tabs both see the same event; the database grants one speech claim.
    const second = await context.newPage();
    await second.goto(base);
    await second.getByRole('button', { name: /^Thông báo/ }).waitFor();
    await f.gift(id(4000 + width), 1);
    notify();
    await page.waitForTimeout(400);
    await second.getByRole('dialog').waitFor();
    await second.keyboard.press('Escape');
    await second.waitForFunction(() => window.__speech.length === 1);
    await page.reload();
    await bell().waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__speech.length), 0);
    const spoken = await f.q(
      'select count(*)::int n from student_notifications where user_id=$1 and source_key=$2 and spoken_at is not null',
      [id(1), id(4000 + width)],
    );
    assert.equal(spoken.n, 1);
    await page.getByRole('button', { name: /^Tài khoản/ }).click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await bell().waitFor({ state: 'hidden' });
    await second.getByRole('button', { name: /^Thông báo/ }).waitFor({ state: 'hidden' });
    for (let wait = 0; wait < 30 && subscriptions; wait++) await page.waitForTimeout(100);
    assert.equal(subscriptions, 0);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const account = page.getByRole('dialog');
    await account.getByLabel('Tên đăng nhập', { exact: true }).fill('fixture2');
    await account.getByLabel('Mật khẩu', { exact: true }).fill('1');
    await account.getByRole('button', { name: 'Vào chơi nào', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('.header-account-group')?.textContent.includes('Học sinh thử 2'),
    );
    await second.waitForFunction(() =>
      document.querySelector('.header-account-group')?.textContent.includes('Học sinh thử 2'),
    );
    await page.waitForTimeout(400);
    assert.equal(await page.getByText('Thầy Hùng tặng em 5 sao!', { exact: true }).count(), 0);
    assert.equal(await second.getByText('Thầy Hùng tặng em 5 sao!', { exact: true }).count(), 0);
    assert.equal(
      bus.listenerCount(id(1)),
      0,
      'switching accounts closes the old account channel in both tabs',
    );
    await second.close();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      idle3s: 0,
      cachedOpenClose: 0,
      newNotificationsHttpRequests: 0,
      closeNewBatchWrites: 1,
      duplicateGiftNotifications: 1,
      reloadAndHistorySpeech: 0,
      hiddenSpeech: 0,
      multiTabClaim: 1,
      logoutSubscriptions: 0,
    });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  writeFileSync('test-results/notifications/requests.json', JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await f.db.close();
}
