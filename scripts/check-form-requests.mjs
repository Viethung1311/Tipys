import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { studentPage } from '../tests/student-page-fixture.js';
import { assessmentSnapshot } from '../server/modules/assessments.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4200'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const writes = [],
  reads = [],
  errors = [];
const id = '00000000-0000-4000-8000-000000000001';
let classes = [],
  exams = [];
try {
  await new Promise((r) => setTimeout(r, 1200));
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/tipy*', async (route) => {
    const body = route.request().postDataJSON(),
      q = new URL(route.request().url()).searchParams,
      action = body?.action || q.get('action');
    (body ? writes : reads).push(action);
    let json = {};
    if (action === 'bootstrap')
      json = {
        configured: true,
        user: { user_id: 'admin', role: 'admin', full_name: 'Giáo viên thử' },
        classes,
        games: [],
      };
    if (action === 'stars') json = { stars: 0 };
    if (action === 'avatar') json = { avatar: {} };
    if (action === 'students_page')
      json = studentPage(
        [
          {
            user_id: id,
            full_name: 'Học sinh thử',
            username: 'test',
            is_active: true,
            total_active_seconds: 10,
            total_plays: 1,
          },
        ],
        q,
      );
    if (action === 'class_deletions') json = { deletions: [] };
    if (action === 'classes') json = { classes };
    if (action === 'class_save') {
      const row = { class_id: id, name: body.name, archived_at: null };
      classes = [row];
      json = { data: row };
    }
    if (action === 'star_gift') json = { data: { completed: true, amount: body.amount } };
    if (action === 'assessments')
      json = {
        items: exams.map((e) => ({ ...e, title: e.definition.title })),
        page: 1,
        pages: 1,
        total: exams.length,
      };
    if (action === 'assessment_save') {
      const exam = {
        assessment_id: body.assessmentId,
        version: 1,
        status: 'draft',
        definition: assessmentSnapshot(body),
      };
      exams = [exam];
      json = { data: exam };
    }
    if (action === 'assessment') json = { assessment: exams[0] };
    await new Promise((r) => setTimeout(r, 100));
    await route.fulfill({ json });
  });
  await page.goto('http://127.0.0.1:4200/admin');
  await page.getByRole('button', { name: /Tùy chọn:/ }).waitFor();
  assert.equal(
    reads.filter((a) => a === 'students_page').length,
    1,
    'initial student page is reused',
  );
  await page.getByRole('button', { name: 'Lớp học', exact: true }).click();
  const classInput = page.getByLabel('Tên lớp mới');
  await classInput.fill('   ');
  await page.getByRole('button', { name: 'Tạo lớp mới', exact: true }).click();
  await classInput.press('Enter');
  assert.equal(writes.length, 0);
  assert.equal(await classInput.getAttribute('aria-invalid'), 'true');
  assert.equal(await classInput.evaluate((el) => el === document.activeElement), true);
  await classInput.fill('Lớp thử riêng');
  assert.equal(await classInput.getAttribute('aria-invalid'), 'false');
  await page.getByRole('button', { name: 'Tạo lớp mới', exact: true }).evaluate((b) => {
    b.click();
    b.click();
  });
  await page.getByText('Đã lưu thay đổi.', { exact: true }).waitFor();
  assert.equal(writes.filter((a) => a === 'class_save').length, 1);
  await classInput.fill('Lớp thử Enter');
  const classSaved = page.waitForResponse(
    (r) => r.request().postDataJSON()?.action === 'class_save',
  );
  await classInput.press('Enter');
  await classSaved;
  assert.equal(writes.filter((a) => a === 'class_save').length, 2);
  await page.getByRole('button', { name: 'Học sinh & thời gian', exact: true }).click();
  await page.getByRole('button', { name: /Tùy chọn:/ }).click();
  await page.getByRole('menuitem', { name: 'Tặng sao', exact: true }).click();
  const dialog = page.getByRole('dialog'),
    amount = dialog.getByLabel('Số sao', { exact: true });
  await amount.fill('1.5');
  await amount.press('Enter');
  await dialog.locator('form').evaluate((form) => form.requestSubmit());
  assert.equal(writes.filter((a) => a === 'star_gift').length, 0);
  await amount.fill('2');
  await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).evaluate((b) => {
    b.click();
    b.click();
  });
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(writes.filter((a) => a === 'star_gift').length, 1);
  await page.getByRole('button', { name: /Tùy chọn:/ }).click();
  await page.getByRole('menuitem', { name: 'Tặng sao', exact: true }).click();
  await dialog.getByLabel('Số sao', { exact: true }).fill('3');
  await dialog.getByLabel('Số sao', { exact: true }).press('Enter');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(writes.filter((a) => a === 'star_gift').length, 2);
  await page.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click();
  const title = page.getByLabel('Tên bài kiểm tra', { exact: true });
  await title.fill('  ');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await title.press('Enter');
  assert.equal(writes.filter((a) => a === 'assessment_save').length, 0);
  await title.fill('Bài thử riêng');
  await page.getByLabel('Thời gian mở bài', { exact: true }).selectOption('scheduled');
  await page.getByLabel('Giờ mở', { exact: true }).fill('2026-11-20T09:00');
  await page.getByLabel('Giờ kết thúc', { exact: true }).fill('2026-11-20T09:00');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  assert.equal(writes.filter((a) => a === 'assessment_save').length, 0);
  await page.getByText('Giờ kết thúc phải sau giờ mở.', { exact: true }).waitFor();
  await page.getByLabel('Thời gian mở bài', { exact: true }).selectOption('always');
  await page.getByLabel('Thêm phần Chữ rơi', { exact: true }).check();
  await page.getByRole('button', { name: 'Xem trước', exact: true }).evaluate((b) => {
    b.click();
    b.click();
  });
  await page.getByRole('article', { name: 'Xem trước bài kiểm tra', exact: true }).waitFor();
  assert.equal(writes.filter((a) => a === 'assessment_save').length, 1);
  assert.equal(exams[0].definition.schedule.mode, 'always');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await title.fill('Bài thử Enter');
  const examSaved = page.waitForResponse(
    (r) => r.request().postDataJSON()?.action === 'assessment_save',
  );
  await title.press('Enter');
  await examSaved;
  await page.getByRole('article', { name: 'Xem trước bài kiểm tra', exact: true }).waitFor();
  assert.equal(writes.filter((a) => a === 'assessment_save').length, 2);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      invalidClassClickEnter: 0,
      invalidGiftEnter: 0,
      invalidExamClickEnter: 0,
      invalidSchedule: 0,
      validDoubleClick: { class_save: 1, star_gift: 1, assessment_save: 1 },
      validEnter: { class_save: 1, star_gift: 1, assessment_save: 1 },
      initialStudentPageReads: 1,
      responsive: [320, 768, 1440],
      errors,
    }),
  );
} finally {
  await browser.close();
  server.kill();
}
