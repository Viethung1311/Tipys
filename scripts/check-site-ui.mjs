/** Whole-site visual and interaction checks; API responses are isolated fixtures. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { LEVELS } from '../src/game/config.js';
const directory = process.env.TIPY_SCREENSHOTS || 'test-results/site-ui';
function contrast(a, b) {
  const light = (value) => {
    const rgb = value
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = light(a),
    y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
mkdirSync(directory, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4182'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const id = '11111111-1111-4111-8111-111111111111',
  secondId = '22222222-2222-4222-8222-222222222222',
  classId = '33333333-3333-4333-8333-333333333333';
const student = {
  user_id: id,
  username: 'an',
  full_name: 'Nguyễn Thị Bình An',
  role: 'student',
  is_active: true,
  total_active_seconds: 65,
  total_plays: 3,
};
const admin = {
  user_id: '44444444-4444-4444-8444-444444444444',
  username: 'admin',
  full_name: 'Giáo viên TIPY',
  role: 'admin',
};
const students = [
  student,
  { ...student, user_id: secondId, username: 'binh', full_name: 'Trần Minh Bình' },
];
const games = [
  {
    game_id: 'fall',
    game_code: 'falling_letters',
    engine_code: 'falling_letters',
    game_name: 'Chữ rơi',
    is_active: true,
    config: { levels: LEVELS },
  },
  {
    game_id: 'quest',
    game_code: 'keyboard_quest',
    engine_code: 'keyboard_quest',
    game_name: 'Bé chinh phục bàn phím',
    is_active: true,
  },
];
try {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    let user = student,
      classes = [{ class_id: classId, name: 'STEM Cẩm Lệ' }],
      avatar = 'icon_05',
      historyError = false,
      emptyGames = false;
    const members = new Map([[classId, new Set([id])]]),
      writes = [],
      errors = [];
    let screens = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/tipy*', async (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        params = new URL(request.url()).searchParams,
        action = body?.action || params.get('action');
      let json = {};
      if (body) writes.push(action);
      if (action === 'bootstrap')
        json = { configured: true, user, games: emptyGames ? [] : games, classes };
      if (action === 'points') json = { points: 150 };
      if (action === 'avatar')
        json = { avatar: { animal: avatar, accessory: 'none', color: 'sun' } };
      if (action === 'avatar_save') {
        avatar = body.animal;
        json = { data: body };
      }
      if (action === 'logout') user = null;
      if (action === 'login') {
        user = student;
        json = { user };
      }
      if (action === 'students') json = { students };
      if (action === 'quest_progress') json = { progress: [] };
      if (action === 'quest_class_report') json = { students: [] };
      if (action === 'start') json = { data: { play_id: '66666666-6666-4666-8666-666666666666' } };
      if (action === 'progress') json = { data: {} };
      if (action === 'classroom')
        json = {
          classroom: classes[0],
          members: students.map((s) => ({
            user_id: s.user_id,
            name: s.full_name,
            avatar: { animal: 'icon_05' },
          })),
          achievements: [
            {
              user_id: id,
              name: student.full_name,
              best_score: 150,
              rank: 1,
              total_active_seconds: 65,
              avatar: { animal: 'icon_05' },
            },
          ],
          posts: [
            {
              post_id: 'p',
              title: 'Bài học vui nhộn',
              body: 'Cùng luyện gõ và khám phá Scratch nhé!',
              created_at: '2026-11-10T00:00:00Z',
              class_attachments: [],
              link: 'https://example.com',
            },
          ],
        };
      if (action === 'classes') json = { classes };
      if (action === 'class_roster')
        json = { userIds: [...(members.get(params.get('classId')) || [])] };
      if (action === 'class_members') {
        const selected = members.get(body.classId) || new Set();
        for (const member of body.userIds)
          body.active ? selected.add(member) : selected.delete(member);
        members.set(body.classId, selected);
        json = { data: { userIds: body.userIds } };
      }
      if (action === 'class_save') {
        const added = { class_id: '55555555-5555-4555-8555-555555555555', name: body.name };
        classes = [...classes, added];
        members.set(added.class_id, new Set());
        json = { data: added };
      }
      if (action === 'history') {
        if (historyError)
          return route.fulfill({
            status: 503,
            json: { error: 'Chưa tải được kết quả. Thử lại nhé.' },
          });
        await new Promise((resolve) => setTimeout(resolve, 100));
        json = {
          history:
            params.get('userId') === secondId
              ? []
              : [
                  {
                    user_id: id,
                    game_id: 'fall',
                    profiles: { full_name: student.full_name },
                    games: { game_name: 'Chữ rơi' },
                    result_type: 'best_recent',
                    score: 150,
                    active_seconds: 35,
                    total_active_seconds: 65,
                    total_plays: 3,
                    result: 'quit',
                    started_at: '2026-11-10T00:00:00Z',
                  },
                ],
        };
      }
      await route.fulfill({ json });
    });
    const check = async (name) => {
      screens++;
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${directory}/${width}-${name}.png` });
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width && (r.right > innerWidth + 1 || r.left < -1);
          })
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            text: e.textContent.slice(0, 60),
            width: e.getBoundingClientRect().width,
          })),
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        name + ' page overflows: ' + JSON.stringify(overflow),
      );
      const fonts = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      assert.ok(fonts.includes('TIPY Nunito'), name + ' shared font');
      assert.deepEqual(errors, [], name + ' console');
    };
    const nav = (name) =>
      page
        .getByRole('navigation', { name: 'Điều hướng chính' })
        .getByRole('button', { name, exact: true });
    await page.goto('http://127.0.0.1:4182');
    await nav('Lớp học').waitFor();
    await page.locator('.loading-fullscreen').waitFor({ state: 'hidden' });
    await check('home');
    await nav('Gõ chữ').focus();
    assert.equal(await nav('Gõ chữ').evaluate((e) => getComputedStyle(e).outlineWidth), '3px');
    await page.getByRole('button', { name: 'Chơi ngay', exact: true }).hover();
    const primary = await page
      .getByRole('button', { name: 'Chơi ngay', exact: true })
      .evaluate((e) => {
        const s = getComputedStyle(e);
        return [s.color, s.backgroundColor];
      });
    assert.ok(contrast(...primary) >= 4.5, 'primary hover text contrast');
    await nav('Gõ chữ').click();
    await page.locator('.game-card').last().waitFor();
    await check('library');
    await page
      .locator('.game-card')
      .filter({ hasText: 'Chữ rơi' })
      .getByRole('button', { name: 'Chơi', exact: true })
      .click();
    await page.locator('.difficulty-options').waitFor();
    await check('setup');
    await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
    await page.locator('.arena').waitFor();
    await check('playing');
    await page.waitForTimeout(3300);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor();
    await check('pause');
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    for (let n = 0; n < 6; n++) await page.keyboard.press('x');
    await page.locator('.result-score').waitFor();
    await check('game-result');
    await page.getByRole('button', { name: 'Về trang chủ', exact: true }).click();
    await nav('Gõ chữ').click();
    await page
      .locator('.game-card')
      .filter({ hasText: 'Bé chinh phục bàn phím' })
      .getByRole('button', { name: 'Chơi', exact: true })
      .click();
    await page.locator('.quest-world-grid').waitFor();
    await check('quest-map');
    await page.getByRole('button', { name: 'Làm quen bàn phím', exact: true }).click();
    await page.locator('.quest-lesson').last().waitFor();
    await check('quest-lessons');
    await page.getByRole('button', { name: 'Vào học', exact: true }).first().click();
    await page.locator('.quest-target').waitFor();
    await check('quest-key-lesson');
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await check('quest-pause');
    await page.getByRole('dialog').getByRole('button', { name: 'Bản đồ', exact: true }).click();
    await page.getByRole('button', { name: 'Tiến bộ', exact: true }).click();
    await page.locator('.quest-profile').waitFor();
    await check('quest-profile');
    await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
    await page.getByRole('button', { name: 'Phù thủy tiếng Việt', exact: true }).click();
    await page
      .locator('.quest-lesson')
      .filter({ hasText: 'Phép thuật Telex' })
      .getByRole('button', { name: 'Vào học', exact: true })
      .click();
    await page.locator('.quest-player textarea').waitFor();
    await check('quest-text-lesson');
    await nav('Lớp học').click();
    await page.locator('.class-desks').waitFor();
    await check('classroom-top');
    await page.getByRole('button', { name: 'Làm mới lớp học', exact: true }).hover();
    const secondary = await page
      .getByRole('button', { name: 'Làm mới lớp học', exact: true })
      .evaluate((e) => {
        const s = getComputedStyle(e);
        return [s.color, s.backgroundColor];
      });
    assert.ok(contrast(...secondary) >= 4.5, 'secondary hover text contrast');
    await page.locator('.account-button').click();
    await page.locator('.account-summary').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Lịch sử chơi', exact: true }).count(), 0);
    await check('account');
    await page.getByRole('button', { name: 'Nhân vật', exact: true }).click();
    await page.locator('.character-option').last().waitFor();
    await check('avatar');
    await page.getByRole('radio', { name: /Cây hoa/ }).check();
    await page.getByRole('button', { name: 'Lưu nhân vật', exact: true }).click();
    await page.getByText('Đã lưu nhân vật của bạn.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Đóng chọn nhân vật', exact: true }).click();
    assert.ok(
      (await page.locator('.avatar-button img').getAttribute('src')).endsWith('icon_36.png'),
    );
    await page.getByRole('button', { name: 'Cài đặt âm thanh', exact: true }).click();
    await page.locator('.audio-settings').waitFor();
    await check('audio');
    await page.getByRole('button', { name: 'Xong rồi', exact: true }).click();
    await page.goto('http://127.0.0.1:4182/admin');
    await page.getByText('Tài khoản hiện tại không có quyền quản trị.', { exact: true }).waitFor();
    await check('admin-denied');
    user = admin;
    await page.reload();
    await page.locator('.admin-tabs').waitFor();
    await check('admin-students');
    const adminTab = (name) =>
      page.getByRole('navigation', { name: 'Quản trị' }).getByRole('button', { name, exact: true });
    await adminTab('Lịch sử chơi').click();
    await page.getByLabel('Chọn học sinh').selectOption(id);
    await page.locator('.student-history tbody tr').waitFor();
    await check('admin-history');
    await page
      .locator('.student-history')
      .screenshot({ path: `${directory}/${width}-history-panel.png` });
    await page.getByLabel('Chọn học sinh').selectOption(secondId);
    await page.getByText('Chưa có kết quả được lưu.', { exact: true }).waitFor();
    await check('admin-history-empty');
    historyError = true;
    await page.getByRole('button', { name: 'Làm mới kết quả', exact: true }).click();
    await page.locator('.student-history [role=alert]').waitFor();
    await check('admin-history-error');
    historyError = false;
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByText('Chưa có kết quả được lưu.', { exact: true }).waitFor();
    await adminTab('Tốc độ & độ khó').click();
    await page.locator('.speed-grid').waitFor();
    await check('admin-games');
    await adminTab('Lớp học').click();
    await page.getByLabel('Chọn lớp để quản lý').selectOption(classId);
    await page.getByRole('checkbox', { name: 'Chọn Trần Minh Bình (binh)', exact: true }).waitFor();
    await check('admin-classes');
    await page.getByRole('checkbox', { name: 'Chọn Trần Minh Bình (binh)', exact: true }).check();
    await page.getByRole('button', { name: 'Thêm vào lớp (1)', exact: true }).click();
    await page.getByText('Đã thêm 1 học sinh vào lớp.', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Chọn Trần Minh Bình (binh)', exact: true }).check();
    await page.getByRole('button', { name: 'Bỏ khỏi lớp (1)', exact: true }).click();
    await page.getByText('Đã bỏ 1 học sinh khỏi lớp.', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Tên lớp mới', exact: true }).fill('STEM Mới');
    await page.getByRole('button', { name: 'Tạo lớp mới', exact: true }).click();
    await page.getByRole('textbox', { name: 'Đổi tên lớp', exact: true }).waitFor();
    assert.ok(writes.includes('class_save'));
    assert.equal(writes.filter((action) => action === 'class_members').length, 2);
    await page.goto('http://127.0.0.1:4182/#classroom');
    await page.locator('.class-composer').waitFor();
    await check('teacher-composer');
    await page.getByRole('button', { name: 'Xem tiến độ', exact: true }).click();
    await page.getByText('Lớp chưa có học sinh.', { exact: true }).waitFor();
    await check('teacher-report-empty');
    emptyGames = true;
    await page.goto('http://127.0.0.1:4182/#typing');
    await page.reload();
    await page
      .getByText('Giáo viên đang chuẩn bị trò chơi. Bạn ghé lại sau nhé!', { exact: true })
      .waitFor();
    await check('library-empty');
    user = null;
    await page.goto('http://127.0.0.1:4182/');
    await page.reload();
    await page.locator('.account-button').click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).waitFor();
    await check('login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('an');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Vào chơi nào', exact: true }).click();
    await page.locator('.account-summary').waitFor();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).waitFor();
    console.log(
      JSON.stringify({
        width,
        screens,
        adminHistory: true,
        accountLoginAndLogout: true,
        classCreateAndBulkChanges: true,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
