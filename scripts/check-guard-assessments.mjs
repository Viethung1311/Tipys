// Real React -> HTTP dispatcher -> isolated SQL; no production data or credentials.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { hubFixture } from '../tests/hub-fixture.js';
import { id } from '../tests/teacher-fixture.js';
import { createAssessments } from '../server/modules/assessments.js';
import { createHandler } from '../api/tipy.js';
import { defaultGuardSettings } from '../src/features/keyboard-guard/settings.js';
import { guardAssessmentDefaults } from '../src/features/keyboard-guard/assessment.js';
import { TEST_CONTENT } from '../src/features/assessments/content.js';
const dir = 'test-results/guard-assessments',
  origin = 'http://127.0.0.1:4211';
mkdirSync(dir, { recursive: true });
writeFileSync(
  dir + '/index.html',
  '<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.jsx"></script></html>',
);
writeFileSync(
  dir + '/entry.jsx',
  `import React from 'react';import {createRoot} from 'react-dom/client';import Page from '../../src/features/assessments/AssessmentsPage.jsx';import {setApiIdentity} from '../../src/game/backend.js';import '../../src/index.css';import '../../src/styles/responsive.css';import '../../src/styles/tipy-ui.css';import '../../src/styles/loading.css';const noop=()=>{};setApiIdentity(window.fixtureUser);createRoot(document.getElementById('root')).render(<React.StrictMode><Page user={window.fixtureUser} classes={window.fixtureClasses} sound={noop} onPlayingChange={noop}/></React.StrictMode>);`,
);
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4211', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' },
);
const f = await hubFixture();
let browser;
let lastPage;
const errors = [],
  metrics = [];
try {
  await f.db.exec(readFileSync('db/assessment_auto_finish.sql', 'utf8'));
  await f.db.exec(readFileSync('db/guard_assessments.sql', 'utf8'));
  const game = {
    game_code: 'keyboard_guard',
    engine_code: 'keyboard_guard',
    is_active: true,
    config: defaultGuardSettings(),
  };
  const service = createAssessments({
    rpc: f.rpc,
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { config: game.config } }),
    }),
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  async function open(profile, viewport, failFinal = false) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' }),
      calls = [];
    lastPage = page;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      ({ profile, classId }) => {
        window.fixtureUser = profile;
        window.fixtureClasses = [{ class_id: classId, name: 'Lớp thử' }];
        HTMLElement.prototype.requestFullscreen = () => Promise.reject(Error('denied in QA'));
      },
      { profile, classId: id(50) },
    );
    const handler = createHandler({
      env: { APP_ORIGIN: origin, NODE_ENV: 'development' },
      makeBackend: () => ({
        ...service,
        guardConfig: async () => ({ game }),
        studentsPage: async () => ({ students: [], total: 0, pages: 1, page: 1 }),
        session: async () => ({ profile }),
      }),
    });
    let lost = failFinal;
    await page.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        query = Object.fromEntries(new URL(req.url()).searchParams),
        action = body?.action || query.action;
      calls.push({ action, body });
      let status = 200,
        json;
      await handler(
        {
          method: req.method(),
          headers: { origin, 'content-type': 'application/json' },
          query,
          body,
        },
        {
          setHeader() {},
          status(n) {
            status = n;
            return this;
          },
          json(value) {
            json = value;
          },
        },
      );
      if (action === 'assessment_submit' && lost) {
        lost = false;
        return route.fulfill({ status: 503, json: { error: 'Mất phản hồi sau lưu' } });
      }
      return route.fulfill({ status, json });
    });
    await page.goto(origin + '/' + dir + '/index.html');
    return { page, calls };
  }
  const admin = await open(f.admin, { width: 1440, height: 900 });
  await admin.page.getByRole('button', { name: 'Tạo mới', exact: true }).click();
  await admin.page.getByLabel('Tên bài kiểm tra', { exact: true }).fill('Bài phi thuyền QA');
  await admin.page.getByLabel('Lớp thử', { exact: true }).check();
  await admin.page
    .locator('select')
    .filter({ has: admin.page.locator('option[value=unlimited]') })
    .selectOption('unlimited');
  await admin.page.getByLabel('Thêm Vệ binh bàn phím', { exact: true }).check();
  const editor = admin.page.getByRole('region', { name: 'Cấu hình bài Vệ binh bàn phím' });
  await editor
    .getByLabel('Số đợt', { exact: true })
    .waitFor({ timeout: 10000 })
    .catch(async (e) => {
      console.log(
        JSON.stringify({
          calls: admin.calls,
          body: await admin.page.locator('body').innerText(),
          errors,
        }),
      );
      throw e;
    });
  for (const field of await editor.getByLabel('Số thiên thạch', { exact: true }).all())
    await field.fill('1');
  for (const field of await editor.getByLabel('Tối đa cùng lúc', { exact: true }).all())
    await field.fill('1');
  await editor.getByLabel('Điểm đạt', { exact: true }).fill('10');
  await editor.getByLabel('Điểm hoàn thành tốt', { exact: true }).fill('20');
  await editor.locator('input[type="search"]').fill('em bé');
  await editor.getByRole('button', { name: /Chọn tất cả kết quả/ }).click();
  await admin.page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Chơi xem thử Vệ binh', exact: true }).waitFor();
  const saved = admin.calls.find((c) => c.action === 'assessment_save');
  assert.ok(saved.body.selection.guard.ids.length > 0);
  await admin.page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  assert.ok(
    (
      await admin.page.getByRole('region', { name: 'Cấu hình bài Vệ binh bàn phím' }).innerText()
    ).includes('Đã chọn'),
  );
  await admin.page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const beforePreview = admin.calls.length;
  await admin.page.getByRole('button', { name: 'Chơi xem thử Vệ binh', exact: true }).click();
  await admin.page.getByRole('textbox', { name: 'Gõ từ để bắn' }).waitFor();
  await admin.page.waitForTimeout(1100);
  assert.equal(admin.calls.length, beforePreview);
  await admin.page.getByRole('button', { name: 'Đóng xem thử', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Gửi bài', exact: true }).click();
  await admin.page.getByText('Đã gửi bài kiểm tra cho học sinh.', { exact: true }).waitFor();
  await admin.page.close();
  const examId = saved.body.assessmentId,
    student = await f.people(1);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const { page, calls } = await open(student, size, size.width === 1440);
    await page.getByRole('button', { name: 'Bắt đầu', exact: true }).evaluate((b) => {
      b.click();
      b.click();
    });
    await page.getByRole('textbox', { name: 'Gõ từ để bắn' }).waitFor();
    assert.equal(calls.filter((c) => c.action === 'assessment_start').length, 1);
    assert.equal(await page.getByRole('button', { name: 'Cài đặt', exact: true }).count(), 0);
    await page.waitForTimeout(1000);
    assert.equal(calls.filter((c) => /checkpoint|submit/.test(c.action)).length, 0);
    if (size.width === 1440) {
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục', exact: true }).click();
      await page.reload();
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
      await page.getByRole('textbox', { name: 'Gõ từ để bắn' }).waitFor();
    }
    const bounds = await page.locator('.guard-battle').boundingBox();
    assert.ok(bounds.height > 100 && bounds.y >= 0 && bounds.y + bounds.height <= size.height + 1);
    await page.screenshot({ path: `${dir}/${size.width}-playing.png` });
    const started = Date.now();
    while (Date.now() - started < 90000 && !(await page.locator('.play-result').count())) {
      if (await page.getByRole('button', { name: 'Thử lại', exact: true }).count()) {
        await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
        continue;
      }
      const continuation = page
        .getByRole('dialog')
        .getByRole('button', { name: 'Tiếp tục', exact: true });
      if (await continuation.count()) await continuation.click();
      const target = page.locator('.guard-labels span[data-state=falling]:not([hidden])').first();
      const label = (await target.count())
        ? await page
            .locator('.guard-labels span[data-state="falling"]:not([hidden])')
            .first()
            .textContent()
            .catch(() => null)
        : null;
      if (label) {
        assert.equal(label.toLowerCase(), 'em bé');
        const targetBounds = await page
          .locator('.guard-labels span[data-state="falling"]:not([hidden])')
          .first()
          .boundingBox();
        const field = page.getByRole('textbox', { name: 'Gõ từ để bắn' });
        if (targetBounds && targetBounds.y >= bounds.y + 10) {
          await field.fill('');
          await field.fill(label);
        }
      }
      await page.waitForTimeout(120);
    }
    await page.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
    const submits = calls.filter((c) => c.action === 'assessment_submit');
    assert.equal(submits.length, size.width === 1440 ? 2 : 1);
    if (submits.length === 2) assert.equal(submits[0].body.requestId, submits[1].body.requestId);
    assert.equal(calls.filter((c) => c.action === 'assessment_checkpoint').length, 0);
    await page.screenshot({ path: `${dir}/${size.width}-result.png` });
    const row = await f.q(
      'select results from assessment_attempts where assessment_id=$1 order by attempt_number desc limit 1',
      [examId],
    );
    assert.equal(row.results[0].destroyed, 3);
    assert.equal(row.results[0].score, 30);
    metrics.push({
      size,
      startRequests: calls.filter((c) => c.action === 'assessment_start').length,
      playingWrites: 0,
      finalRequests: submits.length,
      databaseResults: 1,
    });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(dir + '/metrics.json', JSON.stringify({ previewWrites: 0, metrics }, null, 2));
  console.log(JSON.stringify({ previewWrites: 0, metrics }, null, 2));
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    console.log(await lastPage.locator('body').innerText());
    console.log(
      await lastPage
        .locator('.overlay,.dialog-viewport')
        .evaluateAll((es) =>
          es.map((e) => ({
            cls: e.className,
            z: getComputedStyle(e).zIndex,
            rect: e.getBoundingClientRect().toJSON(),
          })),
        ),
    );
    await lastPage.screenshot({ path: dir + '/failure.png' });
  }
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await f.db.close();
}
