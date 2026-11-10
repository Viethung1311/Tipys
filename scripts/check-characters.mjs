import { spawn } from 'node:child_process';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178'],
  { stdio: 'ignore', windowsHide: true },
);
await new Promise((r) => setTimeout(r, 2000));
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const directory = process.env.TIPY_SCREENSHOTS || 'test-results/characters';
mkdirSync(directory, { recursive: true });
try {
  for (const width of [360, 768, 1440]) {
    const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      }),
      errors = [],
      images = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/characters/')) images.push(r.url());
    });
    await page.route('**/api/tipy*', (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        action = body?.action || new URL(request.url()).searchParams.get('action');
      return route.fulfill({
        json:
          action === 'bootstrap' ? { configured: true, user: null, games: [], classes: [] } : {},
      });
    });
    await page.goto('http://127.0.0.1:4178');
    const trigger = page.getByRole('button', { name: 'Chọn nhân vật', exact: true });
    await trigger.waitFor();
    await page
      .locator('.loading-screen')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await page.waitForTimeout(150);
    assert.ok(
      images.every((url) => /icon_(01|10|24|29|06)\.png/.test(url)),
      'only visible avatar/illustration images before opening',
    );
    const box = await trigger.boundingBox();
    assert.ok(box.width >= 48 && box.height >= 48);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.locator('.character-option').last().waitFor();
    assert.equal(await page.locator('.character-option').count(), 36);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.character-option img')]
        .slice(0, 4)
        .every((img) => img.complete && img.naturalWidth > 0),
    );
    await page.screenshot({ path: directory + '/tipy-characters-' + width + '.png' });
    const geometry = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      dialog: document.querySelector('[role=dialog]').getBoundingClientRect().toJSON(),
      overflows: [...document.querySelectorAll('.character-option')].filter(
        (e) => e.scrollWidth > e.clientWidth + 1,
      ).length,
      fit: getComputedStyle(document.querySelector('.character-option img')).objectFit,
    }));
    assert.ok(geometry.page <= width, 'no page overflow');
    assert.ok(geometry.dialog.x >= 0 && geometry.dialog.right <= width);
    assert.equal(geometry.overflows, 0);
    assert.equal(geometry.fit, 'contain');
    await page.getByRole('radio', { name: /Búp bê/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert.ok(await page.getByRole('radio', { name: /Gà lửa/ }).isChecked());
    await page.getByRole('button', { name: 'Đăng nhập để lưu', exact: true }).click();
    await page.getByRole('textbox', { name: 'Tên đăng nhập', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, trigger: box, geometry, errors }));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
