/** Real artwork/geometry and navigation checks against production assets; API fixtures never touch Supabase. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { LESSONS } from '../src/features/keyboard-quest/curriculum.js';
import { ADVENTURE_WORLDS } from '../src/features/keyboard-quest/adventure.js';

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4184'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/adventure', { recursive: true });
try {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await page.route('**/api/tipy*', async (route) => {
      const action = new URL(route.request().url()).searchParams.get('action');
      await route.fulfill({
        json:
          action === 'bootstrap'
            ? {
                configured: true,
                user: null,
                classes: [],
                games: [
                  {
                    game_code: 'keyboard_quest',
                    engine_code: 'keyboard_quest',
                    game_name: 'Bé chinh phục bàn phím',
                    is_active: true,
                  },
                ],
              }
            : {},
      });
    });
    await page.goto('http://127.0.0.1:4184/#typing');
    await page.locator('.game-card').getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.locator('.adventure-map-image').evaluate((image) => image.decode());
    await page.locator('.adventure-map-loading').waitFor({ state: 'hidden' });
    const fit = async () => {
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `page overflow at ${width}`,
      );
      assert.ok(
        await page.locator('.adventure-breadcrumbs button').evaluateAll((buttons) =>
          buttons.every((button) => {
            const bounds = button.getBoundingClientRect();
            const label = button.querySelector('.tipy-button__label').getBoundingClientRect();
            return label.left >= bounds.left && label.right <= bounds.right + 1;
          }),
        ),
        `breadcrumb label overflow at ${width}`,
      );
    };
    await fit();
    for (const world of ADVENTURE_WORLDS) {
      const target = page.locator(`[data-world-id="${world.id}"]`);
      await target.scrollIntoViewIfNeeded();
      const position = await target.locator('.adventure-map-indicator').evaluate((element) => {
        const marker = element.getBoundingClientRect(),
          map = document.querySelector('.adventure-map-image').getBoundingClientRect();
        return {
          x: (marker.x + marker.width / 2 - map.x) / map.width,
          y: (marker.y + marker.height / 2 - map.y) / map.height,
        };
      });
      assert.ok(
        Math.abs(position.x - world.x) < 0.002 && Math.abs(position.y - world.y) < 0.002,
        `marker ${world.id} ${JSON.stringify(position)}`,
      );
      assert.ok((await target.boundingBox()).width >= 48);
    }
    assert.ok(
      !requests.some((path) => /forest|autumn|desert|snow/.test(path)),
      'scene backgrounds must not preload on map',
    );
    await page.setViewportSize({ width: width + 80, height: 700 });
    const resized = await page.locator('.adventure-map-target').evaluateAll((elements) =>
      elements.map((element) => {
        const marker = element.querySelector('.adventure-map-indicator').getBoundingClientRect();
        const map = document.querySelector('.adventure-map-image').getBoundingClientRect();
        return {
          x: (marker.x + marker.width / 2 - map.x) / map.width,
          y: (marker.y + marker.height / 2 - map.y) / map.height,
        };
      }),
    );
    resized.forEach((position, index) => {
      assert.ok(Math.abs(position.x - ADVENTURE_WORLDS[index].x) < 0.002);
      assert.ok(Math.abs(position.y - ADVENTURE_WORLDS[index].y) < 0.002);
    });
    await page.setViewportSize({ width, height: 900 });
    const locked = page.locator('[data-world-id="5"]');
    await locked.focus();
    await page.keyboard.press('Enter');
    let dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.ok(await dialog.getByRole('button', { name: 'Bắt đầu', exact: true }).isDisabled());
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.locator('[data-world-id="1"]').click();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    assert.equal(await page.locator('.quest-lesson').count(), 0);
    await page.locator('[data-world-id="1"]').click();
    await dialog.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
    await page.locator('.adventure-guide img').evaluate((image) => image.decode());
    assert.equal(await page.locator('.quest-lesson').count(), 5);
    await fit();
    await page.getByRole('button', { name: 'Vào học', exact: true }).click();
    await page.locator('.quest-target').waitFor();
    await page.locator('.adventure-world-switch').click();
    dialog = page.getByRole('dialog');
    await dialog.locator('.adventure-menu-worlds').waitFor();
    assert.equal(await dialog.locator('details').count(), 5);
    assert.equal(await dialog.locator('.adventure-menu-lesson[aria-current="step"]').count(), 1);
    await dialog.locator('details').last().locator('summary').click();
    assert.ok(
      await dialog.locator('details').last().locator('.adventure-menu-lesson').first().isDisabled(),
    );
    const bounds = await dialog.boundingBox();
    assert.ok(
      bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.y + bounds.height <= 901,
    );
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    for (const item of LESSONS[0].items) {
      await page.getByRole('button', { name: `Gõ ${item.target}`, exact: true }).click();
    }
    await page.getByText('Đã lưu bản chơi thử trên máy này.', { exact: true }).waitFor();
    await fit();
    await page.getByRole('button', { name: 'Danh sách bài', exact: true }).click();
    assert.equal(
      await page
        .locator('.quest-lesson')
        .filter({ hasText: LESSONS[1].title })
        .getByRole('button')
        .isEnabled(),
      true,
    );
    await page.getByRole('button', { name: 'Bản đồ đảo', exact: true }).click();
    await page.reload();
    await page.locator('[data-world-id="1"][aria-label*="1/5"]').waitFor();
    await page.locator('.adventure-map-image').evaluate((image) => image.decode());
    await page.locator('.adventure-map-viewport').evaluate((element) => (element.scrollLeft = 0));
    await page.screenshot({ path: `test-results/adventure/${width}-map.png`, fullPage: true });
    for (const world of ADVENTURE_WORLDS) {
      await page.evaluate(
        (progress) => localStorage.setItem('tipy-quest-guest-v1', JSON.stringify(progress)),
        LESSONS.map((lesson) => ({ lesson_id: lesson.id, completed: true, best_stars: 3 })),
      );
      await page.reload();
      await page.locator('.adventure-world-switch:not(:disabled)').click();
      const detail = page
        .getByRole('dialog')
        .locator('details')
        .nth(world.id - 1);
      await detail.locator('summary').click();
      await detail.getByRole('button', { name: 'Xem các bài', exact: true }).click();
      await page.locator('.adventure-guide img').evaluate((image) => image.decode());
      assert.equal(await page.locator('.adventure-guide img').getAttribute('src'), world.guide.src);
      assert.ok(
        await page
          .locator('.adventure-scene')
          .evaluate(
            (element, src) => getComputedStyle(element).backgroundImage.includes(src),
            world.background.src,
          ),
      );
      await fit();
      await page.screenshot({
        path: `test-results/adventure/${width}-world-${world.id}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        markerAlignment: 5,
        worlds: 5,
        menu: true,
        locked: true,
        completionAndReload: true,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
