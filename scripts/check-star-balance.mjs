/** Isolated real SQL + API handler behind browser Network interception; no hosted writes. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { starFixture, id } from '../tests/star-balance-fixture.js';
import { createStars } from '../server/modules/stars.js';
import { createStudents } from '../server/modules/students.js';
import { createHandler } from '../api/tipy.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4207'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/star-balance', { recursive: true });
const measurements = [];
try {
  await new Promise((r) => setTimeout(r, 1200));
  for (const width of [320, 768, 1440]) {
    const f = await starFixture();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const reads = [],
      writes = [],
      errors = [];
    let failGiftAfterCommit = false,
      failResetAfterCommit = false;
    const db = {
      rpc: async (name, args) => {
        const entries = Object.entries(args);
        try {
          return {
            data: (
              await f.q(
                `select public.${name}(${entries.map(([k], i) => `${k} => $${i + 1}`).join(',')}) result`,
                entries.map(([, v]) => v),
              )
            ).result,
          };
        } catch (e) {
          return { error: { message: e.message } };
        }
      },
    };
    let user = { user_id: id(99), role: 'admin', full_name: 'Giáo viên thử' };
    const classroom = { class_id: id(50), name: 'Lớp thử', archived_at: null };
    const backend = {
      ...createStars(db),
      ...createStudents(db),
      session: async () => ({ profile: user }),
    };
    const handler = createHandler({ makeBackend: () => backend });
    await context.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        query = Object.fromEntries(new URL(req.url()).searchParams),
        action = body?.action || query.action;
      (body ? writes : reads).push({ action, body });
      let json;
      if (action === 'bootstrap')
        json = { configured: true, user, classes: [classroom], games: [] };
      if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
      if (action === 'classroom') json = { classroom, members: [], posts: [] };
      if (action === 'classes') json = { classes: [classroom] };
      if (action === 'history') json = { history: [] };
      if (json) return route.fulfill({ json });
      let status = 200,
        response;
      await handler(
        {
          method: body ? 'POST' : 'GET',
          headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
          body,
          query,
        },
        {
          setHeader() {},
          status(code) {
            status = code;
            return this;
          },
          json(value) {
            response = value;
          },
        },
      );
      if (body) await new Promise((r) => setTimeout(r, 100));
      if (action === 'star_gift' && failGiftAfterCommit) {
        failGiftAfterCommit = false;
        return route.fulfill({
          status: 503,
          json: { error: 'Mất phản hồi sau khi đã lưu. Thử lại cùng yêu cầu.' },
        });
      }
      if (action === 'star_reset' && failResetAfterCommit) {
        failResetAfterCommit = false;
        return route.fulfill({
          status: 503,
          json: { error: 'Mất phản hồi sau khi đã lưu. Thử lại cùng yêu cầu.' },
        });
      }
      return route.fulfill({ status, json: response });
    });
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto('http://127.0.0.1:4207/admin');
      const options = page.getByRole('button', {
        name: 'Tùy chọn: Học sinh thử 1 · fixture1',
        exact: true,
      });
      await options.waitFor();
      const initial = reads.length + writes.length;
      await options.click();
      await page.getByRole('menu').waitFor();
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Xóa tài khoản');
      await page.keyboard.press('Escape');
      await page.getByRole('menu').waitFor({ state: 'hidden' });
      assert.ok(await options.evaluate((n) => n === document.activeElement));
      await options.click();
      await page.locator('h2').first().click();
      await page.getByRole('menu').waitFor({ state: 'hidden' });
      assert.equal(reads.length + writes.length, initial, 'menu open/close sends zero requests');
      await options.press('Enter');
      await page.getByRole('menu').waitFor();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
      await options.press('Space');
      await page.keyboard.press('Tab');
      await page.getByRole('menu').waitFor({ state: 'hidden' });
      assert.equal(reads.length + writes.length, initial);
      const last = page.getByRole('button', { name: /Tùy chọn:/ }).last();
      await last.click();
      const box = await page.getByRole('menu').boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901,
      );
      await page.screenshot({ path: `test-results/star-balance/menu-${width}.png` });
      await page.keyboard.press('Escape');
      const choose = async (label) => {
        await options.click();
        await page.getByRole('menuitem', { name: label, exact: true }).click();
      };
      await choose('Tặng sao');
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Số sao', { exact: true }).fill('5');
      const beforeGiftReads = reads.length;
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).evaluate((n) => {
        n.click();
        n.click();
      });
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes.length, 1);
      assert.equal(reads.length, beforeGiftReads);
      assert.equal((await f.total()).stars, 12);
      assert.equal((await f.board()).lessons[0].stars, 12);
      assert.equal(
        await page.locator('tr').filter({ hasText: 'fixture1' }).locator('td').nth(5).innerText(),
        '12',
      );
      await choose('Reset sao');
      assert.match(await dialog.innerText(), /12 sao/);
      await dialog.getByLabel('Gõ chính xác accept để xác nhận', { exact: true }).fill('Accept');
      await dialog.locator('form').evaluate((n) => n.requestSubmit());
      assert.equal(writes.length, 1);
      await dialog.getByLabel('Gõ chính xác accept để xác nhận', { exact: true }).fill('accept');
      await dialog.getByRole('button', { name: 'Reset sao', exact: true }).evaluate((n) => {
        n.click();
        n.click();
      });
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes.length, 2);
      assert.equal((await f.total()).stars, 0);
      assert.equal((await f.board()).lessons.find((r) => r.user_id === id(1)).stars, 0);
      await choose('Tặng sao');
      await dialog.getByLabel('Số sao', { exact: true }).fill('3');
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await f.total()).stars, 3);
      // The first response is lost after the real transaction commits.
      failGiftAfterCommit = true;
      await choose('Tặng sao');
      await dialog.getByLabel('Số sao', { exact: true }).fill('5');
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await f.total()).stars, 8);
      assert.equal(writes.at(-1).body.requestId, writes.at(-2).body.requestId);
      failResetAfterCommit = true;
      await choose('Reset sao');
      await dialog.getByLabel('Gõ chính xác accept để xác nhận', { exact: true }).fill('accept');
      await dialog.getByRole('button', { name: 'Reset sao', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await f.gift(id(200), 3);
      await dialog.getByRole('button', { name: 'Reset sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await f.total()).stars, 3);
      assert.equal(writes.at(-1).body.requestId, writes.at(-2).body.requestId);
      await page.goto('http://127.0.0.1:4207/#classroom');
      await page.locator('.class-top-list').waitFor();
      await f.gift(id(201), 5);
      const boardReads = reads.filter((r) => r.action === 'class_stars').length;
      await page.evaluate(
        ({ userId, classId }) =>
          window.dispatchEvent(
            new CustomEvent('tipy-points-changed', { detail: { userId, classIds: [classId] } }),
          ),
        { userId: id(1), classId: id(50) },
      );
      await page.waitForFunction(
        () => document.querySelector('.class-top-list li strong')?.textContent === '8sao',
      );
      assert.equal(reads.filter((r) => r.action === 'class_stars').length, boardReads + 1);
      await page
        .locator('.class-achievements')
        .screenshot({ path: `test-results/star-balance/board-${width}.png` });
      await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
      assert.match(await dialog.innerText(), /tổng sao hiện tại/);
      await page.keyboard.press('Escape');
      await page.goto('http://127.0.0.1:4207/admin');
      await options.waitFor();
      const afterLeaving = reads.filter((r) => r.action === 'class_stars').length;
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent('tipy-points-changed', { detail: { userId: 'test', stars: 0 } }),
        ),
      );
      await page.waitForTimeout(100);
      assert.equal(
        reads.filter((r) => r.action === 'class_stars').length,
        afterLeaving,
        'leaderboard listener removed',
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.deepEqual(errors, []);
      user = { user_id: id(1), role: 'student', full_name: 'Học sinh thử 1' };
      const student = await context.newPage();
      await student.goto('http://127.0.0.1:4207/#classroom');
      await student.getByText('Sao của bạn: 8', { exact: true }).waitFor();
      await student.locator('.class-top-list').waitFor();
      const statuses = await student.evaluate(
        async ({ userId, requestId }) => {
          const result = [];
          for (const action of ['star_gift', 'star_reset']) {
            result.push(
              (
                await fetch('/api/tipy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action,
                    userId,
                    requestId,
                    amount: 5,
                    confirm: 'accept',
                    role: 'admin',
                  }),
                })
              ).status,
            );
          }
          return result;
        },
        { userId: id(1), requestId: id(203) },
      );
      assert.deepEqual(statuses, [403, 403]);
      assert.equal((await f.total()).stars, 8);
      measurements.push({
        width,
        menuRequests: 0,
        invalidAcceptWrites: 0,
        giftWrites: 1,
        resetWrites: 1,
        doubleClickWrites: 1,
        postWriteListReads: 0,
        retryWrites: 2,
        leaderboardRefreshReads: 1,
        sql: 'PGlite isolated',
        crossConnectionConcurrency: 'not verified',
      });
      console.log(JSON.stringify(measurements.at(-1)));
    } finally {
      await context.close();
      await f.db.close();
    }
  }
  writeFileSync('test-results/star-balance/requests.json', JSON.stringify(measurements, null, 2));
} finally {
  await browser.close();
  server.kill();
}
