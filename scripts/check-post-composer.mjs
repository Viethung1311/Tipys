/** Isolated browser fixtures: never uploads or publishes to a real class. */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4193'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  await new Promise((r) => setTimeout(r, 1000));
  for (const width of process.argv.includes('--reproduce') ? [1440] : [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const calls = [],
      errors = [],
      attachments = new Map();
    let user = { user_id: 'teacher', username: 'teacher', role: 'admin' },
      posts = [],
      failUpload = false,
      loseResponse = false;
    const classroom = { class_id: 'test-class', name: 'Lớp thử' };
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/fixture-upload/**', async (route) => {
      calls.push({ action: 'upload' });
      await route.fulfill({ status: failUpload ? 500 : 200, body: '' });
    });
    await page.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        q = new URL(req.url()).searchParams,
        action = body?.action || q.get('action');
      calls.push({ action, body });
      let json = {};
      if (action === 'bootstrap')
        json = { configured: true, user, games: [], classes: [classroom] };
      if (action === 'classes') {
        await new Promise((r) => setTimeout(r, 80));
        json = { classes: [classroom] };
      }
      if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
      if (action === 'stars') json = { stars: 0 };
      if (action === 'classroom') json = { classroom, members: [], posts };
      if (action === 'class_posts') json = { posts };
      if (action === 'class_stars') json = { lessons: [], weekly: [], memberCount: 0 };
      if (action === 'quest_class_report') json = { students: [] };
      if (action === 'class_upload') {
        attachments.set(`file-${calls.length}`, {
          attachment_id: `file-${calls.length}`,
          name: body.name,
          mime_type: body.mime,
          size_bytes: body.size,
        });
        json = {
          data: {
            attachmentId: `file-${calls.length}`,
            signedUrl: `http://127.0.0.1:4193/fixture-upload/${calls.length}`,
          },
        };
      }
      if (action === 'class_post') {
        if (!posts.some((p) => p.post_id === body.requestId))
          posts.push({
            post_id: body.requestId,
            title: body.title,
            body: body.body,
            link: body.link,
            created_at: new Date().toISOString(),
            class_attachments: body.files.map((id) => attachments.get(id)),
          });
        if (loseResponse) {
          loseResponse = false;
          return route.abort('failed');
        }
        json = { postId: body.requestId };
      }
      if (action === 'class_file')
        json = { url: '/api/tipy?action=class_download&attachmentId=' + q.get('attachmentId') };
      if (action === 'class_download')
        return route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
            'base64',
          ),
        });
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:4193/#classroom');
    const title = page.locator('.class-composer input[name=title]'),
      body = page.locator('.class-composer textarea'),
      link = page.locator('.class-composer input[name=link]'),
      input = page.locator('.class-composer input[type=file]');
    await title.fill('Bản nháp thử');
    await body.fill('Nội dung cần giữ');
    await link.fill('https://example.com/lesson');
    const classReads = () =>
      calls.filter((c) => ['classes', 'classroom'].includes(c.action)).length;
    const initialClassReads = classReads();
    await page.evaluate(() => {
      window.originalTitle = document.querySelector('.class-composer input[name=title]');
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(300);
    if (process.argv.includes('--reproduce')) {
      console.log(
        JSON.stringify({
          titleAfterFocus: await title.inputValue(),
          remounted: await page.evaluate(
            () =>
              window.originalTitle !== document.querySelector('.class-composer input[name=title]'),
          ),
          navigations: await page.evaluate(() => performance.getEntriesByType('navigation').length),
          calls,
        }),
      );
      continue;
    }
    assert.equal(await title.inputValue(), 'Bản nháp thử');
    assert.equal(classReads(), initialClassReads);
    assert.equal(
      await page.evaluate(
        () => window.originalTitle === document.querySelector('.class-composer input[name=title]'),
      ),
      true,
    );
    const png = {
      name: 'anh.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=',
        'base64',
      ),
    };
    const writes = () =>
      calls.filter((c) => ['upload', 'class_upload', 'class_post'].includes(c.action)).length;
    const before = writes();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await input.setInputFiles(png);
    await page.getByAltText('Xem trước anh.png').waitFor();
    await input.dispatchEvent('cancel');
    await input.setInputFiles([]);
    assert.equal(await page.getByAltText('Xem trước anh.png').count(), 1);
    await input.setInputFiles(png);
    await page.getByRole('button', { name: 'Xóa file anh.png' }).click();
    assert.equal(await page.getByAltText('Xem trước anh.png').count(), 0);
    await input.setInputFiles([png, { ...png, name: 'hai.png' }]);
    await input.setInputFiles({ ...png, name: 'to.png', buffer: Buffer.alloc(5242881) });
    await page.getByRole('alert').filter({ hasText: '5 MB' }).waitFor();
    assert.equal(await page.getByAltText('Xem trước hai.png').count(), 1);
    await input.setInputFiles([png, png, png, png]);
    await page.getByRole('alert').filter({ hasText: '3 file' }).waitFor();
    assert.equal(writes(), before);
    assert.equal(classReads(), initialClassReads);
    await page.evaluate(() => window.dispatchEvent(new Event('tipy-session-changed')));
    await page.waitForTimeout(300);
    assert.equal(await title.inputValue(), 'Bản nháp thử');
    assert.equal(await body.inputValue(), 'Nội dung cần giữ');
    assert.equal(await link.inputValue(), 'https://example.com/lesson');
    assert.equal(await page.locator('.class-select select').inputValue(), classroom.class_id);
    failUpload = true;
    const submit = page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true });
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'Tải file' }).waitFor();
    assert.equal(await title.inputValue(), 'Bản nháp thử');
    failUpload = false;
    loseResponse = true;
    await submit.click();
    await page
      .getByRole('alert')
      .filter({ hasText: /fetch|Failed|network/i })
      .waitFor();
    assert.equal(await title.inputValue(), 'Bản nháp thử');
    const uploaded = calls.filter((c) => c.action === 'upload').length;
    await submit.evaluate((b) => {
      b.click();
      b.click();
    });
    await page.waitForFunction(
      () => document.querySelector('.class-composer input[name=title]')?.value === '',
    );
    assert.equal(posts.length, 1);
    assert.equal(calls.filter((c) => c.action === 'class_post').length, 2);
    assert.equal(calls.filter((c) => c.action === 'upload').length, uploaded);
    await page.getByRole('heading', { name: 'Bản nháp thử', exact: true }).waitFor();
    assert.equal(await page.locator('.class-post h2').textContent(), 'Bản nháp thử');
    await title.fill('Bản nháp riêng giáo viên');
    user = { user_id: 'student', username: 'student', role: 'student' };
    await page.evaluate(() => window.dispatchEvent(new Event('tipy-session-changed')));
    await page.locator('.class-composer').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /anh.png.*KB/ }).click();
    await page.getByRole('link', { name: 'Mở / tải tài liệu' }).waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector('.class-attachment img');
      return img?.complete && img.naturalWidth > 0;
    });
    user = { user_id: 'teacher', username: 'teacher', role: 'admin' };
    await page.evaluate(() => window.dispatchEvent(new Event('tipy-session-changed')));
    await title.waitFor();
    assert.equal(await title.inputValue(), '');
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    console.log(
      JSON.stringify({
        width,
        selectCancelWrites: 0,
        filePickerMetadataReads: 0,
        accountSwitchClearsDraft: true,
        studentFilePreview: true,
        uploadFailurePreserved: true,
        lostResponseRetryPosts: posts.length,
        duplicateClickWrites: 1,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
