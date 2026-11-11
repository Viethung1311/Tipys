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
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [768, 1024],
    [1440, 900],
    [844, 390],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion: 'reduce',
      }),
      errors = [],
      images = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/characters/')) images.push(r.url());
    });
    let signedIn = false,
      saved = 'icon_01',
      writes = 0;
    await page.route('**/api/tipy*', (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        action = body?.action || new URL(request.url()).searchParams.get('action');
      let json = {};
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: signedIn
            ? {
                user_id: '11111111-1111-4111-8111-111111111111',
                full_name: 'Bạn An',
                role: 'student',
              }
            : null,
          games: [],
          classes: [],
        };
      if (action === 'avatar')
        json = { avatar: { animal: saved, accessory: 'none', color: 'sun' } };
      if (action === 'avatar_save') {
        saved = body.animal;
        writes++;
        json = { data: { animal: saved, accessory: 'none', color: 'sun' } };
      }
      return route.fulfill({ json });
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
    await page.getByRole('button', { name: 'Cài đặt âm thanh', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((e) => getComputedStyle(e).scrollbarWidth), 'none');
    assert.equal(await dialog.getByRole('slider').count(), 2);
    await page.locator('#effects-volume').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.locator('#music-volume').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await dialog.getByRole('switch', { name: 'Hiệu ứng', exact: true }).click();
    await dialog.getByRole('switch', { name: 'Nhạc nền', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tipy-audio'))), {
      effectsEnabled: false,
      effectsVolume: 0.01,
      musicEnabled: true,
      musicVolume: 0.01,
    });
    const audioBox = await dialog.boundingBox();
    assert.ok(audioBox.y >= 0 && audioBox.y + audioBox.height <= height + 1);
    if (await dialog.evaluate((e) => e.scrollHeight > e.clientHeight + 1)) {
      await dialog.focus();
      await page.keyboard.press('PageDown');
      await page.waitForFunction(() => document.querySelector('[role=dialog]').scrollTop > 0);
    }
    await dialog.getByRole('button', { name: 'Xong rồi', exact: true }).click();
    await page.locator('.account-button').click();
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((e) => getComputedStyle(e).scrollbarWidth), 'none');
    await dialog.getByRole('button', { name: 'Đăng ký', exact: true }).click();
    if (await dialog.evaluate((e) => e.scrollHeight > e.clientHeight + 1)) {
      await dialog.evaluate((e) => (e.scrollTop = 0));
      await dialog.focus();
      await page.keyboard.press('PageDown');
      await page.waitForFunction(() => document.querySelector('[role=dialog]').scrollTop > 0);
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
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
    const body = page.getByRole('region', { name: 'Danh sách nhân vật', exact: true }),
      close = page.getByRole('button', { name: 'Đóng chọn nhân vật', exact: true });
    const footerBefore = await page.locator('.character-confirm').boundingBox();
    assert.equal(
      await page
        .getByRole('dialog')
        .evaluate(
          (root) =>
            [root, ...root.querySelectorAll('*')].filter(
              (e) =>
                ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) &&
                e.scrollHeight > e.clientHeight + 1,
            ).length,
        ),
      1,
      'one scroll container only',
    );
    assert.ok(footerBefore.y >= 0 && footerBefore.y + footerBefore.height <= height);
    assert.equal(await page.locator('.character-picker-scroll .character-confirm').count(), 0);
    const backgroundY = await page.evaluate(() => scrollY);
    await page.mouse.move(2, 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => scrollY), backgroundY, 'background page stays locked');
    const closeBefore = await close.boundingBox();
    assert.ok(closeBefore.width >= 48 && closeBefore.height >= 48);
    assert.equal(await body.evaluate((e) => getComputedStyle(e).scrollbarWidth), 'none');
    if (width === 360) {
      const touch = await page.context().newCDPSession(page),
        bounds = await body.boundingBox(),
        x = bounds.x + bounds.width / 2,
        y = bounds.y + bounds.height * 0.8;
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++)
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - step * 18 }],
        });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(
        () => document.querySelector('.character-picker-scroll').scrollTop > 0,
      );
      await body.evaluate((e) => (e.scrollTop = 0));
      await touch.detach();
    }
    await body.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(
      () => document.querySelector('.character-picker-scroll').scrollTop > 0,
    );
    await body.evaluate((e) => (e.scrollTop = 0));
    await body.focus();
    await page.keyboard.press('PageDown');
    await page.waitForFunction(
      () => document.querySelector('.character-picker-scroll').scrollTop > 0,
    );
    const footerAfter = await page.locator('.character-confirm').boundingBox();
    assert.equal(footerBefore.y, footerAfter.y, 'save footer stays fixed during scrolling');
    await page.keyboard.press('End');
    const last = page.getByRole('radio', { name: /Cây hoa/ });
    await last.check();
    await body.evaluate((e) => (e.scrollTop = e.scrollHeight));
    const closeAfter = await close.boundingBox();
    assert.equal(closeBefore.y, closeAfter.y, 'X stays visible after scrolling');
    const lastBox = await page.locator('.character-option').last().boundingBox(),
      saveBox = await page.locator('.character-confirm').boundingBox();
    assert.ok(lastBox.y + lastBox.height <= saveBox.y, 'save never overlays final row');
    await close.click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(writes, 0);
    await trigger.click();
    await page.getByRole('radio', { name: /Búp bê/ }).waitFor();
    assert.ok(
      await page.getByRole('radio', { name: /Búp bê/ }).isChecked(),
      'X discards unconfirmed choice',
    );
    await page.getByRole('radio', { name: /Gà lửa/ }).check();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(writes, 0);
    await trigger.click();
    assert.ok(
      await page.getByRole('radio', { name: /Búp bê/ }).isChecked(),
      'Esc discards unconfirmed choice',
    );
    await page.getByRole('radio', { name: /Búp bê/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert.ok(await page.getByRole('radio', { name: /Gà lửa/ }).isChecked());
    await page.getByRole('button', { name: 'Đăng nhập để lưu', exact: true }).click();
    await page.getByRole('textbox', { name: 'Tên đăng nhập', exact: true }).waitFor();
    signedIn = true;
    await page.reload();
    await trigger.click();
    await page.getByRole('radio', { name: /Cây hoa/ }).check();
    await page
      .getByRole('region', { name: 'Danh sách nhân vật', exact: true })
      .evaluate((e) => (e.scrollTop = e.scrollHeight));
    const signedLast = await page.locator('.character-option').last().boundingBox();
    const signedFooter = await page.locator('.character-confirm').boundingBox();
    assert.ok(
      signedLast.y + signedLast.height <= signedFooter.y,
      'signed-in last row stays above footer',
    );
    await page
      .getByRole('region', { name: 'Danh sách nhân vật', exact: true })
      .evaluate((e) => (e.scrollTop = 0));
    assert.ok(
      await page.getByRole('radio', { name: /Cây hoa/ }).isChecked(),
      'selection survives scroll',
    );
    await page.getByRole('button', { name: 'Lưu nhân vật', exact: true }).click();
    await page.getByText('Đã lưu nhân vật của bạn.', { exact: true }).waitFor();
    assert.equal(writes, 1);
    assert.equal(saved, 'icon_36');
    await close.click();
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('.avatar-button img')?.getAttribute('src')?.endsWith('icon_36.png'),
    );
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, trigger: box, geometry, errors }));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
