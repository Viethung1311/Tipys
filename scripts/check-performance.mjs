/** Production chunks and real browser image conversion; API/storage responses are fixtures. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [],
    scripts = [],
    actions = [],
    uploads = [];
  let posts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('.js')) scripts.push(r.url());
  });
  const classroom = {
    class_id: '22222222-2222-4222-8222-222222222222',
    name: 'Lớp kiểm thử',
    archived_at: null,
  };
  await page.route('**/*', async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    if (url.pathname === '/api/tipy') {
      const body = r.method() === 'POST' ? r.postDataJSON() : null;
      const action = body?.action || url.searchParams.get('action');
      actions.push(action);
      let data;
      if (action === 'bootstrap')
        data = {
          configured: true,
          user: { user_id: 'teacher', role: 'admin', full_name: 'Giáo viên' },
          classes: [classroom],
          games: [],
        };
      else if (action === 'classroom') data = { classroom, members: [], achievements: [], posts };
      else if (action === 'class_upload') {
        assert.equal(body.preview, true);
        data = {
          data: {
            attachmentId: 'file',
            signedUrl: 'http://tipy.test/mock-upload/original',
            previewSignedUrl: 'http://tipy.test/mock-upload/preview',
          },
        };
      } else if (action === 'class_post') {
        posts = [
          {
            post_id: 'posted',
            title: body.title,
            body: body.body,
            created_at: new Date().toISOString(),
            class_attachments: [
              {
                attachment_id: 'file',
                name: 'photo.png',
                mime_type: 'image/png',
                size_bytes: 1000000,
              },
            ],
          },
        ];
        data = { data: { post_id: 'posted' } };
      } else if (action === 'class_posts') data = { posts };
      else if (action === 'class_file')
        data = {
          url: 'http://tipy.test/mock-file/original',
          previewUrl: 'http://tipy.test/mock-file/preview',
        };
      else throw Error('Unexpected action ' + action);
      return route.fulfill({ json: data });
    }
    if (url.pathname.startsWith('/mock-upload/')) {
      uploads.push({ url: r.url(), bytes: r.postDataBuffer().length });
      return route.fulfill({ status: 200, json: {} });
    }
    if (url.pathname.startsWith('/mock-file/'))
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    return route.fulfill({
      body: await readFile(path.resolve('dist', filename)),
      contentType: filename.endsWith('.js')
        ? 'text/javascript'
        : filename.endsWith('.css')
          ? 'text/css'
          : filename.endsWith('.html')
            ? 'text/html'
            : filename.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg',
    });
  });
  await page.goto('http://tipy.test');
  await page.waitForSelector('.welcome-hero.hero-ready');
  assert.equal(
    scripts.some((s) => /ClassroomPage-|AdminPage-|TypingGame-/.test(s)),
    false,
  );
  await page.getByRole('button', { name: 'Lớp học', exact: true }).click();
  await page.waitForSelector('.class-composer');
  assert.ok(scripts.some((s) => s.includes('ClassroomPage-')));
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d'),
      im = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < im.data.length; i += 4) {
      im.data[i] = Math.random() * 256;
      im.data[i + 1] = Math.random() * 256;
      im.data[i + 2] = Math.random() * 256;
      im.data[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[name="title"]').fill('Bài ảnh kiểm thử');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
  await page.getByRole('button', { name: 'Đăng bài cho lớp', exact: true }).click();
  await page.waitForSelector('.class-post');
  assert.equal(uploads.length, 2);
  assert.ok(uploads[1].bytes < uploads[0].bytes);
  await page.getByRole('button', { name: /📎 photo.png/ }).click();
  await page.waitForSelector('.class-attachment img');
  assert.ok((await page.locator('.class-attachment img').getAttribute('src')).endsWith('/preview'));
  await page.getByRole('button', { name: /📎 photo.png/ }).click();
  assert.equal(actions.filter((a) => a === 'class_file').length, 1);
  assert.equal(actions.includes('classes'), false);
  assert.equal(actions.filter((a) => a === 'classroom').length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      productionChunks: 'loaded on demand',
      originalUploadBytes: uploads[0].bytes,
      previewUploadBytes: uploads[1].bytes,
      classesRequests: 0,
      classroomRequests: 1,
      postsOnlyRefresh: true,
      mobileWidth: 390,
      consoleErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
