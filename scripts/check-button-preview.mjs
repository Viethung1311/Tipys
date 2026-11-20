/** Isolated browser checks: preview controls must never contact business endpoints. */
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import assert from 'node:assert/strict';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4208', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const directory = 'test-results/button-preview';
mkdirSync(directory, { recursive: true });
const metrics = [];
const graphProbe = `graphify-out/.button-preview-probe-${process.pid}.html`;
function contrast(a, b) {
  const luminance = (color) =>
    color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
try {
  await expect
    .poll(
      async () => {
        assert.equal(server.exitCode, null, 'local preview server must stay running');
        try {
          return (await fetch('http://127.0.0.1:4208/')).status;
        } catch {
          return 0;
        }
      },
      { timeout: 15000 },
    )
    .toBe(200);
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [844, 390],
    [320, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' }),
      requests = [],
      errors = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:4208/dev/buttons');
    await page.getByRole('heading', { name: 'Một bộ nút, nhiều niềm vui' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.preview-sample').count(), 14);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${directory}/${width}-normal.png` });
    if (width === 1440)
      await page.locator('.preview-grid').screenshot({ path: `${directory}/all-roles.png` });
    for (const sample of await page.locator('.preview-sample').all()) {
      const button = sample.locator('.tipy-button').first();
      for (const hover of [false, true]) {
        if (hover) await button.hover();
        const colors = await button.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            text: style.color,
            fills: style.backgroundImage.match(/rgba?\([^)]+\)/g) || [style.backgroundColor],
          };
        });
        assert.ok(
          colors.fills.every((fill) => contrast(colors.text, fill) >= 4.5),
          `text contrast: ${await button.innerText()}`,
        );
      }
      await page.getByRole('heading', { name: 'Một bộ nút, nhiều niềm vui' }).hover();
    }
    const sample = page.locator('.preview-sample').first(),
      control = sample.locator('.tipy-button').first();
    assert.equal(await control.evaluate((element) => element.getBoundingClientRect().height), 56);
    assert.equal(
      await sample
        .locator('.tipy-button--icon-only')
        .evaluate((element) => element.getBoundingClientRect().width),
      48,
    );
    await control.hover();
    assert.equal(await control.evaluate((element) => getComputedStyle(element).filter), 'none');
    await control.press('Tab');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth),
      '3px',
    );
    await control.dblclick();
    await page.getByRole('status').filter({ hasText: 'Đã thử “Chơi”' }).waitFor();
    assert.match(await page.locator('.preview-toolbar').innerText(), /1 lần thử/);
    for (const state of ['hover', 'pressed', 'focus', 'loading', 'disabled']) {
      await page.getByLabel('Trạng thái minh họa').selectOption(state);
      if (state === 'disabled' || state === 'loading')
        assert.equal(await control.isDisabled(), true);
      if (state === 'focus')
        assert.equal(
          await control.evaluate((element) => getComputedStyle(element).outlineWidth),
          '3px',
        );
      if (width === 1440) await sample.screenshot({ path: `${directory}/state-${state}.png` });
    }
    await page.getByLabel('Trạng thái minh họa').selectOption('normal');
    const field = page.getByLabel('Nội dung đang soạn');
    await field.press('Enter');
    assert.match(await page.locator('.preview-toolbar').innerText(), /1 lần thử/);
    await field.fill('Bản nháp tiếng Việt vẫn còn nguyên.');
    const file = page.getByLabel('Ảnh xem trước'),
      png = readFileSync('public/quest-art/smiling-star.png');
    await file.setInputFiles({ name: 'sao.png', mimeType: 'image/png', buffer: png });
    assert.equal(await page.locator('.preview-images img').count(), 1);
    await file.setInputFiles([]);
    assert.equal(await page.locator('.preview-images img').count(), 1);
    await file.setInputFiles({ name: 'sao.png', mimeType: 'image/png', buffer: png });
    assert.equal(await page.locator('.preview-images img').count(), 1);
    await file.setInputFiles({
      name: 'qua-lon.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5242881),
    });
    await page.getByRole('alert').filter({ hasText: 'Chọn tối đa 3 ảnh' }).waitFor();
    assert.equal(await field.inputValue(), 'Bản nháp tiếng Việt vẫn còn nguyên.');
    assert.equal(await page.locator('.preview-images img').count(), 1);
    if (width === 1440) {
      writeFileSync(graphProbe, '<!doctype html><title>Local watch check</title>', { flag: 'wx' });
      writeFileSync(
        `${directory}/watch-probe.html`,
        '<!doctype html><title>Local QA watch check</title>',
      );
      await page.waitForTimeout(700);
      assert.equal(
        await field.inputValue(),
        'Bản nháp tiếng Việt vẫn còn nguyên.',
        'generated HTML must not reload the form',
      );
      assert.equal(await page.locator('.preview-images img').count(), 1);
    }
    await file.setInputFiles(
      Array.from({ length: 4 }, (_, index) => ({
        name: `anh-${index}.png`,
        mimeType: 'image/png',
        buffer: png,
      })),
    );
    assert.equal(await page.locator('.preview-images img').count(), 1);
    await field.press('Enter');
    try {
      await page.getByRole('status').filter({ hasText: 'Đã thử “Gửi form mẫu”' }).waitFor();
    } catch (error) {
      console.log(
        JSON.stringify({
          width,
          errors,
          form: await page.locator('.preview-form').evaluate((form) =>
            [...form.elements].map((field) => ({
              type: field.type,
              value: field.value,
              disabled: field.disabled,
              error: field.validationMessage,
            })),
          ),
          feedback: await page.locator('.preview-toolbar').innerText(),
        }),
      );
      await page.screenshot({ path: `${directory}/form-failure.png` });
      throw error;
    }
    assert.match(await page.locator('.preview-toolbar').innerText(), /2 lần thử/);
    assert.equal(await field.inputValue(), 'Bản nháp tiếng Việt vẫn còn nguyên.');
    await page.getByRole('button', { name: 'Xóa ảnh mẫu', exact: true }).click();
    assert.equal(await page.locator('.preview-images img').count(), 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    metrics.push({
      width,
      height,
      samples: 14,
      businessRequests: 0,
      doubleClickCount: 1,
      enterSubmits: true,
      fileDraftPreserved: true,
      states: 6,
      errors,
    });
    await page.close();
  }
  assert.equal(
    readdirSync('dist/assets').some(
      (name) => name.includes('ButtonPreview') || name.includes('button-preview'),
    ),
    false,
    'preview is absent from production assets',
  );
  writeFileSync(`${directory}/requests.json`, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  if (existsSync(graphProbe)) unlinkSync(graphProbe);
  await browser.close();
  server.kill();
}
