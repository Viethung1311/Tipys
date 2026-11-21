import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { defaultGuardSettings } from '../src/features/keyboard-guard/settings.js';
const root = 'http://127.0.0.1:4208/dev/keyboard-guard';
const out = 'test-results/guard-waves';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
const quickSettings = () => {
  const s = defaultGuardSettings();
  s.stages[1].speed = 200;
  s.stages[1].waves = s.stages[1].waves.map((w) => ({
    ...w,
    totalTargets: 2,
    maxActive: 1,
    spawnSeconds: 0.5,
  }));
  return s;
};
async function open(page, settings = quickSettings(), role = 'admin') {
  const network = [],
    errors = [],
    failedAssets = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) network.push({ method: r.method(), url: r.url() });
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/guard-art/') && r.status() !== 200) failedAssets.push(r.url());
  });
  await page.route('**/api/tipy**', (r) =>
    r.fulfill({ json: { user: role ? { user_id: 'guard-test', role } : null } }),
  );
  await page.addInitScript((s) => {
    localStorage.setItem('tipy-guard-config-v1', JSON.stringify(s));
    window.guardTrace = {
      phase: 0,
      frames: {},
      hurt: {},
      lastMode: '',
      lastFrame: 0,
      shieldOnBoost: false,
      transitions: [],
      samples: [],
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      const t = window.guardTrace,
        src = image.src || '';
      const space = src.match(/space_0([1-4])/);
      if (space && args[1] >= 0 && args[1] < 800) t.phase = (Number(space[1]) - 1) * 200 + args[1];
      const sprite = src.match(/\/(flight|boost_vfx|boost|hurt)_0([1-6])\.png/);
      if (sprite) {
        const [, mode, frame] = sprite;
        if (t.lastMode !== mode) t.transitions.push(mode);
        t.lastMode = mode;
        t.lastFrame = Number(frame);
        t.frames[mode] ||= [];
        if (!t.frames[mode].includes(frame)) t.frames[mode].push(frame);
        if (mode === 'hurt') {
          const wave = document
            .querySelector('.guard-player')
            ?.textContent.match(/Đợt\s*(\d+)/)?.[1];
          t.hurt[wave] ||= [];
          if (!t.hurt[wave].includes(frame)) t.hurt[wave].push(frame);
        }
      }
      if (src.endsWith('/shield.png') && t.lastMode === 'boost_vfx') t.shieldOnBoost = true;
      return draw.call(this, image, ...args);
    };
  }, settings);
  await page.clock.install();
  await page.goto(root);
  await page.waitForFunction(
    () =>
      document.querySelector('.guard-intro .tipy-button') &&
      !document.querySelector('.guard-intro .tipy-button').disabled,
  );
  await page.getByRole('button', { name: 'Chơi', exact: true }).click();
  await page.clock.runFor(100);
  return { network, errors, failedAssets };
}
async function snapshot(page) {
  return page.evaluate(() => ({
    wave: Number(
      document.querySelector('.guard-player')?.textContent.match(/Đợt\s*(\d+)/)?.[1] || 0,
    ),
    hp: Number(document.querySelector('.guard-meters img')?.alt.match(/Máu (\d+)/)?.[1] || 0),
    energy: Number(
      document.querySelectorAll('.guard-meters img')[1]?.alt.match(/Năng lượng (\d+)/)?.[1] || 0,
    ),
    rest: !!document.querySelector('.guard-wave'),
    words: [...document.querySelectorAll('.guard-labels span:not([hidden])')]
      .filter(
        (e) =>
          e.dataset.state === 'falling' &&
          e.getBoundingClientRect().top >= e.parentElement.getBoundingClientRect().top + 10 &&
          e.getBoundingClientRect().bottom <= e.parentElement.getBoundingClientRect().bottom,
      )
      .map((e) => e.textContent),
    mode: window.guardTrace.lastMode,
    phase: window.guardTrace.phase,
    result: !!document.querySelector('.completion-screen'),
  }));
}
try {
  // A complete real UI play: deliberately take one hit in each of three waves.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const checks = await open(page),
      damaged = new Set(),
      saved = new Set();
    let previousHp = 5,
      pauseChecked = false;
    for (let i = 0; i < 1500; i++) {
      await page.clock.runFor(80);
      const s = await snapshot(page);
      if (s.hp && s.hp < previousHp) {
        damaged.add(s.wave);
        previousHp = s.hp;
      }
      if (damaged.has(s.wave) && !pauseChecked && s.mode === 'hurt') {
        await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
        const before = await page.evaluate(() => ({
          phase: window.guardTrace.phase,
          mode: window.guardTrace.lastMode,
          frame: window.guardTrace.lastFrame,
        }));
        await page.clock.runFor(2000);
        assert.deepEqual(
          await page.evaluate(() => ({
            phase: window.guardTrace.phase,
            mode: window.guardTrace.lastMode,
            frame: window.guardTrace.lastFrame,
          })),
          before,
        );
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        pauseChecked = true;
      }
      if (s.wave && !saved.has(s.wave) && s.mode !== 'hurt' && !s.rest) {
        await page.screenshot({ path: `${out}/wave-${s.wave}.png` });
        saved.add(s.wave);
      }
      if (s.rest && s.mode !== 'hurt')
        assert.equal(s.mode, ['flight', 'boost', 'boost_vfx'][s.wave - 1]);
      if (damaged.has(s.wave))
        for (const word of s.words) await page.locator('.guard-input-layer input').fill(word);
      if (await page.getByText('Hoàn thành tốt', { exact: true }).count()) break;
    }
    await page.getByText('Hoàn thành tốt', { exact: true }).waitFor();
    const trace = await page.evaluate(() => window.guardTrace);
    assert.deepEqual([...damaged], [1, 2, 3]);
    for (const mode of ['flight', 'boost', 'boost_vfx']) assert.equal(trace.frames[mode].length, 6);
    for (const wave of ['1', '2', '3']) assert.deepEqual(trace.hurt[wave].sort(), ['1', '2', '3']);
    assert.ok(pauseChecked);
    await page.getByText('30 điểm', { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/result.png` });
    await page.getByRole('button', { name: 'Chơi lại', exact: true }).click();
    await page.clock.runFor(100);
    assert.equal((await snapshot(page)).wave, 1);
    assert.equal((await snapshot(page)).mode, 'flight');
    assert.equal((await snapshot(page)).hp, 5);
    assert.equal(checks.network.length, 1);
    assert.equal(checks.network[0].method, 'GET');
    assert.deepEqual(checks.errors, []);
    assert.deepEqual(checks.failedAssets, []);
    report.push({
      scenario: 'three waves with real collisions',
      sprites: Object.fromEntries(
        ['flight', 'boost', 'boost_vfx'].map((m) => [m, trace.frames[m].length]),
      ),
      hurtByWave: trace.hurt,
      pauseFrozen: true,
      replayFlight: true,
      authReads: 1,
      writes: 0,
    });
    await page.close();
  }
  // Five destroyed targets charge the shield; last target collides while boost VFX stays on.
  {
    const page = await browser.newPage();
    const checks = await open(page);
    let charged = false;
    const history = [];
    for (let i = 0; i < 1200; i++) {
      await page.clock.runFor(80);
      const s = await snapshot(page);
      const key = [s.wave, s.hp, s.energy, s.words.join(',')].join(':');
      if (history.at(-1) !== key) history.push(key);
      if (s.energy === 5) charged = true;
      if (!charged)
        for (const word of s.words) await page.locator('.guard-input-layer input').fill(word);
      if (await page.getByText('Hoàn thành tốt', { exact: true }).count()) break;
    }
    if (!(await page.getByText('50 điểm', { exact: true }).count()))
      console.log({
        shieldHistory: history,
        trace: await page.evaluate(() => window.guardTrace),
        state: await snapshot(page),
      });
    await page.getByText('50 điểm', { exact: true }).waitFor();
    const trace = await page.evaluate(() => window.guardTrace);
    assert.ok(charged);
    assert.ok(trace.shieldOnBoost);
    if (trace.frames.hurt) console.log({ shieldScenario: history, hurt: trace.hurt });
    assert.equal(trace.frames.hurt, undefined);
    assert.deepEqual(checks.errors, []);
    report.push({
      scenario: 'charged shield in wave 3',
      shieldOnBoost: true,
      hurtOnShield: false,
      writes: checks.network.filter((r) => r.method !== 'GET').length,
    });
    await page.close();
  }
  // Movement ratios in a real render, at each wave's multiplier (source clocks remain local).
  {
    const page = await browser.newPage();
    await open(page);
    const speeds = [];
    for (const wave of [1, 2, 3]) {
      for (let n = 0; n < 1000; n++) {
        const s = await snapshot(page);
        if (s.wave === wave && !s.rest) break;
        for (const word of s.words) await page.locator('.guard-input-layer input').fill(word);
        await page.clock.runFor(100);
      }
      await page.clock.runFor(650);
      const first = await snapshot(page);
      await page.clock.runFor(1000);
      const second = await snapshot(page);
      const delta = (second.phase - first.phase + 800) % 800;
      assert.ok(Math.abs(delta - [100, 125, 160][wave - 1]) < 3);
      speeds.push(delta);
      for (let n = 0; n < 1000; n++) {
        const s = await snapshot(page);
        if (!s.wave || s.wave > wave || s.rest) break;
        for (const word of s.words) await page.locator('.guard-input-layer input').fill(word);
        await page.clock.runFor(100);
      }
    }
    report.push({
      scenario: 'effective speed base 2x',
      backgroundPerSecond: speeds,
      expected: [100, 125, 160],
    });
    await page.close();
  }
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const checks = await open(page);
    const baseline = checks.network.length;
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
    const form = page.locator('.guard-settings');
    await form.getByLabel('Đợt cấu hình').selectOption('1');
    assert.equal(await form.getByLabel('Hệ số tốc độ đợt', { exact: true }).inputValue(), '1.25');
    await form.getByLabel('Hệ số tốc độ đợt', { exact: true }).fill('1.5');
    await form.getByLabel('Tổng thiên thạch trong đợt', { exact: true }).fill('3');
    await form.getByLabel('Tối đa cùng lúc', { exact: true }).fill('2');
    await form.getByLabel('Khoảng xuất hiện (giây)', { exact: true }).fill('1.2');
    await form.getByLabel('Nhịp sprite (FPS)', { exact: true }).fill('14');
    await form.getByRole('button', { name: 'Lưu', exact: true }).click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tipy-guard-config-v1')),
    );
    assert.deepEqual(saved.stages[1].waves[1], {
      speed: 150,
      totalTargets: 3,
      maxActive: 2,
      spawnSeconds: 1.2,
      fps: 14,
    });
    await form.getByLabel('Màn cấu hình').selectOption('2');
    await form.getByLabel('Tốc độ màn', { exact: true }).fill('0.5');
    await form.getByLabel('Màn cấu hình').selectOption('1');
    assert.equal(await form.getByLabel('Hệ số tốc độ đợt', { exact: true }).inputValue(), '1.5');
    await form.getByRole('button', { name: 'Lưu', exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('tipy-guard-config-v1')).stages[2].speed,
      ),
      115,
    );
    await form.getByLabel('Tối đa cùng lúc', { exact: true }).fill('6');
    await form.getByRole('button', { name: 'Lưu', exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('tipy-guard-config-v1')).stages[1].waves[1].maxActive,
      ),
      2,
    );
    await form.getByRole('button', { name: 'Khôi phục mặc định', exact: true }).click();
    assert.equal(await form.getByLabel('Hệ số tốc độ đợt', { exact: true }).inputValue(), '1.25');
    await form.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.screenshot({ path: `${out}/settings-${width}.png` });
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.getByText('Đã phá 0/6', { exact: true }).waitFor(); // unchanged active run snapshot
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.getByRole('button', { name: 'Rời lượt chơi', exact: true }).click();
    await page.getByRole('button', { name: 'Chơi', exact: true }).click();
    await page.clock.runFor(100);
    await page.getByText('Đã phá 0/15', { exact: true }).waitFor(); // saved defaults on next run
    assert.equal(checks.network.length, baseline);
    assert.deepEqual(checks.errors, []);
    report.push({
      width,
      height,
      waveFieldsSaved: true,
      invalidBlocked: true,
      selectedStageOnly: true,
      snapshotUnchanged: true,
      nextRunApplied: true,
      settingsRequests: 0,
    });
    await page.close();
  }
  for (const role of ['teacher', 'student', null]) {
    const page = await browser.newPage();
    const checks = await open(page, quickSettings(), role);
    assert.equal(await page.getByRole('button', { name: 'Cài đặt', exact: true }).count(), 0);
    assert.deepEqual(checks.errors, []);
    report.push({ role, settingsVisible: false });
    await page.close();
  }
  writeFileSync(`${out}/checks.json`, JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
