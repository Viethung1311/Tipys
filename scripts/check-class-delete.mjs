/** Browser fixtures only: never delete a live class. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  await new Promise((r) => setTimeout(r, 1000));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 740 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let classes = [
      { class_id: 'active', name: 'Lớp đang mở', archived_at: null },
      { class_id: 'test', name: 'Lớp thử riêng', archived_at: '2026-11-11' },
    ];
    let pending = [],
      writes = 0;
    await page.route('**/api/tipy*', async (route) => {
      const body = route.request().postDataJSON(),
        action = body?.action || new URL(route.request().url()).searchParams.get('action');
      let json = {};
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: { role: 'admin', user_id: 'teacher', full_name: 'Giáo viên' },
          games: [],
          classes,
        };
      if (action === 'students_page')
        json = {
          students: [],
          summary: { students: 0, seconds: 0, plays: 0 },
          total: 0,
          page: 1,
          pages: 1,
        };
      if (action === 'avatar') json = { avatar: null };
      if (action === 'classes') json = { classes };
      if (action === 'class_deletions') json = { deletions: pending };
      if (action === 'class_delete') {
        writes++;
        assert.equal(body.classId, 'test');
        assert.equal(body.confirmName, 'Lớp thử riêng');
        await new Promise((r) => setTimeout(r, 200));
        if (writes === 1)
          return route.fulfill({ status: 503, json: { error: 'Lỗi thử nghiệm, chưa xóa lớp.' } });
        classes = classes.filter((c) => c.class_id !== 'test');
        pending = writes === 2 ? [{ class_id: 'test', name: 'Lớp thử riêng' }] : [];
        json = {
          data: {
            deleted: true,
            cleanupPending: !!pending.length,
            message: pending.length ? 'Lớp đã xóa, còn tệp cần dọn.' : 'Đã xóa vĩnh viễn lớp.',
          },
        };
      }
      await route.fulfill({ json });
    });
    const openClasses = async () => {
      await page.getByRole('button', { name: 'Lớp học', exact: true }).click();
      await page.locator('.admin-classes .class-select select').waitFor();
    };
    await page.goto('http://127.0.0.1:4188/admin');
    await openClasses();
    await page.locator('.admin-classes .class-select select').selectOption('active');
    assert.equal(await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).count(), 0);
    await page.locator('.admin-classes .class-select select').selectOption('test');
    await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
    let dialog = page.getByRole('dialog');
    const confirm = () => dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true });
    assert.equal(await confirm().isDisabled(), true);
    await dialog.locator('input').fill('Lớp thử');
    assert.equal(await confirm().isDisabled(), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes, 0);
    await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
    dialog = page.getByRole('dialog');
    assert.equal(await dialog.locator('input').inputValue(), '');
    await dialog.locator('input').fill('Lớp thử riêng');
    await confirm().click();
    assert.equal(
      await dialog.getByRole('button', { name: 'Đang xóa…', exact: true }).isDisabled(),
      true,
    );
    await dialog.getByRole('alert').waitFor();
    assert.equal(writes, 1);
    assert.equal(await dialog.locator('input').inputValue(), 'Lớp thử riêng');
    const rect = await dialog.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
    await confirm().click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.admin-classes .class-select select').inputValue(), '');
    await page.getByRole('button', { name: 'Dọn tệp còn lại', exact: true }).waitFor();
    await page.reload();
    await openClasses();
    await page.getByRole('button', { name: 'Dọn tệp còn lại', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('input').fill('Lớp thử riêng');
    await confirm().click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () => !document.querySelector('.admin-classes')?.textContent.includes('Dọn tệp còn lại'),
    );
    assert.equal(writes, 3);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        activeProtected: true,
        exactName: true,
        escape: true,
        retry: true,
        pendingAfterReload: true,
        validSelection: true,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
