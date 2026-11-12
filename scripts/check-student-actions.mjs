/** Fixture-only browser checks: never reset students or grant real stars. */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { studentPage } from '../tests/student-page-fixture.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4196'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const students = [
  {
    user_id: id(1),
    username: 'testkid',
    full_name: 'Học sinh thử',
    is_active: true,
    total_active_seconds: 120,
    total_plays: 2,
    class_members: [],
  },
];
const games = [
  { game_id: id(10), game_name: 'Chữ rơi', game_code: 'falling_letters', config: {} },
  { game_id: id(11), game_name: 'Bé chinh phục bàn phím', game_code: 'keyboard_quest', config: {} },
];
const classroom = { class_id: id(20), name: 'Lớp thử', archived_at: null };
try {
  await new Promise((r) => setTimeout(r, 1200));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors = [],
      writes = [];
    let failGift = true,
      failReset = true,
      boardMode = 'results';
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        params = new URL(req.url()).searchParams,
        action = body?.action || params.get('action');
      let json = {};
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: { user_id: id(99), role: 'admin', full_name: 'Giáo viên thử' },
          games,
          classes: [classroom],
        };
      if (action === 'students_page') json = studentPage(students, params);
      if (action === 'students') json = { students };
      if (action === 'classes') json = { classes: [classroom] };
      if (action === 'stars') json = { stars: 7 };
      if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
      if (action === 'history') json = { history: [] };
      if (action === 'classroom') json = { classroom, members: [], posts: [] };
      if (action === 'class_stars') {
        if (boardMode === 'error')
          return route.fulfill({ status: 503, json: { error: 'Không tải được thành tích thử.' } });
        json = {
          memberCount: boardMode === 'empty' ? 0 : 1,
          lessons:
            boardMode === 'results'
              ? [
                  {
                    user_id: id(1),
                    name: 'Học sinh thử',
                    animal: 'icon_01',
                    stars: 3,
                    completed: 1,
                  },
                ]
              : [],
          weekly: [],
          weekStart: '2026-11-09',
          currentWeek: '2026-11-09',
        };
      }
      if (['star_gift', 'student_reset'].includes(action)) {
        writes.push(body);
        await new Promise((r) => setTimeout(r, 150));
        if (action === 'star_gift' && failGift) {
          failGift = false;
          return route.fulfill({ status: 503, json: { error: 'Thử lại cùng yêu cầu.' } });
        }
        if (action === 'student_reset' && failReset) {
          failReset = false;
          return route.fulfill({ status: 503, json: { error: 'Thử lại cùng yêu cầu.' } });
        }
        json = {
          data: {
            completed: true,
            amount: 7,
            stars: 7,
            revokedStars: 3,
            removedPlays: 2,
            lifetimeSeconds: 120,
          },
        };
      }
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:4196/admin');
    await page.getByRole('button', { name: 'Tặng sao', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Số sao', { exact: true }).fill('0');
    assert.ok(await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).isDisabled());
    await dialog.getByLabel('Số sao', { exact: true }).fill('7');
    await dialog.getByLabel('Lời nhắn (không bắt buộc)', { exact: true }).fill('Cố lên nhé!');
    await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    await dialog.getByRole('button', { name: 'Tặng sao', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes[0].requestId, writes[1].requestId);
    assert.equal(writes[1].message, 'Cố lên nhé!');
    await page.getByRole('button', { name: 'Lịch sử chơi', exact: true }).click();
    await page.locator('.student-history select').first().selectOption(id(1));
    await page.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).click();
    assert.match(await dialog.innerText(), /Giữ nguyên tổng thời gian luyện tích lũy/);
    const confirmation = dialog.getByLabel('Gõ chính xác accept để xác nhận', { exact: true });
    await confirmation.fill('Accept');
    assert.ok(
      await dialog.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).isDisabled(),
    );
    await confirmation.fill('accept');
    await dialog.locator('select').selectOption(id(11));
    assert.equal(await confirmation.inputValue(), '');
    await confirmation.fill('accept');
    await dialog.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 901);
    await dialog.locator('.tipy-modal-body').evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    const confirmBounds = await dialog
      .getByRole('button', { name: 'Làm lại từ đầu', exact: true })
      .boundingBox();
    assert.ok(
      confirmBounds.y + confirmBounds.height <= bounds.y + bounds.height,
      'last action remains reachable without clipping',
    );
    await page.screenshot({ path: `test-results/student-actions-${width}.png` });
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await dialog.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const resets = writes.filter((w) => w.action === 'student_reset');
    assert.equal(resets.length, 2);
    assert.equal(resets[0].requestId, resets[1].requestId);
    assert.equal(resets[1].gameId, id(11));
    assert.equal(writes.length, 4);
    await page.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.goto('http://127.0.0.1:4196/#classroom');
    await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
    assert.match(await dialog.innerText(), /sao thầy cô tặng/);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.locator('.class-top-list').waitFor();
    assert.doesNotMatch(
      await page.locator('.class-achievements').innerText(),
      /hard-v1|múi giờ|Kết quả tốt nhất/,
    );
    for (const mode of ['empty', 'no-results', 'error']) {
      boardMode = mode;
      await page.reload();
      await page
        .getByText(
          mode === 'empty'
            ? 'Chưa có học sinh'
            : mode === 'no-results'
              ? 'Chưa có thành tích'
              : 'Không tải được thành tích thử.',
          { exact: mode !== 'error' },
        )
        .waitFor();
      if (mode === 'error')
        assert.equal(await page.getByText('Chưa có thành tích', { exact: true }).count(), 0);
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        giftRetry: true,
        resetAcceptScopeRetry: true,
        guideClose: true,
        boardStates: true,
        responsive: true,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
