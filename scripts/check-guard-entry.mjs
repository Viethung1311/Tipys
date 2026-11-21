import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results/guard-entry', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
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
      if (r.url().includes('/api/')) api.push({ method: r.method(), url: r.url() });
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
    await page.clock.runFor(100);
    const stage = page.locator('.guard-battle'),
      labels = page.locator('.guard-labels span:not([hidden])'),
      meters = page.locator('.guard-meters');
    const bounds = await stage.boundingBox(),
      m = await meters.boundingBox();
    assert.ok(Math.abs(m.width / (bounds.width - 4) - 0.3) < 0.002);
    assert.ok(Math.abs(bounds.x + bounds.width - m.x - m.width - 14) < 1);
    assert.ok(Math.abs(m.y - bounds.y - 14) < 1);
    const first = await labels.first().boundingBox();
    assert.ok(first.y + first.height < bounds.y, JSON.stringify({ bounds, first }));
    let seen = 1;
    for (let n = 0; n < 60; n++) {
      await page.clock.runFor(100);
      const count = await labels.count();
      if (count > seen) {
        const born = await labels.nth(count - 1).boundingBox();
        assert.ok(born.y + born.height < bounds.y);
        seen = count;
      }
      for (const label of await labels.all()) {
        const box = await label.boundingBox();
        assert.ok(box.x >= bounds.x);
        assert.ok(box.x + box.width <= bounds.x + bounds.width);
        const overlaps =
          box.x < m.x + m.width &&
          box.x + box.width > m.x &&
          box.y < m.y + m.height &&
          box.y + box.height > m.y;
        assert.equal(overlaps, false);
      }
    }
    assert.ok(seen >= 2);
    await page.screenshot({ path: `test-results/guard-entry/${width}.png` });
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    const positions = await labels.evaluateAll((nodes) => nodes.map((e) => e.style.cssText));
    await page.clock.runFor(3000);
    assert.deepEqual(
      await labels.evaluateAll((nodes) => nodes.map((e) => e.style.cssText)),
      positions,
    );
    // All six predecoded image levels must keep exactly the same two image boxes.
    const boxes = await meters
      .locator('img')
      .evaluateAll((nodes) =>
        nodes.map((e) => ({ src: e.src, box: JSON.stringify(e.getBoundingClientRect().toJSON()) })),
      );
    for (let i = 0; i < 6; i++) {
      await meters.evaluate(async (el, i) => {
        const imgs = [...el.querySelectorAll('img')];
        imgs[0].src = `/guard-art/hp_${i}.png`;
        imgs[1].src = `/guard-art/energy_${i}.png`;
        await Promise.all(imgs.map((im) => im.decode()));
      }, i);
      const current = await meters
        .locator('img')
        .evaluateAll((nodes) =>
          nodes.map((e) => JSON.stringify(e.getBoundingClientRect().toJSON())),
        );
      assert.deepEqual(
        current,
        boxes.map((b) => b.box),
      );
    }
    await meters.evaluate(
      (el, sources) => [...el.querySelectorAll('img')].forEach((im, i) => (im.src = sources[i])),
      boxes.map((b) => b.src),
    );
    await stage.evaluate((e) => (window.entryStage = e));
    await page.setViewportSize({ width: height, height: width });
    await page.clock.runFor(100);
    assert.equal(await stage.evaluate((e) => e === window.entryStage), true);
    await page.setViewportSize({ width, height });
    await page.clock.runFor(100);
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.clock.runFor(500);
    const oldIds = await labels.evaluateAll((nodes) => nodes.map((n) => n.dataset.targetId));
    const key = await labels.first().textContent();
    await page.locator('.guard-input-layer input').fill(key);
    let resumedSpawn = false;
    for (let i = 0; i < 400; i++) {
      await page.clock.runFor(16);
      if ((await labels.count()) >= 2) {
        const born = await labels.last().boundingBox();
        const id = await labels.last().getAttribute('data-target-id');
        if (!oldIds.includes(id) && born.y + born.height < bounds.y) {
          resumedSpawn = true;
          break;
        }
      }
    }
    assert.equal(resumedSpawn, true);
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.getByRole('button', { name: 'Rời lượt chơi', exact: true }).click();
    await page.getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.clock.runFor(100);
    const replay = await labels.first().boundingBox(),
      replayBounds = await stage.boundingBox();
    assert.ok(replay.y + replay.height < replayBounds.y);
    assert.deepEqual(errors, []);
    assert.ok(api.length >= 1);
    assert.ok(
      api.every(
        (r) => r.method === 'GET' && new URL(r.url).searchParams.get('action') === 'bootstrap',
      ),
    ); // Auth only; zero gameplay writes.
    report.push({
      width,
      height,
      meterWidthRatio: m.width / (bounds.width - 4),
      initialLabelBottom: first.y + first.height,
      stageTop: bounds.y,
      observedSpawns: seen,
      resumedSpawnAboveTop: resumedSpawn,
      levelsStable: true,
      authReads: api.length,
      gameplayWrites: 0,
    });
    await page.close();
  }
  writeFileSync('test-results/guard-entry/checks.json', JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
