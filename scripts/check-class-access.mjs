/** Four isolated role fixtures; no real membership, account or Storage writes. */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4189'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const own = { class_id: 'own', name: 'Lớp của An', archived_at: null },
  other = { class_id: 'other', name: 'Lớp khác', archived_at: null };
try {
  await new Promise((r) => setTimeout(r, 1000));
  for (const width of [320, 1440])
    for (const role of ['guest', 'none', 'member', 'admin']) {
      const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: 'reduce',
        }),
        errors = [],
        requests = [];
      let current = role,
        joined = role === 'member';
      const user = () =>
        current === 'guest'
          ? null
          : {
              user_id: current === 'admin' ? 'teacher' : 'an',
              username: current === 'admin' ? 'admin' : 'an',
              full_name: current === 'admin' ? 'Giáo viên Zunimo' : 'Bạn An',
              role: current === 'admin' ? 'admin' : 'student',
            };
      const classes = () =>
        current === 'admin' ? [own, other] : current === 'member' && joined ? [own] : [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/api/tipy*', async (route) => {
        const req = route.request(),
          body = req.postDataJSON(),
          q = new URL(req.url()).searchParams,
          action = body?.action || q.get('action');
        requests.push({ action, classId: q.get('classId') });
        let json = {};
        if (action === 'login') {
          current = 'member';
          joined = true;
        }
        if (action === 'logout') current = 'guest';
        if (action === 'bootstrap')
          json = { configured: true, user: user(), games: [], classes: classes() };
        if (action === 'classes') json = { classes: classes() };
        if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
        if (action === 'stars') json = { stars: 8 };
        if (action === 'class_stars')
          json = {
            memberCount: 1,
            lessons: [{ user_id: 'an', name: 'Bạn An', animal: 'icon_01', stars: 3, completed: 1 }],
            weekly: [
              { user_id: 'an', name: 'Bạn An', animal: 'icon_01', score: 100, accuracy: 95 },
            ],
            weekStart: q.get('week') || '2026-11-09',
            weekEnd: q.has('week') ? '2026-11-09' : '2026-11-16',
            currentWeek: '2026-11-09',
            closure: q.has('week') ? { winnerId: 'an' } : null,
            rule: 'Khó · A–Z · hard-v1',
          };
        if (action === 'students_page')
          json = {
            students: [],
            summary: { students: 0, seconds: 0, plays: 0 },
            total: 0,
            page: 1,
            pages: 1,
          };
        if (action === 'class_deletions') json = { deletions: [] };
        if (['classroom', 'class_posts', 'class_file', 'class_download'].includes(action)) {
          const allowed = classes().some(
            (c) => c.class_id === (q.get('classId') || q.get('attachmentId')),
          );
          if (!allowed)
            return route.fulfill({
              status: user() ? 403 : 401,
              json: { error: 'Bạn chưa được thêm vào lớp này.' },
            });
          json = {
            classroom: own,
            members: [],
            achievements: [],
            posts: [
              {
                post_id: 'post',
                title: 'Bài riêng của lớp An',
                body: 'Nội dung chỉ thành viên',
                created_at: '2026-11-12',
                class_attachments: [],
              },
            ],
          };
        }
        if (action === 'quest_class_report') json = { students: [] };
        await route.fulfill({ json });
      });
      const nav = () =>
        page
          .getByRole('navigation', { name: 'Điều hướng chính' })
          .getByRole('button', { name: 'Lớp học', exact: true });
      await page.goto('http://127.0.0.1:4189');
      await page.locator('.loading-fullscreen').waitFor({ state: 'hidden' });
      assert.match(await page.title(), /Zunimo/);
      assert.doesNotMatch(await page.locator('body').innerText(), /TIPY|68 Phạm Tứ/i);
      assert.equal(await page.locator('.location-card').count(), 0);
      if (role === 'guest' || role === 'none') {
        assert.equal(await nav().count(), 0);
        await page.getByRole('button', { name: 'Luyện bàn phím', exact: true }).first().click();
        await page.locator('.game-library').waitFor();
        await page.goto('http://127.0.0.1:4189/#classroom');
        await page.locator('.loading-fullscreen').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.class-post').count(), 0);
        assert.equal(requests.filter((r) => r.action === 'classroom').length, 0);
        await page.locator('.account-button').click();
        if (role === 'none')
          await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
        await page.locator('input[name=username]').fill('an');
        await page.locator('input[name=password]').fill('1');
        await page.getByRole('button', { name: 'Vào chơi nào', exact: true }).click();
        await page.locator('.account-summary').waitFor();
        await page.keyboard.press('Escape');
        await nav().waitFor();
        await page.reload();
        await nav().waitFor();
      } else {
        await nav().waitFor();
        await page.getByRole('button', { name: 'Vào học', exact: true }).first().click();
        await page.getByRole('heading', { name: 'Bài riêng của lớp An', exact: true }).waitFor();
        if (role === 'member') {
          await page.getByRole('tab', { name: 'Sao trong lớp tuần này', exact: true }).waitFor();
          await page.getByRole('tab', { name: '2. Chữ rơi · Khó', exact: true }).click();
          await page.getByText('09/11–15/11', { exact: true }).waitFor();
          assert.doesNotMatch(
            await page.locator('.class-achievements').innerText(),
            /hard-v1|múi giờ/,
          );
          await page.getByRole('button', { name: 'Tuần trước', exact: true }).click();
          await page.getByText('02/11–08/11', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
          await page.getByRole('dialog').getByText('Sao của bạn', { exact: true }).waitFor();
          await page.keyboard.press('Escape');
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
          assert.match(await page.locator('.account-points').innerText(), /Sao của bạn: 8/);
          const headerRight =
            (await page.locator('.header-account-group').boundingBox()).x +
            (await page.locator('.header-account-group').boundingBox()).width;
          assert.equal(await page.locator('.class-select option').count(), 1);
          for (const action of ['classroom', 'class_posts', 'class_file', 'class_download']) {
            const result = await page.evaluate(async (action) => {
              const r = await fetch(
                '/api/tipy?' +
                  new URLSearchParams({ action, classId: 'other', attachmentId: 'other' }),
              );
              return { status: r.status, text: await r.text() };
            }, action);
            assert.equal(result.status, 403);
            assert.doesNotMatch(result.text, /Bài riêng/);
          }
          joined = false;
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
          await nav().waitFor({ state: 'hidden' });
          await page
            .getByText('Bạn cần đăng nhập và được giáo viên thêm vào lớp.', { exact: true })
            .waitFor();
          assert.equal(await page.locator('.class-post').count(), 0);
          const afterHeader = await page.locator('.header-account-group').boundingBox();
          assert.ok(
            Math.abs(afterHeader.x + afterHeader.width - headerRight) < 1,
            'account group keeps right edge without class navigation',
          );
          joined = true;
          await page.reload();
          await page.getByRole('heading', { name: 'Bài riêng của lớp An', exact: true }).waitFor();
        } else {
          assert.equal(await page.locator('.class-select option').count(), 2);
          await page.goto('http://127.0.0.1:4189/admin');
          await page.getByRole('button', { name: 'Lớp học', exact: true }).click();
          await page.locator('.admin-classes').waitFor();
          assert.equal(await page.locator('.admin-classes .class-select option').count(), 3);
        }
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          width,
          role,
          navigation: true,
          cta: true,
          loginReload: true,
          brand: 'Zunimo',
          revocation: role === 'member',
          errors,
        }),
      );
      await page.close();
    }
} finally {
  await browser.close();
  server.kill();
}
