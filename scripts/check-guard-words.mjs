import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results/guard-words', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
const visible = (page) =>
  page.locator('.guard-labels span:not([hidden])').evaluateAll((nodes) =>
    nodes
      .filter((e) => {
        const b = e.getBoundingClientRect(),
          p = e.parentElement.getBoundingClientRect();
        return b.y >= p.y && b.y + b.height <= p.y + p.height;
      })
      .map((e) => ({
        word: e.textContent,
        active: e.dataset.active,
        box: e.getBoundingClientRect().toJSON(),
      })),
  );
try {
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [844, 390],
    [320, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [],
      api = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/api/')) api.push(r.method());
    });
    await page.clock.install();
    await page.route('**/api/tipy**', (route) => route.fulfill({ json: { user: null } }));
    await page.goto('http://127.0.0.1:4208/dev/keyboard-guard');
    await page.waitForFunction(
      () =>
        document.querySelector('.guard-intro .tipy-button') &&
        !document.querySelector('.guard-intro .tipy-button').disabled,
    );
    await page.getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.clock.runFor(6500);
    assert.equal(await page.locator('.touchboard').count(), 0);
    assert.equal(await page.getByRole('button', { name: /Ẩn phím|Hiện phím/ }).count(), 0);
    const input = page.locator('.guard-input-layer input');
    const first = (await visible(page))[0];
    assert.ok(first);
    assert.ok(first.word.length > 1);
    await input.fill(first.word[0]);
    await page.clock.runFor(16);
    assert.equal((await visible(page)).find((e) => e.word === first.word).active, 'true');
    await input.fill(first.word[0] + 'x');
    assert.equal(await page.locator('.guard-input-layer').getAttribute('data-feedback'), 'wrong');
    await input.press('Backspace');
    assert.equal(await input.inputValue(), first.word[0]);
    await input.dispatchEvent('compositionstart');
    await input.fill(first.word);
    assert.equal(
      await page.locator('.guard-input-layer').getAttribute('data-feedback'),
      'composing',
    );
    assert.equal(await page.locator('.guard-score strong').textContent(), '0');
    await input.dispatchEvent('compositionend', { data: first.word });
    assert.equal(await input.inputValue(), '');
    await input.evaluate((el, word) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, word);
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: word }),
      );
    }, first.word);
    await page.clock.runFor(1500);
    assert.equal(await page.locator('.guard-score strong').textContent(), '10');
    await page.getByRole('img', { name: 'Năng lượng 1/5', exact: true }).waitFor();
    assert.equal(await input.inputValue(), '');
    await page.screenshot({ path: `test-results/guard-words/${width}.png` });
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    const draft = await input.inputValue();
    await page.clock.runFor(2000);
    assert.equal(await input.inputValue(), draft);
    await page.setViewportSize({ width: height, height: width });
    await page.clock.runFor(100);
    await page.setViewportSize({ width, height });
    await page.clock.runFor(100);
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    if (width === 1440) {
      const candidates = await visible(page);
      if (candidates.length) {
        await input.fill(candidates[0].word[0]);
        await page.clock.runFor(26000);
        assert.equal(await input.inputValue(), '');
      }
      for (let n = 0; n < 500 && !(await page.locator('.play-result').count()); n++) {
        const words = await visible(page);
        for (let i = 0; i < words.length; i++)
          for (let j = i + 1; j < words.length; j++) {
            const a = words[i].box,
              b = words[j].box;
            assert.equal(
              a.x < b.x + b.width &&
                a.x + a.width > b.x &&
                a.y < b.y + b.height &&
                a.y + a.height > b.y,
              false,
            );
          }
        if (words.length) await input.fill(words[0].word);
        await page.clock.runFor(500);
      }
      await page.locator('.play-result').waitFor();
      await page.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
      assert.ok((await page.locator('.play-result').innerText()).includes('điểm'));
      await page.getByRole('button', { name: 'Chơi lại', exact: true }).click();
      await page.clock.runFor(100);
      assert.equal(await page.locator('.guard-score strong').textContent(), '0');
      assert.equal(await input.inputValue(), '');
    }
    if (await page.locator('.guard-game').count()) {
      await page.getByRole('button', { name: 'Thoát', exact: true }).click();
      await page.getByRole('button', { name: 'Rời lượt chơi', exact: true }).click();
    }
    assert.deepEqual(errors, []);
    assert.ok(api.length >= 1);
    assert.ok(api.every((method) => method === 'GET')); // Auth only; zero gameplay writes.
    report.push({
      width,
      height,
      word: first.word,
      imeOnce: true,
      authReads: api.length,
      gameplayWrites: 0,
      errors,
    });
    await page.close();
  }
  for (const [speed, shipPercent, meteorPercent] of [
    [50, 50, 50],
    [175, 120, 120],
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(
      (settings) => {
        localStorage.setItem('tipy-guard-config-v1', JSON.stringify(settings));
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        window.guardSizes = {};
        CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
          if (image.src?.includes('/flight_')) window.guardSizes.ship = args.at(-1);
          if (image.src?.includes('/meteor.png')) window.guardSizes.meteor = args.at(-1);
          return draw.call(this, image, ...args);
        };
      },
      {
        version: 1,
        shipPercent,
        meteorPercent,
        stages: { 1: { speed }, 2: { speed: 115 }, 3: { speed: 130 } },
      },
    );
    await page.clock.install();
    await page.route('**/api/tipy**', (route) => route.fulfill({ json: { user: null } }));
    await page.goto('http://127.0.0.1:4208/dev/keyboard-guard');
    await page.waitForFunction(
      () =>
        document.querySelector('.guard-intro .tipy-button') &&
        !document.querySelector('.guard-intro .tipy-button').disabled,
    );
    await page.getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.clock.runFor(300);
    const dimensions = await page.evaluate(() => window.guardSizes);
    assert.ok(Math.abs(dimensions.ship - (((96 * shipPercent) / 100) * 512) / 318) < 1e-7);
    assert.ok(Math.abs(dimensions.meteor - (70 * meteorPercent) / 100) < 1e-7);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('tipy-guard-config-v1'));
      s.shipPercent = 80;
      s.meteorPercent = 80;
      localStorage.setItem('tipy-guard-config-v1', JSON.stringify(s));
    });
    await page.clock.runFor(500);
    assert.deepEqual(await page.evaluate(() => window.guardSizes), dimensions);
    report.push({ speed, shipPercent, meteorPercent, snapshotStable: true });
    await page.close();
  }
  // Shared online settings and role checks are covered by check-guard-release.mjs.
  writeFileSync('test-results/guard-words/checks.json', JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
