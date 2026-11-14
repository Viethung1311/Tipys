/** Browser geometry and request checks; all progress is local fixture data. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { LESSONS } from '../src/features/keyboard-quest/curriculum.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4197'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/play-surface', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 1000));
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1440, 900],
  ].filter(([width]) => !process.env.PLAY_WIDTH || width === Number(process.env.PLAY_WIDTH))) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' }),
      requests = [],
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      (progress) => {
        localStorage.setItem('tipy-quest-guest-v1', JSON.stringify(progress));
        // Rejected native fullscreen must still leave an accessible fixed play area.
        window.__fullscreenCalls = 0;
        window.__nativeFullscreen = Element.prototype.requestFullscreen;
        Element.prototype.requestFullscreen = () => {
          window.__fullscreenCalls++;
          return Promise.reject(new Error('fixture denial'));
        };
      },
      LESSONS.map((l) => ({ lesson_id: l.id, completed: true, best_stars: 3 })),
    );
    await page.route('**/api/tipy*', (route) => {
      const a = new URL(route.request().url()).searchParams.get('action');
      requests.push(a);
      return route.fulfill({
        json: a === 'bootstrap' ? { configured: false, user: null, classes: [], games: null } : {},
      });
    });
    const fit = async (label) => {
      const bad = await page.locator('.play-surface').evaluate((root) => {
        const box = root.getBoundingClientRect();
        const selectors = [
          '.quest-target',
          '.quest-letter-sticker',
          'textarea',
          '.quest-actions button',
          '.quest-player-top button',
          '.touchboard .key.selected',
          '.game-toolbar button',
          '.arena',
        ];
        return [...root.querySelectorAll(selectors.join(','))]
          .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
          .map((e) => ({
            label: e.getAttribute('aria-label') || e.textContent.trim(),
            x: e.getBoundingClientRect().x,
            y: e.getBoundingClientRect().y,
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
          }))
          .filter(
            (b) =>
              b.x < box.x - 1 ||
              b.y < box.y - 1 ||
              b.x + b.w > box.right + 1 ||
              b.y + b.h > box.bottom + 1,
          );
      });
      if (bad.length) {
        console.log(
          await page
            .locator(
              '.quest-player-top,.quest-challenge,.quest-playfield,.adventure-content,.adventure-scene,.quest-actions,.play-surface',
            )
            .evaluateAll((es) =>
              es.map((e) => ({
                class: e.className,
                rect: e.getBoundingClientRect().toJSON(),
                display: getComputedStyle(e).display,
                minHeight: getComputedStyle(e).minHeight,
                flex: getComputedStyle(e).flex,
                grid: getComputedStyle(e).gridTemplateColumns,
              })),
            ),
        );
        await page.screenshot({ path: 'test-results/play-surface/failure.png' });
      }
      assert.deepEqual(bad, [], `${width}x${height} ${label}`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
      assert.equal(await page.locator('#root').evaluate((e) => e.inert), true);
    };
    await page.goto('http://127.0.0.1:4197/#typing');
    await page
      .locator('.game-card')
      .filter({ hasText: 'Bé chinh phục bàn phím' })
      .getByRole('button', { name: 'Chơi', exact: true })
      .click();
    for (const world of [1, 2, 3, 4, 5]) {
      await page.locator(`[data-world-id="${world}"]`).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Bắt đầu', exact: true }).click();
      for (const lesson of LESSONS.filter((l) => l.world === world)) {
        for (const mode of ['learn', 'race']) {
          await page.getByLabel('Kiểu chơi').selectOption(mode);
          await page
            .locator('.quest-lesson')
            .filter({ hasText: lesson.title })
            .getByRole('button')
            .click();
          await page.locator('.quest-target').waitFor();
          await fit(`${lesson.id}/${mode}`);
          const before = requests.length;
          await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Tiếp tục', exact: true })
            .click();
          assert.equal(requests.length, before, 'pause adds no requests');
          if (lesson.stage === 1 && mode === 'learn') {
            await page.setViewportSize({ width: height, height: width });
            await fit('rotated');
            await page.setViewportSize({ width, height });
            await page.screenshot({
              path: `test-results/play-surface/${width}x${height}-keys.png`,
            });
          }
          if ((await page.locator('textarea').count()) && mode === 'learn') {
            await page.locator('textarea').focus();
            await page.evaluate(() => {
              Object.defineProperty(visualViewport, 'height', { configurable: true, value: 300 });
              visualViewport.dispatchEvent(new Event('resize'));
            });
            await fit(`${lesson.id}/IME`);
            await page.evaluate(() => {
              delete visualViewport.height;
              visualViewport.dispatchEvent(new Event('resize'));
            });
          }
          if (lesson.stage === 1 && mode === 'learn') {
            for (const item of lesson.items)
              await page.getByRole('button', { name: 'Gõ ' + item.target, exact: true }).click();
            await page.getByText('Đã lưu bản chơi thử trên máy này.', { exact: true }).waitFor();
            assert.equal(
              await page
                .locator('.play-result')
                .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
              true,
              'practice result fits',
            );
            await page.screenshot({
              path: `test-results/play-surface/${width}x${height}-result.png`,
            });
            await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
            continue;
          }
          await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Quay lại', exact: true })
            .click();
          await page.locator('.quest-lesson').first().waitFor();
        }
      }
      await page.getByRole('button', { name: 'Bản đồ đảo', exact: true }).click();
    }
    await page.goto('http://127.0.0.1:4197/#typing');
    await page.reload();
    await page
      .locator('.game-card')
      .filter({ hasText: 'Chữ rơi' })
      .getByRole('button', { name: 'Chơi', exact: true })
      .click();
    await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
    await page.locator('.arena').waitFor();
    await fit('falling');
    await page.screenshot({ path: `test-results/play-surface/${width}x${height}-falling.png` });
    for (const difficulty of ['Dễ', 'Bình thường', 'Khó']) {
      await page.goto('http://127.0.0.1:4197/#typing');
      await page.reload();
      await page
        .locator('.game-card')
        .filter({ hasText: 'Chữ rơi' })
        .getByRole('button', { name: 'Chơi', exact: true })
        .click();
      await page.locator('.difficulty').filter({ hasText: difficulty }).click();
      await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
      await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
      await page.locator('.letter').first().waitFor();
      await fit('falling/all/' + difficulty);
      const key = await page.locator('.letter').first().getAttribute('data-key');
      assert.equal(
        await page.getByRole('button', { name: 'Gõ ' + key, exact: true }).isVisible(),
        true,
      );
    }
    if (width === 1440) {
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click();
      await page.goto('http://127.0.0.1:4197/#typing');
      await page.reload();
      await page
        .locator('.game-card')
        .filter({ hasText: 'Chữ rơi' })
        .getByRole('button', { name: 'Chơi', exact: true })
        .click();
      await page.evaluate(() => {
        document.documentElement.requestFullscreen = window.__nativeFullscreen;
      });
      await page.getByRole('button', { name: 'Bắt đầu chơi', exact: true }).click();
      await page.waitForFunction(() => document.fullscreenElement);
      const before = requests.length;
      await page.locator('.arena').evaluate((e) => (window.__arena = e));
      await page.evaluate(() => document.exitFullscreen());
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.play-surface').count(), 1);
      assert.equal(await page.locator('.arena').evaluate((e) => e === window.__arena), true);
      assert.equal(requests.length, before, 'native exit/Esc adds zero requests');
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        height,
        questLayouts: 60,
        fullscreen: width === 1440 ? 'native + denial + Esc' : 'denied fallback',
        pauseRequests: 0,
        nativeExitRequests: width === 1440 ? 0 : undefined,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
