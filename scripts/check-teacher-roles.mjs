/** Isolated Auth/SQL fixtures through the real HTTP dispatcher; never writes production. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { id } from '../tests/teacher-fixture.js';
import { hubFixture } from '../tests/hub-fixture.js';
import { createHandler } from '../api/tipy.js';
import { ApiError } from '../server/errors.js';
import { createStars } from '../server/modules/stars.js';
import { createStudents } from '../server/modules/students.js';
import { createClassrooms } from '../server/modules/classrooms.js';
const f = await hubFixture(),
  origin = 'http://127.0.0.1:4196';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4196'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/teachers', { recursive: true });
const calls = [],
  errors = [];
let actor = 99;
const classes = async (profile) =>
  (
    await f.db.query(
      "select c.* from classes c where $1='admin' or tipy_manages_class($2,c.class_id) order by c.name",
      [profile.role, profile.user_id],
    )
  ).rows;
const access = async (profile, classId) => {
  const r = await f.rpc('tipy_class_access', { p_actor: profile.user_id, p_class: classId });
  if (r.error) throw new ApiError(403, 'Bạn không được phân công lớp này.');
  return r.data;
};
const posts = async (classId) =>
  (
    await f.db.query(
      "select p.*,jsonb_build_object('full_name',a.full_name,'role',a.role) author,'[]'::jsonb class_attachments from class_posts p join profiles a on a.user_id=p.author_id where p.class_id=$1 and p.archived_at is null order by p.created_at desc",
      [classId],
    )
  ).rows;
const backend = {
  ...f.assessments,
  ...f.teachers,
  ...createStars(f.dbClient),
  classroomHub: createClassrooms(f.dbClient).classroomHub,
  ...createStudents(f.dbClient),
  session: async () => {
    const profile = await f.people(actor);
    if (!profile?.is_active) throw new ApiError(403, 'Tài khoản đang được khóa.');
    return { profile };
  },
  games: async () => [],
  classes,
  avatar: async () => ({ animal: 'icon_01' }),
  async classroom(profile, { classId }) {
    const classroom = await access(profile, classId);
    const members = (
      await f.db.query(
        "select p.user_id,p.username,p.full_name name,'{\"animal\":\"icon_01\"}'::jsonb avatar,0 total_active_seconds, (tipy_star_total(p.user_id)->>'stars')::int stars from profiles p join class_members m using(user_id) where m.class_id=$1 and m.is_active and p.role='student' and p.is_active order by p.user_id",
        [classId],
      )
    ).rows;
    return { classroom, members, canManage: true, posts: await posts(classId) };
  },
  async classPosts(profile, { classId }) {
    await access(profile, classId);
    return { posts: await posts(classId) };
  },
  classPost: createClassrooms(f.dbClient).classPost,
  postArchive: createClassrooms(f.dbClient).postArchive,
};
const handler = createHandler({
  env: {
    APP_ORIGIN: origin,
    NODE_ENV: 'development',
    SUPABASE_URL: 'https://fixture.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture',
    TIPY_AUTH_SECRET: 'fixture-secret-'.repeat(3),
  },
  makeBackend: () => backend,
});
try {
  await new Promise((r) => setTimeout(r, 1000));
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/tipy*', async (route) => {
    const req = route.request(),
      body = req.postDataJSON(),
      query = Object.fromEntries(new URL(req.url()).searchParams),
      action = body?.action || query.action;
    calls.push({ actor, action, method: req.method() });
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
        json(r) {
          json = r;
        },
      },
    );
    await route.fulfill({ status, json });
  });
  await page.goto(origin + '/admin');
  await page.getByRole('button', { name: 'Giáo viên', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo giáo viên', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const before = calls.filter((r) => r.method === 'POST').length;
  await page.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click();
  assert.equal(calls.filter((r) => r.method === 'POST').length, before, 'invalid form writes zero');
  await page.getByLabel('Họ tên', { exact: true }).fill('Cô Lan thử');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('co.lan.browser');
  await page.getByLabel('Mật khẩu / PIN', { exact: true }).fill('1');
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Lớp thử', exact: true }).check();
  await page.screenshot({ path: 'test-results/teachers/create-mobile.png' });
  await page.getByRole('button', { name: 'Lưu giáo viên', exact: true }).evaluate((e) => {
    e.click();
    e.click();
  });
  await page
    .getByRole('status')
    .getByText('Đã lưu giáo viên và lớp được phân công.', { exact: true })
    .waitFor();
  assert.equal(calls.filter((r) => r.action === 'teacher_create').length, 1);
  await page.screenshot({ path: 'test-results/teachers/admin.png', fullPage: true });
  const createdRow = page.locator('tbody tr').filter({ hasText: 'co.lan.browser' });
  await createdRow.getByRole('button').click();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Lớp thử', exact: true }).uncheck();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Lớp B', exact: true }).check();
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: 'Cho phép đăng nhập', exact: true })
    .uncheck();
  await page.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click();
  await createdRow.getByText('Đã khóa', { exact: true }).waitFor();
  assert.ok((await createdRow.innerText()).includes('Lớp B'));
  await createdRow.getByRole('button').click();
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: 'Cho phép đăng nhập', exact: true })
    .check();
  await page.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click();
  await createdRow.getByText('Đang hoạt động', { exact: true }).waitFor();
  assert.equal(calls.filter((r) => r.action === 'teacher_save').length, 2);
  await page.setViewportSize({ width: 1440, height: 900 });
  actor = 30;
  await page.goto(origin + '/#classroom');
  await page.reload();
  await page.locator('.hub-member-grid').waitFor();
  assert.equal(await page.locator('.classroom-hub').count(), 1);
  assert.equal(
    await page.locator('.main-nav').getByRole('button', { name: 'Gõ chữ', exact: true }).count(),
    0,
  );
  await page.locator('.hub-class-picker button').click();
  assert.equal(await page.getByRole('menuitem').count(), 1);
  await page.keyboard.press('Escape');
  const menuCount = calls.length;
  await page.getByRole('button', { name: /Tùy chọn: Học sinh thử 1/ }).click();
  assert.equal(calls.length, menuCount, 'cached avatar menu sends zero requests');
  assert.equal(await page.getByRole('menuitem', { name: 'Trừ sao', exact: true }).count(), 1);
  await page.getByRole('menuitem', { name: 'Cộng sao', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Số lượng', { exact: true }).fill('5');
  const giftCount = calls.filter((r) => r.action === 'star_gift').length;
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cộng sao', exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(calls.filter((r) => r.action === 'star_gift').length, giftCount + 1);
  await page
    .locator('.hub-overview-nav')
    .getByRole('button', { name: 'Tin nhắn', exact: true })
    .click();
  await page.getByRole('button', { name: 'Gửi bài', exact: true }).click();
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Bài của giáo viên A');
  await page.getByLabel('Nội dung', { exact: true }).fill('Cùng học vui!');
  const editorReads = calls.filter((c) => c.action === 'classroom_hub').length;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  assert.equal(
    await page.getByLabel('Tiêu đề', { exact: true }).inputValue(),
    'Bài của giáo viên A',
  );
  assert.equal(
    calls.filter((c) => c.action === 'classroom_hub').length,
    editorReads,
    'teacher focus keeps editor mounted',
  );
  await page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true }).click();
  await page.getByRole('heading', { name: 'Bài của giáo viên A', exact: true }).waitFor();
  await page.locator('.hub-tabs').getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click();
  await page.getByLabel('Tên bài kiểm tra', { exact: true }).fill('Bài cô A thử');
  await page.getByRole('checkbox', { name: 'Lớp thử', exact: true }).check();
  await page.getByLabel('Tìm học sinh nhận riêng', { exact: true }).fill('student8');
  await page.getByText('Không có học sinh phù hợp', { exact: false }).waitFor();
  await page.screenshot({ path: 'test-results/teachers/teacher-tests.png', fullPage: true });
  await page.goto(origin + '/#classroom');
  await page.reload();
  await page.locator('.hub-member-grid').waitFor();
  const denied = await page.evaluate(
    async ({ classId, userId }) => {
      const get = await fetch('/api/tipy?' + new URLSearchParams({ action: 'classroom', classId }));
      const gift = await fetch('/api/tipy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'star_gift',
          classId,
          userId,
          amount: 1,
          requestId: crypto.randomUUID(),
        }),
      });
      return [get.status, gift.status];
    },
    { classId: id(51), userId: id(8) },
  );
  assert.deepEqual(denied, [403, 403]);
  await f.adminRpc('save', { userId: id(30), classIds: [], active: true });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByText('Bạn chưa được phân công lớp.', { exact: true }).waitFor();
  assert.equal(await page.locator('.hub-member-grid').count(), 0);
  actor = 31;
  await page.evaluate(() => window.dispatchEvent(new Event('tipy-session-changed')));
  await page.locator('.hub-member-grid').waitFor();
  assert.match(await page.locator('.hub-class-picker').textContent(), /Lớp B/);
  assert.equal(await page.getByText('Bài của giáo viên A', { exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/teachers/teacher-mobile.png', fullPage: true });
  await f.adminRpc('save', { userId: id(31), classIds: [id(51)], active: false });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Tài khoản · Đăng nhập', exact: true }).waitFor();
  assert.equal(await page.locator('.hub-member-grid').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      adminCreatesOnly: true,
      createWrites: 1,
      teacherSaveWrites: 2,
      invalidWrites: 0,
      menuRequests: 0,
      giftWrites: 1,
      crossClassDenied: denied,
      revocation: true,
      locked: true,
      sameBrowserSwitch: true,
      errors,
    }),
  );
} finally {
  await browser.close();
  server.kill();
  await f.db.close();
}
