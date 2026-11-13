/** Chrome → actual API handler → isolated PostgreSQL (PGlite); no hosted writes. */
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { starFixture, id } from '../tests/star-balance-fixture.js';
import { createStars } from '../server/modules/stars.js';
import { createStudents } from '../server/modules/students.js';
import { createAssessments, assessmentSnapshot } from '../server/modules/assessments.js';
import { createHandler } from '../api/tipy.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4213'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  measurements = [];
mkdirSync('test-results/star-deductions', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 1000));
  for (const width of [320, 1440]) {
    const f = await starFixture();
    await f.db.exec(readFileSync('db/star_deductions.sql', 'utf8'));
    for (const file of [
      'assessments',
      'assessment_policies',
      'assessment_class_access',
      'assessment_best_results',
    ])
      await f.db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    const definition = assessmentSnapshot({
      title: 'Bài điểm tốt nhất',
      targets: { classIds: [], userIds: [id(1)] },
      selection: { questIds: [], falling: { difficulty: 'easy', keys: ['A'], targetScore: 20 } },
    });
    await f.db.query(
      "insert into assessments(assessment_id,created_by,definition,status) values($1,$2,$3,'published')",
      [id(800), id(99), definition],
    );
    await f.db.query(
      'insert into assessment_assignments(assessment_id,user_id,direct,allowed_attempts) values($1,$2,true,3)',
      [id(800), id(1)],
    );
    for (const [index, score] of [50, 80, 60].entries())
      await f.db.query(
        'insert into assessment_attempts(assessment_id,user_id,attempt_number,definition,submitted_at,active_seconds,results) values($1,$2,$3,$4,$5,$6,$7)',
        [
          id(800),
          id(1),
          index + 1,
          definition,
          `2026-11-13T0${index + 1}:00:00Z`,
          (index + 1) * 60,
          [
            {
              id: definition.sections[0].id,
              title: definition.sections[0].title,
              type: 'falling',
              score,
              correct: score / 10,
              wrong: 0,
              missed: 0,
              accuracy: 100,
              completed: true,
              outcome: 'good',
              targetScore: 20,
              seconds: (index + 1) * 60,
            },
          ],
        ],
      );
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      }),
      page = await context.newPage(),
      calls = [],
      errors = [];
    let user = { user_id: id(99), role: 'admin', full_name: 'Giáo viên thử' },
      failAfterCommit = false;
    const classroom = { class_id: id(50), name: 'Lớp thử', archived_at: null };
    const rpc = async (name, args) => {
      try {
        const entries = Object.entries(args);
        return {
          data: (
            await f.q(
              `select ${name}(${entries.map(([k], i) => `${k}=>$${i + 1}`).join(',')}) r`,
              entries.map(([, v]) => v),
            )
          ).r,
        };
      } catch (e) {
        return { error: { message: e.message } };
      }
    };
    const backend = {
      ...createStars({ rpc }),
      ...createStudents({ rpc }),
      ...createAssessments({ rpc }),
      session: async () => ({ profile: user }),
    };
    const handler = createHandler({ makeBackend: () => backend });
    await context.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        query = Object.fromEntries(new URL(req.url()).searchParams),
        action = body?.action || query.action;
      calls.push({ action, body });
      let json;
      if (action === 'bootstrap')
        json = { configured: true, user, classes: [classroom], games: [] };
      if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
      if (action === 'classes') json = { classes: [classroom] };
      if (action === 'quest_class_report') json = { students: [] };
      if (action === 'classroom')
        json = {
          classroom,
          canManage: user.role === 'admin',
          posts: [],
          members: [
            {
              user_id: id(1),
              name: 'Học sinh thử 1',
              username: user.role === 'admin' ? 'fixture1' : undefined,
              stars: (await f.total()).stars,
              avatar: { animal: 'icon_01' },
            },
          ],
        };
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
          status(n) {
            status = n;
            return this;
          },
          json(v) {
            response = v;
          },
        },
      );
      if (body) await new Promise((r) => setTimeout(r, 100));
      if (action === 'star_deduct' && failAfterCommit) {
        failAfterCommit = false;
        return route.fulfill({
          status: 503,
          json: { error: 'Mất phản hồi sau khi lưu. Thử lại cùng yêu cầu.' },
        });
      }
      return route.fulfill({ status, json: response });
    });
    page.on('pageerror', (e) => errors.push(e.message));
    const writes = () => calls.filter((c) => c.body),
      choose = async (anchor, label) => {
        await anchor.click();
        await page.getByRole('menuitem', { name: label, exact: true }).click();
      };
    try {
      await page.goto('http://127.0.0.1:4213/admin');
      const options = page.getByRole('button', {
          name: 'Tùy chọn: Học sinh thử 1 · fixture1',
          exact: true,
        }),
        dialog = page.getByRole('dialog');
      await options.waitFor();
      const start = calls.length;
      await options.click();
      await page.keyboard.press('Escape');
      assert.equal(calls.length, start);
      await choose(options, 'Trừ sao');
      for (const amount of ['0', '-1', '1.5', '8']) {
        await dialog.getByLabel('Số sao', { exact: true }).fill(amount);
        assert.equal(
          await dialog.getByRole('button', { name: 'Trừ sao', exact: true }).isDisabled(),
          true,
        );
        await dialog.getByLabel('Số sao', { exact: true }).press('Enter');
      }
      assert.equal(writes().length, 0);
      await dialog.getByLabel('Số sao', { exact: true }).fill('2');
      await dialog.getByText('Còn lại sau khi trừ: 5 sao.', { exact: false }).waitFor();
      await dialog.getByRole('button', { name: 'Trừ sao', exact: true }).evaluate((b) => {
        b.click();
        b.click();
      });
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes().length, 1);
      assert.equal((await f.total()).stars, 5);
      assert.equal(
        await page.locator('tr').filter({ hasText: 'fixture1' }).locator('td').nth(5).innerText(),
        '5',
      );
      await choose(options, 'Tặng sao');
      await dialog.getByLabel('Số sao', { exact: true }).fill('5');
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await f.total()).stars, 10);
      await page.goto('http://127.0.0.1:4213/#classroom');
      const avatar = page.getByRole('button', {
        name: 'Thao tác sao: Học sinh thử 1',
        exact: true,
      });
      await avatar.waitFor();
      await page.locator('.class-top-list li strong').waitFor();
      const menuStart = calls.length;
      await avatar.press('Enter');
      await page.getByRole('menu').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(calls.length, menuStart);
      await choose(avatar, 'Tặng sao');
      assert.equal(
        await dialog.getByRole('img', { name: /Nhân vật của Học sinh thử 1/ }).count(),
        1,
      );
      await dialog.getByLabel('Số sao', { exact: true }).fill('5');
      const beforeGift = writes().length;
      await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes().length, beforeGift + 1);
      await page.waitForFunction(
        () => document.querySelector('.class-top-list li strong')?.textContent === '15sao',
      );
      await choose(avatar, 'Trừ sao');
      await dialog.getByLabel('Số sao', { exact: true }).fill('3');
      const beforeDeduct = writes().length;
      await dialog.getByRole('button', { name: 'Trừ sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes().length, beforeDeduct + 1);
      await page.waitForFunction(
        () => document.querySelector('.class-top-list li strong')?.textContent === '12sao',
      );
      failAfterCommit = true;
      await choose(avatar, 'Trừ sao');
      await dialog.getByLabel('Số sao', { exact: true }).fill('2');
      await dialog.getByRole('button', { name: 'Trừ sao', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Trừ sao', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await f.total()).stars, 10);
      assert.equal(writes().at(-1).body.requestId, writes().at(-2).body.requestId);
      await choose(avatar, 'Trừ sao');
      await dialog.screenshot({ path: `test-results/star-deductions/dialog-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      user = { user_id: id(1), role: 'student', full_name: 'Học sinh thử 1' };
      await page.reload();
      await page.getByText('Sao của bạn: 10', { exact: true }).waitFor();
      assert.equal(await avatar.count(), 0);
      const forbidden = await page.evaluate(
        async ({ userId, requestId, classId }) => {
          const r = await fetch('/api/tipy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'star_deduct', userId, requestId, classId, amount: 1 }),
          });
          return r.status;
        },
        { userId: id(1), requestId: id(900), classId: id(50) },
      );
      assert.equal(forbidden, 403);
      user = { user_id: id(99), role: 'admin', full_name: 'Giáo viên thử' };
      await page.goto('http://127.0.0.1:4213/admin');
      await page.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
      await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
      const bestRow = page.locator('.assessment-table tbody tr').first();
      await bestRow.getByText(/80 điểm/).waitFor();
      assert.equal(await bestRow.locator('td').nth(5).innerText(), '2 phút 0 giây');
      assert.equal(
        await bestRow.locator('td').nth(6).innerText(),
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date('2026-11-13T02:00:00Z')),
      );
      await page.screenshot({
        path: `test-results/star-deductions/best-teacher-${width}.png`,
        fullPage: true,
      });
      user = { user_id: id(1), role: 'student', full_name: 'Học sinh thử 1' };
      await page.goto('http://127.0.0.1:4213/#tests');
      await page.getByRole('button', { name: 'Xem bài', exact: true }).click();
      await page.getByRole('button', { name: 'Kết quả của em', exact: true }).click();
      await dialog.getByRole('heading', { name: 'Kết quả tốt nhất', exact: true }).waitFor();
      await dialog
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Kết quả tốt nhất', exact: true }) })
        .getByText(/80 điểm/)
        .first()
        .waitFor();
      assert.match(await dialog.innerText(), /Lượt 2 · 2 phút 0 giây/);
      assert.deepEqual(errors, []);
      const measurement = {
        width,
        menuRequests: 0,
        invalidWrites: 0,
        giftWrites: 1,
        deductWrites: 1,
        doubleClickRecords: 1,
        retryDeductsOnce: true,
        bestTeacherAndStudent: 80,
        studentStatus: forbidden,
        errors,
      };
      measurements.push(measurement);
      console.log(JSON.stringify(measurement));
    } finally {
      await context.close();
      await f.db.close();
    }
  }
  writeFileSync('test-results/star-deductions/network.json', JSON.stringify(measurements, null, 2));
} finally {
  await browser.close();
  server.kill();
}
