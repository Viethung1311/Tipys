/** Isolated account/avatar fixtures; never writes preferences or avatars to a real account. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/config.js';
import { DIALOGUE } from '../src/characters/companion-speech.js';
import { mkdirSync } from 'node:fs';
mkdirSync('test-results/companion', { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  await new Promise((r) => setTimeout(r, 1200));
  for (const width of [360, 1440]) {
    const page = await browser.newPage({
        viewport: { width, height: 900 },
        hasTouch: true,
        reducedMotion: 'reduce',
      }),
      errors = [];
    let active = 'alice',
      saves = 0;
    const avatars = { alice: 'icon_01', bob: 'icon_02' };
    await page.addInitScript(() => {
      window.companionWrites = [];
      window.companionEvents = [];
      window.addEventListener('tipy-companion-speech', (e) =>
        window.companionEvents.push(e.detail),
      );
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('tipy-companion:')) window.companionWrites.push({ key, value });
        return original.call(this, key, value);
      };
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/tipy*', async (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        action = body?.action || new URL(request.url()).searchParams.get('action');
      let json = {};
      if (action === 'login') active = body.username;
      if (action === 'logout') active = null;
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: active
            ? { user_id: active, username: active, full_name: active, role: 'student' }
            : null,
          classes: [],
          games: [
            {
              game_code: 'falling_letters',
              engine_code: 'falling_letters',
              is_active: true,
              game_name: 'Chữ rơi',
              config: { levels: LEVELS },
            },
          ],
        };
      if (action === 'avatar') json = { avatar: { animal: avatars[active] } };
      if (action === 'avatar_save') {
        avatars[active] = body.animal;
        saves++;
        json = { data: { animal: body.animal } };
      }
      if (action === 'start') json = { data: { play_id: '11111111-1111-4111-8111-111111111111' } };
      await route.fulfill({ json });
    });
    const companion = page.locator('.tipy-companion'),
      image = companion.locator('img');
    const fit = async () => {
      await page.waitForFunction(() => {
        const b = document.querySelector('.tipy-companion')?.getBoundingClientRect();
        return (
          b && b.x >= 0 && b.y >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1
        );
      });
      const b = await companion.boundingBox();
      const v = page.viewportSize();
      assert.ok(
        b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1,
      );
    };
    const open = async () => {
      await page.getByRole('button', { name: 'Chọn nhân vật', exact: true }).click();
      await page.getByRole('button', { name: 'Lưu nhân vật', exact: true }).waitFor();
    };
    const close = async () => {
      await page.getByRole('button', { name: 'Đóng chọn nhân vật', exact: true }).click();
    };
    const nav = (name) =>
      page
        .getByRole('navigation', { name: 'Điều hướng chính' })
        .getByRole('button', { name, exact: true });
    await page.goto('http://127.0.0.1:4188');
    await companion.waitFor();
    await fit();
    assert.equal(
      await companion.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return [...document.querySelectorAll('main .tipy-button:not(:disabled)')].filter(
          (button) => {
            const b = button.getBoundingClientRect();
            return (
              b.width &&
              b.height &&
              r.left < b.right &&
              r.right > b.left &&
              r.top < b.bottom &&
              r.bottom > b.top
            );
          },
        ).length;
      }),
      0,
      'default corner does not cover home actions',
    );
    assert.equal(await image.getAttribute('src'), '/characters/icon_01.png');
    const bubble = page.locator('.companion-bubble');
    await companion.click();
    await page.waitForFunction(
      (lines) => lines.includes(document.querySelector('.companion-bubble')?.textContent),
      DIALOGUE.click,
    );
    await bubble.waitFor({ state: 'visible' });
    assert.ok(DIALOGUE.click.includes(await bubble.textContent()));
    assert.equal(await bubble.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    await page.screenshot({ path: `test-results/companion/${width}-speech.png` });
    await bubble.waitFor({ state: 'detached', timeout: 3500 });
    await page.waitForTimeout(600);
    const clickStart = await companion.boundingBox();
    await page.mouse.move(
      clickStart.x + clickStart.width / 2,
      clickStart.y + clickStart.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(clickStart.x + 5, clickStart.y + 5, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(
      (lines) => lines.includes(document.querySelector('.companion-bubble')?.textContent),
      DIALOGUE.drag,
    );
    await bubble.waitFor({ state: 'attached' });
    assert.ok(
      DIALOGUE.drag.includes(await bubble.textContent()),
      'drag never also emits click speech',
    );
    await companion.evaluate((e) => (e.dataset.instance = 'original'));
    await nav('Gõ chữ').click();
    assert.equal(await companion.getAttribute('data-instance'), 'original');
    await nav('Trang chủ').click();
    await open();
    await page.locator('input[value="icon_36"]').check();
    await page.getByRole('button', { name: 'Lưu nhân vật', exact: true }).click();
    await page.getByText('Đã lưu nhân vật của bạn.', { exact: true }).waitFor();
    assert.equal(await image.getAttribute('src'), '/characters/icon_36.png');
    assert.equal(
      await page.locator('.avatar-button img').getAttribute('src'),
      '/characters/icon_36.png',
    );
    assert.equal(saves, 1);
    await page.locator('input[value="icon_02"]').check();
    await page.getByRole('button', { name: 'Ẩn bạn', exact: true }).click();
    assert.equal(await companion.count(), 0);
    await page.getByRole('button', { name: 'Hiện bạn', exact: true }).click();
    assert.equal(await image.getAttribute('src'), '/characters/icon_36.png');
    assert.equal(saves, 1);
    await close();
    const baseSize = (await companion.boundingBox()).width;
    const headerSize = (await page.locator('.avatar-button img').boundingBox()).width;
    const beforePreview = await page.evaluate(() => window.companionWrites.length);
    await open();
    const slider = page.getByRole('slider', { name: /Nhỏ đến Lớn/ });
    await slider.scrollIntoViewIfNeeded();
    if (width === 360) {
      const range = await slider.boundingBox();
      await page.touchscreen.tap(range.x + range.width * 0.8, range.y + range.height / 2);
      assert.notEqual(await slider.inputValue(), '100');
    }
    await slider.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(
      (base) =>
        document.querySelector('.tipy-companion').getBoundingClientRect().width > base * 1.5,
      baseSize,
    );
    await fit();
    assert.equal(
      await page.evaluate(() => window.companionWrites.length),
      beforePreview,
      'size preview never persists',
    );
    assert.equal((await page.locator('.avatar-button img').boundingBox()).width, headerSize);
    const panel = await page.locator('.companion-size-panel').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width);
    const footer = await page.locator('.character-confirm').boundingBox();
    assert.ok(footer.y + footer.height <= 900);
    await page.screenshot({ path: `test-results/companion/${width}-size.png` });
    await close();
    await page.waitForFunction(
      (base) => document.querySelector('.tipy-companion').getBoundingClientRect().width === base,
      baseSize,
    );
    await open();
    assert.equal(await slider.inputValue(), '100');
    await page.getByRole('button', { name: 'Mặc định', exact: true }).click();
    await slider.focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Lưu nhân vật', exact: true }).click();
    await page.getByText('Đã lưu nhân vật của bạn.', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('tipy-companion:alice')).size),
      160,
    );
    await close();
    await fit();
    const oldWrites = await page.evaluate(() => window.companionWrites.length),
      start = await companion.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x - 120, start.y - 200, { steps: 8 });
    assert.equal(
      await page.evaluate(() => window.companionWrites.length),
      oldWrites,
      'no storage writes while moving',
    );
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.companionWrites.length), oldWrites + 1);
    const stored = await page.evaluate(() => localStorage.getItem('tipy-companion:alice'));
    await nav('Gõ chữ').click();
    await fit();
    await page.reload();
    await companion.waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('tipy-companion:alice')), stored);
    await fit();
    if (width === 360) {
      const client = await page.context().newCDPSession(page),
        b = await companion.boundingBox(),
        x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      const before = await page.evaluate(() => window.companionWrites.length);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 20, y: 100 }],
      });
      assert.equal(await page.evaluate(() => window.companionWrites.length), before);
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await client.detach();
      assert.equal(await page.evaluate(() => window.companionWrites.length), before + 1);
      await fit();
    }
    await companion.focus();
    await page.keyboard.press('ArrowLeft');
    await fit();
    await page.setViewportSize({ width: 844, height: 390 });
    await fit();
    await page.setViewportSize({ width, height: 900 });
    await fit();
    const b = await companion.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(-50, -50, { steps: 5 });
    await page.mouse.up();
    await fit();
    await page.locator('.game-card').getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
    await page.locator('.arena').waitFor();
    await page.waitForFunction(() => window.companionEvents.includes('start'));
    await page.locator('.letter').first().waitFor();
    const key = await page.locator('.letter').first().getAttribute('data-key');
    await page.keyboard.press(key);
    await page.waitForFunction(() => window.companionEvents.includes('correct'));
    await companion.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.result-score').count(), 0);
    await page.locator('.arena').click({ position: { x: 10, y: 10 } });
    for (let i = 0; i < 6; i++) await page.keyboard.press('z');
    await page.waitForFunction(() =>
      window.companionEvents.some((e) => e === 'finish' || e === 'record'),
    );
    await page.getByRole('button', { name: 'Về trang chủ', exact: true }).click();
    await open();
    await page.getByRole('button', { name: 'Ẩn bạn', exact: true }).click();
    await close();
    await page.reload();
    await page.locator('.avatar-button').waitFor();
    assert.equal(await companion.count(), 0);
    await page.locator('.account-button').click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    assert.equal(await companion.count(), 0);
    const login = async (name) => {
      await page.locator('input[name="username"]').fill(name);
      await page.locator('input[name="password"]').fill('1');
      await page.getByRole('button', { name: 'Vào chơi nào', exact: true }).click();
      await page.locator('.account-summary').waitFor();
      await page.keyboard.press('Escape');
    };
    await login('bob');
    await companion.waitFor();
    assert.equal(await image.getAttribute('src'), '/characters/icon_02.png');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('tipy-companion:bob')),
      null,
      'alice settings never copy to bob',
    );
    await page.locator('.account-button').click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    await login('alice');
    assert.equal(await companion.count(), 0, 'alice hidden preference restored');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        savedAvatar: true,
        dragAndBounds: true,
        touch: width === 360,
        releaseOnlyWrites: true,
        hideAndReload: true,
        accountIsolation: true,
        sizePreviewCancelSave: true,
        gameSpeechEvents: true,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
