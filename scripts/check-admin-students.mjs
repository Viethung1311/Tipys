/** Browser checks use isolated fixture accounts only; no real Auth deletes. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { studentPage } from '../tests/student-page-fixture.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/admin-students', { recursive: true });
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const classes = [
  { class_id: id(50), name: 'STEM A' },
  { class_id: id(51), name: 'STEM B' },
];
try {
  await new Promise((r) => setTimeout(r, 1200));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      }),
      errors = [],
      writes = [];
    let failDelete = true;
    let students = Array.from({ length: 15 }, (_, i) => ({
      user_id: id(i + 1),
      username: `kid${String(i + 1).padStart(2, '0')}`,
      full_name: `Học sinh ${i + 1}`,
      is_active: true,
      total_active_seconds: i === 1 ? 9 : (i + 1) * 60,
      total_plays: 1,
      class_members: classes
        .filter((c, j) => (j === 0 ? i < 8 : i % 3 === 0))
        .map((c) => ({ class_id: c.class_id, classes: c, is_active: true })),
    }));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/tipy*', async (route) => {
      const request = route.request(),
        params = new URL(request.url()).searchParams,
        body = request.postDataJSON(),
        action = body?.action || params.get('action');
      let json = {};
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: { role: 'admin', user_id: id(99), full_name: 'Giáo viên' },
          games: [],
          classes,
        };
      if (action === 'students_page') json = studentPage(students, params);
      if (action === 'students') json = { students };
      if (action === 'classes') json = { classes };
      if (body) writes.push(body);
      if (action === 'student_delete') {
        assert.equal(
          body.confirmUsername,
          students.find((s) => s.user_id === body.userId).username,
        );
        if (failDelete) {
          failDelete = false;
          return route.fulfill({ status: 503, json: { error: 'Chưa xóa được, thử lại an toàn.' } });
        }
        students = students.filter((s) => s.user_id !== body.userId);
        json = { data: { deleted: true, userId: body.userId } };
      }
      if (action === 'class_members') {
        for (const s of students)
          if (body.userIds.includes(s.user_id)) {
            s.class_members = s.class_members.filter((m) => m.class_id !== body.classId);
            if (body.active)
              s.class_members.push({
                class_id: body.classId,
                is_active: true,
                classes: classes.find((c) => c.class_id === body.classId),
              });
          }
        json = { data: { userIds: body.userIds } };
      }
      await route.fulfill({ json });
    });
    const waitRows = async (n) => {
      await page.waitForFunction(
        (n) =>
          document.querySelectorAll('tbody tr').length === n &&
          ![...document.querySelectorAll('[role="status"]')].some((e) =>
            /Đang tải/.test(e.textContent),
          ),
        n,
      );
    };
    const table = page.locator('.admin-students');
    await page.goto('http://127.0.0.1:4187/admin');
    await waitRows(7);
    assert.ok(
      await page
        .locator('.admin-students tbody tr')
        .evaluateAll((rows) => rows.every((row) => row.getBoundingClientRect().height < 110)),
    );
    await page.screenshot({
      path: `test-results/admin-students/${width}-students.png`,
      fullPage: true,
    });
    assert.equal(
      await table.locator('tbody tr').first().locator('td').nth(1).textContent(),
      'kid15',
    );
    await table.getByRole('button', { name: 'Sau', exact: true }).click();
    await table.getByRole('button', { name: 'Trang 2', exact: true }).getAttribute('aria-current');
    await waitRows(7);
    await table.getByLabel('Lọc lớp', { exact: true }).selectOption(id(50));
    await page.waitForFunction(() =>
      document.querySelector('.admin-pagination').textContent.includes('8 tài khoản'),
    );
    await table.getByLabel('Thời gian luyện', { exact: true }).selectOption('asc');
    await page.waitForFunction(
      () => document.querySelector('tbody tr td:nth-child(2)')?.textContent === 'kid02',
    );
    await table.getByLabel('Tìm học sinh', { exact: true }).fill('kid01');
    await waitRows(1);
    assert.match(await table.locator('tbody tr').textContent(), /STEM A, STEM B/);
    assert.equal(
      await table
        .getByRole('button', { name: 'Trang 1', exact: true })
        .getAttribute('aria-current'),
      'page',
    );
    await table.getByLabel('Tìm học sinh', { exact: true }).fill('');
    await table.getByLabel('Lọc lớp', { exact: true }).selectOption('none');
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 5);
    await table.getByLabel('Lọc lớp', { exact: true }).selectOption('all');
    await table.getByLabel('Thời gian luyện', { exact: true }).selectOption('desc');
    await waitRows(7);
    await table.getByRole('button', { name: 'Trang 3', exact: true }).click();
    await waitRows(1);
    await table.getByRole('button', { name: /Tùy chọn:/ }).click();
    await page.getByRole('menuitem', { name: 'Xóa tài khoản', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.match(await dialog.textContent(), /kid02/);
    await dialog.getByRole('textbox').fill('wrong');
    assert.ok(
      await dialog.getByRole('button', { name: 'Xóa tài khoản', exact: true }).isDisabled(),
    );
    await page.keyboard.press('Escape');
    assert.equal(writes.filter((w) => w.action === 'student_delete').length, 0);
    await table.getByRole('button', { name: /Tùy chọn:/ }).click();
    await page.getByRole('menuitem', { name: 'Xóa tài khoản', exact: true }).click();
    await dialog.getByRole('textbox').fill('kid02');
    await dialog.getByRole('button', { name: 'Xóa tài khoản', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    const modalBounds = await dialog.boundingBox();
    assert.ok(
      modalBounds.x >= 0 &&
        modalBounds.y >= 0 &&
        modalBounds.x + modalBounds.width <= width + 1 &&
        modalBounds.y + modalBounds.height <= 901,
    );
    assert.equal(students.length, 15);
    await page.screenshot({
      path: `test-results/admin-students/${width}-delete-error.png`,
      fullPage: true,
    });
    await dialog.getByRole('button', { name: 'Xóa tài khoản', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await waitRows(7);
    assert.equal(students.length, 14);
    assert.equal(
      await table
        .getByRole('button', { name: 'Trang 2', exact: true })
        .getAttribute('aria-current'),
      'page',
    );
    await page
      .getByRole('navigation', { name: 'Quản trị' })
      .getByRole('button', { name: 'Lớp học', exact: true })
      .click();
    await page.getByLabel('Chọn lớp để quản lý').selectOption(id(50));
    const roster = page.locator('.roster-editor');
    await waitRows(7);
    await roster.getByLabel('Tìm học sinh', { exact: true }).fill('kid01');
    await waitRows(1);
    const first = roster.locator('tbody tr').filter({ hasText: 'kid01' });
    assert.match(await first.textContent(), /Đã vào.*STEM A, STEM B/);
    await roster.getByLabel('Tìm học sinh', { exact: true }).fill('');
    await waitRows(7);
    await roster
      .getByRole('checkbox', { name: 'Chọn tất cả học sinh đang hiển thị', exact: true })
      .check();
    assert.equal(await roster.locator('tbody input:checked').count(), 7);
    await roster.getByRole('button', { name: 'Sau', exact: true }).click();
    await waitRows(7);
    assert.equal(await roster.locator('tbody input:checked').count(), 0);
    assert.match(await roster.locator('.roster-actions').textContent(), /Đã chọn 0/);
    await roster.getByLabel('Hiển thị', { exact: true }).selectOption('candidates');
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.roster-editor tbody tr').length === 7 &&
        !document.querySelector('.roster-editor tbody input')?.disabled,
    );
    await roster.locator('tbody input').first().check();
    await roster.getByRole('button', { name: 'Thêm vào lớp (1)', exact: true }).click();
    await page.getByText('Đã thêm 1 học sinh vào lớp.', { exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector('.roster-editor .roster-actions button')?.disabled ||
        document.querySelector('.roster-editor tbody tr'),
    );
    await roster.getByLabel('Hiển thị', { exact: true }).selectOption('members');
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.roster-editor tbody tr').length === 7 &&
        !document.querySelector('.roster-editor tbody input')?.disabled,
    );
    await roster.locator('tbody input').first().check();
    await roster.getByRole('button', { name: 'Bỏ khỏi lớp (1)', exact: true }).click();
    await page.getByText('Đã bỏ 1 học sinh khỏi lớp.', { exact: true }).waitFor();
    await page.screenshot({
      path: `test-results/admin-students/${width}-roster.png`,
      fullPage: true,
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        serverPages: true,
        combinedFilters: true,
        confirmationAndRetry: true,
        pageClampAfterDelete: true,
        pageOnlySelection: true,
        bulkAddRemove: true,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
