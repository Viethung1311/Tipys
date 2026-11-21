import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results/guard-motion-fix', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
    const errors = [],
      failedAssets = [],
      api = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => failedAssets.push(r.url()));
    page.on('response', (r) => {
      if (r.status() >= 400) failedAssets.push(`${r.status()} ${r.url()}`);
    });
    page.on('request', (r) => {
      if (r.url().includes('/api/')) api.push({ method: r.method(), url: r.url() });
    });
    await page.addInitScript(() => {
      window.motionDraws = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
        if (/\/(flight|space)_/.test(image.src || '')) {
          window.motionDraws.push({ src: image.src.split('/').at(-1), args });
          if (window.motionDraws.length > 3000) window.motionDraws.splice(0, 1500);
        }
        return draw.call(this, image, ...args);
      };
    });
    await page.clock.install();
    await page.route('**/api/tipy**', (route) => route.fulfill({ json: { user: null } }));
    await page.goto('http://127.0.0.1:4208/dev/keyboard-guard');
    const primary = page.getByRole('button', {
      name: reducedMotion === 'reduce' ? 'Chơi có hiệu ứng bay' : 'Chơi',
      exact: true,
    });
    await primary.waitFor();
    await page.waitForFunction(() => !document.querySelector('.guard-intro .tipy-button').disabled);
    if (reducedMotion === 'reduce') {
      await page.getByRole('button', { name: 'Chơi ít chuyển động', exact: true }).click();
      await page.clock.runFor(1000);
      const quiet = await page.evaluate(() => window.motionDraws);
      assert.deepEqual(
        [...new Set(quiet.filter((d) => d.src.startsWith('flight_')).map((d) => d.src))],
        ['flight_01.png'],
      );
      assert.ok(
        quiet
          .filter((d) => d.src.startsWith('space_'))
          .every((d) => d.args[1] === -800 || d.args[1] === 0),
      );
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
      await page.getByRole('button', { name: 'Bật hiệu ứng bay', exact: true }).click();
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    } else await primary.click();
    await page.locator('.guard-battle').evaluate((e) => (window.motionArena = e));
    await page.evaluate(() => (window.motionDraws = []));
    await page.clock.runFor(15000);
    const moving = await page.evaluate(() => window.motionDraws);
    const flight = [
      ...new Set(moving.filter((d) => d.src.startsWith('flight_')).map((d) => d.src)),
    ];
    const bg = moving.filter((d) => d.src.startsWith('space_'));
    assert.equal(flight.length, 6);
    assert.ok(new Set(bg.map((d) => d.src + ':' + d.args[1])).size > 10);
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    const frozen = await page.locator('.guard-battle canvas').evaluate((c) => c.toDataURL());
    await page.clock.runFor(2000);
    assert.equal(await page.locator('.guard-battle canvas').evaluate((c) => c.toDataURL()), frozen);
    await page.getByRole('button', { name: 'Tắt hiệu ứng bay', exact: true }).click();
    assert.equal(
      await page.locator('.guard-battle').evaluate((e) => e === window.motionArena),
      true,
    );
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.evaluate(() => (window.motionDraws = []));
    await page.clock.runFor(400);
    const off = await page.evaluate(() => window.motionDraws);
    assert.deepEqual(
      [...new Set(off.filter((d) => d.src.startsWith('flight_')).map((d) => d.src))],
      ['flight_01.png'],
    );
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.getByRole('button', { name: 'Bật hiệu ứng bay', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    const target = page.locator('.guard-labels span:not([hidden])[data-state="falling"]').first();
    await page.locator('.guard-input-layer input').fill(await target.textContent());
    await page.clock.runFor(900);
    assert.ok((await page.locator('.guard-score').innerText()).includes('10'));
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.getByRole('button', { name: 'Rời lượt chơi', exact: true }).click();
    await primary.click();
    await page.clock.runFor(250);
    await page.screenshot({ path: `test-results/guard-motion-fix/${reducedMotion}.png` });
    assert.equal(
      await page.locator('.guard-battle canvas').getAttribute('data-motion-trace'),
      null,
    );
    assert.deepEqual(failedAssets, []);
    assert.ok(api.length >= 1);
    assert.ok(
      api.every(
        (r) => r.method === 'GET' && new URL(r.url).searchParams.get('action') === 'bootstrap',
      ),
    ); // Auth only; zero gameplay writes.
    assert.deepEqual(errors, []);
    reports.push({
      reducedMotion,
      flightFrames: flight.length,
      backgroundPositions: new Set(bg.map((d) => d.src + ':' + d.args[1])).size,
      pauseFrozen: true,
      authReads: api.length,
      gameplayWrites: 0,
      failedAssets,
      errors,
    });
    await page.close();
  }
  writeFileSync('test-results/guard-motion-fix/checks.json', JSON.stringify(reports, null, 2));
  console.log(reports);
} finally {
  await browser.close();
}
