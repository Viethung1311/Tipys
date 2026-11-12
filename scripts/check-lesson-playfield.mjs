/** Browser fixture only: all lessons and vocabulary, no real accounts or Supabase writes. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { LESSONS, LIBRARY_LESSONS, findLesson } from '../src/features/keyboard-quest/curriculum.js';
import { gradeLesson } from '../src/features/keyboard-quest/engine.js';
import { adventureWorld } from '../src/features/keyboard-quest/adventure.js';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4197'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/playfield', { recursive: true });
try {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  for (const width of [320, 768, 1440]) {
    const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
      }),
      errors = [],
      stickers = [];
    let rows = LESSONS.map((l) => ({
        lesson_id: l.id,
        completed: true,
        best_stars: 1,
        awarded_stars: 1,
        attempts: 1,
      })),
      sequence = 0;
    const plays = new Map();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (request) => {
      const name = new URL(request.url()).pathname;
      if (/\/assets\/[A-Z](?:_|-)/.test(name)) stickers.push(name);
    });
    await page.addInitScript(() => {
      window.spoken = [];
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [{ lang: 'vi-VN' }],
          speak: (utterance) => window.spoken.push(utterance.text),
          cancel() {},
        },
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
    });
    await page.route('**/api/tipy*', async (route) => {
      const req = route.request(),
        body = req.postDataJSON(),
        action = body?.action || new URL(req.url()).searchParams.get('action');
      let json = {};
      if (action === 'bootstrap')
        json = {
          configured: true,
          user: { user_id: 'playfield-fixture', role: 'student', full_name: 'Bạn thử' },
          classes: [],
          games: [{ game_code: 'keyboard_quest', engine_code: 'keyboard_quest', is_active: true }],
        };
      if (action === 'avatar') json = { avatar: { animal: 'icon_01' } };
      if (action === 'quest_progress') json = { progress: rows };
      if (action === 'stars')
        json = { stars: rows.reduce((sum, row) => sum + (row.awarded_stars || 0), 0) };
      if (action === 'start') {
        const playId = 'fixture-' + ++sequence;
        plays.set(playId, body.lessonId);
        json = { data: { play_id: playId } };
      }
      if (action === 'progress') json = { data: {} };
      if (action === 'quest_finish') {
        const lesson = findLesson(plays.get(body.playId)),
          grade = gradeLesson(lesson, body.answers),
          old = rows.find((r) => r.lesson_id === lesson.id);
        const extra = Math.max(0, grade.stars - (old?.awarded_stars || 0));
        const row = {
          ...old,
          lesson_id: lesson.id,
          completed: grade.completed,
          best_stars: Math.max(old?.best_stars || 0, grade.stars),
          awarded_stars: Math.max(old?.awarded_stars || 0, grade.stars),
          award_this_play: extra,
          last_award_delta: extra,
          reward_status: 'awarded',
        };
        rows = [...rows.filter((r) => r.lesson_id !== row.lesson_id), row];
        json = { data: { progress: row } };
      }
      await route.fulfill({ json });
    });
    const fit = async () =>
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `horizontal overflow ${width}`,
      );
    const open = async (lesson) => {
      await page.locator(`[data-world-id="${lesson.world}"]`).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Bắt đầu', exact: true }).click();
      await page
        .locator('.quest-lesson')
        .filter({ has: page.getByRole('heading', { name: lesson.title, exact: true }) })
        .getByRole('button')
        .click();
      await page.locator('.quest-playfield').waitFor();
    };
    const exit = async () => {
      await page
        .locator('.quest-play-navigation')
        .getByRole('button', { name: 'Bản đồ', exact: true })
        .click();
      await page.locator('.adventure-map').waitFor();
    };
    const answer = async (item) => {
      const input = page.locator('.quest-playfield textarea');
      if (await input.count()) {
        await input.fill(item.target);
        await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
      } else if (item.target === 'Space')
        await page.getByRole('button', { name: 'Phím cách', exact: true }).click();
      else await page.getByRole('button', { name: `Gõ ${item.target}`, exact: true }).click();
    };
    await page.goto('http://127.0.0.1:4197/#typing/quest');
    await page.locator('.adventure-map').waitFor();
    assert.equal(stickers.length, 0, 'map must not preload alphabet PNGs');
    for (const lesson of LESSONS) {
      await open(lesson);
      const world = adventureWorld(lesson.world);
      assert.equal(
        await page.locator('.quest-playfield-guide img').getAttribute('src'),
        world.guide.src,
      );
      assert.ok(
        await page
          .locator('.quest-play-scene')
          .evaluate(
            (e, src) => getComputedStyle(e).backgroundImage.includes(src),
            world.background.src,
          ),
      );
      assert.equal(
        await page.locator('.quest-playfield').evaluate((e) => getComputedStyle(e).backgroundColor),
        'rgba(0, 0, 0, 0)',
      );
      assert.equal(await page.locator('.quest-play-navigation button').count(), 1);
      await fit();
      assert.ok(
        (await page.locator('.quest-playfield-progress progress').boundingBox()).width <= 201,
      );
      if (lesson.stage === 1) {
        await page.locator('.quest-letter-sticker').evaluate((img) => img.decode());
        assert.equal(stickers.length, 1, 'only the current letter is fetched');
        await page.getByRole('button', { name: 'Ẩn gợi ý', exact: true }).click();
        assert.equal(await page.locator('.quest-challenge .quest-hint').count(), 0);
        assert.equal(await page.locator('.keyboard .quest-target-key').count(), 0);
        await page.getByRole('button', { name: 'Hiện gợi ý', exact: true }).click();
        await page.getByRole('button', { name: 'Nghe mẫu', exact: true }).click();
        assert.match(await page.evaluate(() => window.spoken.at(-1)), /A/);
        await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
        const clock = await page.locator('.quest-playfield-time').innerText();
        await page.keyboard.press('KeyA');
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('.quest-playfield-time').innerText(), clock);
        assert.equal(
          await page.locator('.quest-playfield-progress progress').getAttribute('value'),
          '0',
        );
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Tiếp tục', exact: true })
          .click();
        const keyboard = await page.locator('.keyboard').boundingBox(),
          space = await page.getByRole('button', { name: 'Phím cách', exact: true }).boundingBox();
        assert.ok(space.y >= keyboard.y + keyboard.height);
        if (width === 1440) {
          const guide = await page.locator('.quest-playfield-guide').boundingBox(),
            tools = await page.locator('.quest-playfield-tools').boundingBox();
          assert.ok(guide.x + guide.width <= keyboard.x && tools.x >= keyboard.x + keyboard.width);
        }
        if (await page.locator('.tipy-companion').count())
          assert.equal(
            await page.locator('.tipy-companion').evaluate((e) => getComputedStyle(e).visibility),
            'hidden',
          );
        await page.screenshot({ path: `test-results/playfield/${width}-keys.png`, fullPage: true });
      }
      if (lesson.stage === 16) {
        assert.equal(await page.locator('.quest-target').innerText(), 'á');
        assert.equal(await page.locator('.quest-letter-sticker').count(), 0);
        const input = page.locator('textarea');
        await input.dispatchEvent('compositionstart');
        await input.fill('a\u0301');
        assert.ok(await page.getByRole('button', { name: 'Kiểm tra', exact: true }).isDisabled());
        await input.dispatchEvent('compositionend');
        await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
        await page.getByRole('heading', { name: 'à', exact: true }).waitFor();
        await page.screenshot({
          path: `test-results/playfield/${width}-vietnamese.png`,
          fullPage: true,
        });
      } else if ([1, 6, 12, 13, 15, 24].includes(lesson.stage)) {
        // Complete representative key, mixed, picture, missing-letter, sentence and profile lessons.
        const card = page.locator('.quest-challenge');
        assert.ok(await card.isVisible());
        for (const item of lesson.items) await answer(item);
        await page.getByText('Đã lưu vào tài khoản Zunimo.', { exact: true }).waitFor();
        await page.getByText('Nhận thêm 2 sao · Đã nhận đủ 3 sao', { exact: true }).waitFor();
        const expected = rows.reduce((sum, row) => sum + (row.awarded_stars || 0), 0);
        await page.waitForFunction(
          (total) =>
            document
              .querySelector('.account-points')
              ?.textContent.includes(`Sao của bạn: ${total}`),
          expected,
        );
      } else await answer(lesson.items[0]);
      await fit();
      await exit();
    }
    await page.reload();
    await page.locator('.adventure-map').waitFor();
    await page.getByRole('button', { name: 'Tiến bộ', exact: true }).click();
    assert.match(
      await page.locator('.quest-profile').innerText(),
      new RegExp(
        `${rows.reduce((s, r) => s + (r.awarded_stars || 0), 0)} ★\\s+sao bài học đã nhận`,
      ),
    );
    await page.getByRole('button', { name: 'Từ vựng', exact: true }).click();
    assert.equal(await page.locator('.quest-lesson').count(), 9);
    for (const lesson of LIBRARY_LESSONS) {
      await page
        .locator('.quest-lesson')
        .filter({ has: page.getByRole('heading', { name: lesson.title, exact: true }) })
        .getByRole('button')
        .click();
      await page.locator('.quest-player').waitFor();
      assert.equal(
        await page.locator('.quest-playfield,.quest-play-scene,.quest-letter-sticker').count(),
        0,
      );
      assert.equal(await page.locator('.panel.quest-player').count(), 1);
      await page.locator('.adventure-guide').waitFor();
      assert.ok(await page.locator('.quest-player form .tipy-button').count());
      await fit();
      await page
        .locator('.quest-player .quest-actions')
        .getByRole('button', { name: 'Bản đồ', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Thư viện từ vựng', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        lessons: 30,
        worlds: 5,
        completedTypes: 6,
        ime: true,
        pause: true,
        voice: true,
        hints: true,
        starsAndReload: true,
        vocabularyUnchanged: 9,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
