/** Browser -> actual API dispatcher -> isolated SQL migration. Auth/Storage are fixtures. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { hubFixture } from '../tests/hub-fixture.js';
import { id } from '../tests/teacher-fixture.js';
import { createHandler } from '../api/tipy.js';
import { createClassrooms } from '../server/modules/classrooms.js';
import { createStars } from '../server/modules/stars.js';
import { ApiError } from '../server/errors.js';
const f = await hubFixture(),
  origin = 'http://127.0.0.1:4197';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4197'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/classroom-hub', { recursive: true });
let actor = 30,
  failUpload = false,
  losePost = false,
  delayHub = false;
const calls = [],
  errors = [],
  metrics = {};
const rooms = createClassrooms(f.dbClient),
  stars = createStars(f.dbClient);
const classes = async (p) =>
  (
    await f.db.query(
      "select c.* from classes c where c.archived_at is null and ($1='admin' or tipy_manages_class($2,c.class_id) or ($1='student' and exists(select 1 from class_members m where m.class_id=c.class_id and m.user_id=$2 and m.is_active))) order by c.name",
      [p.role, p.user_id],
    )
  ).rows;
const backend = {
  ...rooms,
  ...stars,
  ...f.assessments,
  ...f.notifications,
  session: async () => ({ profile: await f.people(actor) }),
  games: async () => [],
  classes,
  avatar: async () => ({ animal: 'icon_01' }),
  async classPosts(p, { classId, offset = 0 }) {
    await rooms.classroomHub(p, { classId });
    return {
      posts: (
        await f.db.query(
          "select p.*,jsonb_build_object('full_name',a.full_name,'role',a.role) author,coalesce((select jsonb_agg(jsonb_build_object('attachment_id',attachment_id,'name',name,'mime_type',mime_type,'size_bytes',size_bytes)) from class_attachments f where f.post_id=p.post_id),'[]') class_attachments from class_posts p join profiles a on a.user_id=p.author_id where p.class_id=$1 and p.archived_at is null order by p.created_at desc limit 20 offset $2",
          [classId, offset],
        )
      ).rows,
    };
  },
  async classUpload(p, input) {
    await rooms.classroomHub(p, { classId: input.classId });
    const fileId = crypto.randomUUID();
    await f.db.query(
      'insert into class_attachments(attachment_id,class_id,uploaded_by,storage_path,name,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7)',
      [
        fileId,
        input.classId,
        p.user_id,
        `${input.classId}/${fileId}`,
        input.name,
        input.mime,
        input.size,
      ],
    );
    return { attachmentId: fileId, signedUrl: origin + '/fixture-upload/' + fileId };
  },
  async classFile(p, { attachmentId }) {
    const row = await f.q('select * from class_attachments where attachment_id=$1', [attachmentId]);
    await rooms.classroomHub(p, { classId: row.class_id });
    return { url: origin + '/fixture-download/' + attachmentId };
  },
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
const postCount = (action) =>
  calls.filter((c) => c.method === 'POST' && (!action || c.action === action)).length;
try {
  await new Promise((r) => setTimeout(r, 900));
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/notification-events', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: unavailable\ndata: {}\n\n',
    }),
  );
  await page.route('**/fixture-upload/**', async (r) => {
    calls.push({ action: 'upload', method: 'PUT' });
    if (!failUpload) {
      const fileId = new URL(r.request().url()).pathname.split('/').at(-1);
      await f.db.query(
        "insert into storage.objects(bucket_id,name) select 'tipy-classroom',storage_path from class_attachments where attachment_id=$1 on conflict do nothing",
        [fileId],
      );
    }
    return r.fulfill({ status: failUpload ? 500 : 200, body: '' });
  });
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
    if (action === 'class_post' && losePost) {
      losePost = false;
      return route.abort('failed');
    }
    if (action === 'classroom_hub' && query.classId === id(50) && delayHub)
      await new Promise((r) => setTimeout(r, 450));
    await route.fulfill({ status, json });
  });
  await f.db.query('update profiles set full_name=$2 where user_id=$1', [id(5), 'Nguyễn Văn An']);
  await f.db.query('update profiles set full_name=$2 where user_id=$1', [id(6), 'Trần Thị An']);
  await page.goto(origin + '/classroom');
  await page.locator('.hub-member-grid li').first().waitFor();
  assert.equal(await page.locator('.hub-member-grid b').filter({ hasText: /^An$/ }).count(), 2);
  const idleStart = calls.length;
  await page.waitForTimeout(700);
  metrics.idleRequests = calls.length - idleStart;
  assert.equal(metrics.idleRequests, 0);
  metrics.openClass = calls.filter((c) => c.action === 'classroom_hub').length;
  assert.equal(metrics.openClass, 1);
  await page.locator('.hub-toolbar').getByRole('button', { name: 'Trở về', exact: true }).click();
  await page.getByRole('heading', { name: 'Góc giáo viên', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Gõ chữ', exact: true }).count(), 0);
  await page
    .locator('.classroom-page')
    .getByRole('button', { name: 'Lớp của tôi', exact: true })
    .click();
  await page.locator('.hub-member-grid li').first().waitFor();
  assert.equal(
    calls.filter((c) => ['class_posts', 'assessments', 'class_notifications'].includes(c.action))
      .length,
    0,
  );
  const avatar = () =>
    page
      .locator('.hub-member-grid li')
      .filter({ has: page.locator('button[aria-label*="Học sinh thử 1"]') })
      .getByRole('button');
  const before = calls.length;
  await avatar().click();
  await page.getByRole('menu').waitFor();
  await page.keyboard.press('Escape');
  await avatar().click();
  await page.locator('.hub-toolbar h1').click();
  metrics.menuRequests = calls.length - before;
  assert.equal(metrics.menuRequests, 0);
  await avatar().click();
  await page.getByRole('menuitem', { name: 'Cộng sao', exact: true }).click();
  await page.getByLabel('Số lượng', { exact: true }).fill('5');
  const startStars = (await f.total()).stars,
    writes = postCount();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cộng sao', exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(postCount() - writes, 1);
  assert.equal((await f.total()).stars, startStars + 5);
  metrics.giftWrites = 1;
  await avatar().click();
  await page.getByRole('menuitem', { name: 'Trừ sao', exact: true }).click();
  await page.getByLabel('Số lượng', { exact: true }).fill('99999');
  const invalid = postCount();
  assert.equal(
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Trừ sao', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(postCount(), invalid);
  await page.getByLabel('Số lượng', { exact: true }).fill('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Trừ sao', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  metrics.deductWrites = postCount() - invalid;
  assert.equal(metrics.deductWrites, 1);
  const afterGiftReads = calls.filter((c) => c.action === 'classroom_hub').length;
  await page.locator('.hub-toolbar').getByRole('button', { name: 'Trở về', exact: true }).click();
  await page
    .locator('.classroom-page')
    .getByRole('button', { name: 'Lớp của tôi', exact: true })
    .click();
  await page.locator('.hub-member-grid li').first().waitFor();
  metrics.reopenAfterGiftReads =
    calls.filter((c) => c.action === 'classroom_hub').length - afterGiftReads;
  assert.equal(metrics.reopenAfterGiftReads, 0);
  const view = async (name) => {
    await page
      .locator('.hub-overview-nav:visible,.hub-tabs:visible')
      .getByRole('button', { name, exact: true })
      .click();
  };
  await view('Tin nhắn');
  await page.getByText('Chưa có tin nhắn trong lớp.', { exact: true }).waitFor();
  const readPosts = calls.filter((c) => c.action === 'class_posts').length;
  await view('Thành viên');
  await view('Tin nhắn');
  assert.equal(calls.filter((c) => c.action === 'class_posts').length, readPosts);
  metrics.reopenTabReads = 0;
  await page.getByRole('button', { name: 'Gửi bài', exact: true }).click();
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Bài kiểm tra giao diện');
  await page.locator('.composer-form [name=body]').fill('Nội dung phải được giữ.');
  await page.getByLabel('Link bài học', { exact: true }).fill('https://example.com/lesson');
  const beforeFile = postCount();
  await page.locator('input[type=file]').setInputFiles({
    name: 'anh.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.locator('.preview-image img').waitFor();
  await page.locator('input[type=file]').setInputFiles([]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  assert.equal(
    await page.getByLabel('Tiêu đề', { exact: true }).inputValue(),
    'Bài kiểm tra giao diện',
  );
  metrics.selectFileWrites = postCount() - beforeFile;
  assert.equal(metrics.selectFileWrites, 0);
  failUpload = true;
  await page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true }).click();
  await page.getByText('Tải file chưa xong. Bạn thử lại nhé.', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Tiêu đề', { exact: true }).inputValue(),
    'Bài kiểm tra giao diện',
  );
  failUpload = false;
  losePost = true;
  await page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true }).click();
  await page.locator('.class-composer > p[role=alert]').waitFor();
  await page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true }).click();
  await page.locator('.class-post h3').filter({ hasText: 'Bài kiểm tra giao diện' }).waitFor();
  assert.equal((await f.q('select count(*)::int n from class_posts')).n, 1);
  const draft = await f.assessments.assessmentSave(await f.people(30), {
    assessmentId: id(750),
    requestId: id(751),
    version: 0,
    title: 'Bài nháp gửi từ lớp',
    targets: { classIds: [id(50)], userIds: [] },
    selection: { questIds: ['keys-as-1'], falling: null },
    schedule: { mode: 'always' },
    repeats: { mode: 'limited', extra: 1 },
  });
  await page.getByRole('button', { name: 'Giao kiểm tra', exact: true }).click();
  await page.getByLabel('Chọn bản nháp').selectOption(id(750));
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Gửi bài kiểm tra', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page
    .locator('.admin-assessments .assessment-list-item')
    .filter({ hasText: 'Bài nháp gửi từ lớp' })
    .waitFor();
  const testRow = page
    .locator('.admin-assessments .assessment-list-item')
    .filter({ hasText: 'Bài nháp gửi từ lớp' });
  await testRow.getByRole('button', { name: 'Ẩn', exact: true }).click();
  await testRow.getByText('Đã ẩn', { exact: false }).waitFor();
  await testRow.getByRole('button', { name: 'Hiện', exact: true }).click();
  await testRow.getByText('Đang mở', { exact: false }).waitFor();
  await page.screenshot({ path: 'test-results/classroom-hub/teacher-tests.png' });
  await view('Thành viên');
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [844, 390],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(80);
    const geometry = await page.evaluate(() => {
      const hub = document.querySelector('.classroom-hub').getBoundingClientRect(),
        roster = document.querySelector('.hub-members .hub-scroll');
      return {
        width: innerWidth,
        height: innerHeight,
        hub: { x: hub.x, y: hub.y, right: hub.right, bottom: hub.bottom },
        pageScroll: document.documentElement.scrollHeight,
        scrollable: roster.scrollHeight > roster.clientHeight,
        podiumHeight: [
          document.querySelector('.hub-podium').clientHeight,
          document.querySelector('.hub-podium').scrollHeight,
        ],
        podiumParts: [...document.querySelector('.hub-podium').children].map((e) => ({
          tag: e.tagName,
          h: e.getBoundingClientRect().height,
          scroll: e.scrollHeight,
        })),
        podiumFits:
          document.querySelector('.hub-podium').scrollHeight <=
          document.querySelector('.hub-podium').clientHeight + 1,
        avatarVisible:
          document.querySelector('.hub-member-grid .student-avatar').getBoundingClientRect()
            .bottom <=
          roster.getBoundingClientRect().bottom + 1,
        toolbarFits:
          document.querySelector('.hub-class-picker').getBoundingClientRect().right <=
          innerWidth + 1,
      };
    });
    assert.ok(
      geometry.hub.right <= width + 1 &&
        geometry.hub.bottom <= height + 1 &&
        geometry.hub.x >= 0 &&
        geometry.hub.y >= 0,
      JSON.stringify(geometry),
    );
    assert.ok(
      geometry.avatarVisible && geometry.toolbarFits && geometry.podiumFits,
      JSON.stringify(geometry),
    );
    await page.screenshot({ path: `test-results/classroom-hub/overview-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await avatar().click();
  await page.getByRole('menuitem', { name: 'Loại', exact: true }).click();
  await page.getByLabel('Nhập chính xác accept để loại').fill('Accept');
  const removeBefore = postCount();
  assert.equal(
    await page.getByRole('dialog').getByRole('button', { name: 'Loại', exact: true }).isDisabled(),
    true,
  );
  metrics.invalidAcceptWrites = postCount() - removeBefore;
  await page.getByLabel('Nhập chính xác accept để loại').fill('accept');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Loại', exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(postCount() - removeBefore, 1);
  metrics.removeWrites = 1;
  // New student retains prior posts; a removed student loses class API access.
  actor = 2;
  await page.goto(origin + '/classroom');
  await page.locator('.hub-member-grid li').first().waitFor();
  await view('Tin nhắn');
  await page.locator('.class-post h3').waitFor();
  await page.screenshot({ path: 'test-results/classroom-hub/student-messages.png' });
  await view('Thông báo');
  await page.locator('.notification-list li').first().waitFor();
  await page.screenshot({ path: 'test-results/classroom-hub/student-notifications.png' });
  assert.equal(
    (
      await handlerRequest('star_deduct', {
        classId: id(50),
        userId: id(2),
        amount: 1,
        requestId: crypto.randomUUID(),
      })
    ).status,
    403,
  );
  actor = 31;
  assert.equal(
    (
      await handlerRequest('class_remove_member', {
        classId: id(50),
        userId: id(2),
        confirm: 'accept',
        requestId: crypto.randomUUID(),
      })
    ).status,
    403,
  );
  actor = 99;
  await page.goto(origin + '/classroom');
  await page.locator('.hub-member-grid li').first().waitFor();
  const beforeNewClass = calls.filter((c) => c.action === 'classroom_hub').length;
  await page.locator('.hub-class-picker button').click();
  await page.getByRole('menuitem', { name: 'Lớp thử', exact: true }).click();
  await page.getByRole('button', { name: /Tùy chọn: Học sinh thử 2/ }).waitFor();
  metrics.newClassReads = calls.filter((c) => c.action === 'classroom_hub').length - beforeNewClass;
  assert.equal(metrics.newClassReads, 1);
  const beforeSwitch = calls.filter((c) => c.action === 'classroom_hub').length;
  await page.locator('.hub-class-picker button').click();
  await page.getByRole('menuitem', { name: 'Lớp B', exact: true }).click();
  await page.locator('.hub-class-picker button').filter({ hasText: 'Lớp B' }).waitFor();
  await page.locator('.hub-member-grid li').first().waitFor();
  metrics.switchClassReads =
    calls.filter((c) => c.action === 'classroom_hub').length - beforeSwitch;
  assert.equal(metrics.switchClassReads, 0);
  // Many members, duplicate short names and a teacher assigned to multiple classes.
  await f.adminRpc('save', { userId: id(30), classIds: [id(50), id(51)], active: true });
  for (let n = 800; n < 823; n++) {
    await f.db.query('insert into auth.users values($1,$2,$3)', [
      id(n),
      { username: 'browser' + n, full_name: 'Bạn thử ' + n },
      {},
    ]);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(n)]);
  }
  actor = 30;
  await page.goto(origin + '/classroom?class=' + id(50));
  await page.locator('.hub-member-grid li').nth(23).waitFor({ state: 'attached' });
  assert.equal(await page.locator('.hub-member-grid li').count(), 24);
  await page.locator('.hub-class-picker button').click();
  assert.equal(await page.getByRole('menuitem').count(), 2);
  await page.keyboard.press('Escape');
  const last = page.locator('.hub-member-grid li').last().getByRole('button');
  await last.scrollIntoViewIfNeeded();
  const lastBefore = calls.length;
  await last.click();
  await page.getByRole('menu').waitFor();
  const box = await page.getByRole('menu').boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 844 + 1);
  assert.equal(calls.length, lastBefore);
  metrics.lastRowMenuRequests = 0;
  await page.screenshot({ path: 'test-results/classroom-hub/last-member-menu.png' });
  await page.keyboard.press('Escape');
  await page.locator('.hub-members').getByRole('button', { name: 'Sau', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.hub-member-grid li').length === 5);
  // Responses from the previous class cannot replace the current one.
  actor = 99;
  await page.goto(origin + '/classroom?class=' + id(51));
  await page.locator('.hub-member-grid li').first().waitFor();
  delayHub = true;
  await page.locator('.hub-class-picker button').click();
  await page.getByRole('menuitem', { name: 'Lớp thử', exact: true }).click();
  await page.locator('.hub-class-picker button').click();
  await page.getByRole('menuitem', { name: 'Lớp B', exact: true }).click();
  await page.waitForTimeout(550);
  delayHub = false;
  assert.equal(await page.locator('.hub-member-grid li').count(), 1);
  assert.match(await page.locator('.hub-class-picker').textContent(), /Lớp B/);
  metrics.staleResponseIgnored = true;
  await f.db.query("insert into classes(class_id,name,created_by) values($1,'Lớp trống',$2)", [
    id(53),
    id(99),
  ]);
  await page.goto(origin + '/classroom?class=' + id(53));
  await page.getByText('Lớp chưa có học sinh.', { exact: true }).waitFor();
  await page.getByText('Chưa có thành viên để xếp hạng.', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/classroom-hub/empty-class.png' });
  assert.deepEqual(errors, []);
  writeFileSync(
    'test-results/classroom-hub/network.json',
    JSON.stringify({ metrics, calls }, null, 2),
  );
  console.log(JSON.stringify({ metrics, errors }, null, 2));
  async function handlerRequest(action, input) {
    let status = 200,
      body;
    await handler(
      {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: { action, ...input },
      },
      {
        setHeader() {},
        status(n) {
          status = n;
          return this;
        },
        json(r) {
          body = r;
        },
      },
    );
    return { status, body };
  }
} finally {
  await browser.close();
  server.kill();
  await f.db.close();
}
