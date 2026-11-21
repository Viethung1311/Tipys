/** Real React adapters -> HTTP dispatcher -> isolated SQL. Never touches production. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { hubFixture } from '../tests/hub-fixture.js';
import { id } from '../tests/teacher-fixture.js';
import { createAssessments } from '../server/modules/assessments.js';
import { createHandler } from '../api/tipy.js';
import { TEST_CONTENT } from '../src/features/assessments/content.js';
import { LEVELS } from '../src/game/config.js';
const dir = 'test-results/assessment-autosave',
  origin = 'http://127.0.0.1:4199';
mkdirSync(dir, { recursive: true });
writeFileSync(
  dir + '/index.html',
  '<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.jsx"></script></html>',
);
writeFileSync(
  dir + '/entry.jsx',
  `import React from 'react';import {createRoot} from 'react-dom/client';import Page from '../../src/features/assessments/AssessmentsPage.jsx';import {setApiIdentity} from '../../src/game/backend.js';import '../../src/index.css';import '../../src/styles/responsive.css';import '../../src/styles/tipy-ui.css';import '../../src/styles/loading.css';import '../../src/features/keyboard-quest/quest.css';const noop=()=>{};setApiIdentity(window.fixtureUser);createRoot(document.getElementById('root')).render(<React.StrictMode><Page user={window.fixtureUser} sound={noop} onPlayingChange={noop}/></React.StrictMode>);`,
);
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4199'],
  { windowsHide: true, stdio: 'ignore' },
);
const f = await hubFixture();
let browser;
const metrics = [],
  errors = [];
try {
  await f.db.exec(readFileSync('db/assessment_auto_finish.sql', 'utf8'));
  const service = createAssessments({
    rpc: f.rpc,
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { config: { levels: LEVELS } } }),
    }),
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const profile = await f.people(1);
  const handler = createHandler({
    env: { APP_ORIGIN: origin, NODE_ENV: 'development' },
    makeBackend: () => ({ ...service, session: async () => ({ profile }) }),
  });
  let number = 800;
  const publish = async (selection, schedule = { mode: 'always' }) => {
    const assessmentId = id(number++),
      row = await service.assessmentSave(f.admin, {
        assessmentId,
        requestId: crypto.randomUUID(),
        version: 0,
        title: 'Kiểm tra ' + number,
        targets: { classIds: [], userIds: [id(1)] },
        selection,
        schedule,
        repeats: { mode: 'unlimited' },
      });
    await service.assessmentPublish(f.admin, { assessmentId, version: row.version });
    return assessmentId;
  };
  const open = async (size, examId, { rejectFullscreen = true, failFinal = false } = {}) => {
    const page = await browser.newPage({
      viewport: size,
      reducedMotion: 'reduce',
      hasTouch: size.width < 600,
    });
    const calls = [];
    let lost = failFinal;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      ({ profile, rejectFullscreen }) => {
        window.fixtureUser = profile;
        if (rejectFullscreen)
          HTMLElement.prototype.requestFullscreen = () =>
            Promise.reject(Error('fixture fullscreen denied'));
      },
      { profile, rejectFullscreen },
    );
    await page.route('**/api/tipy*', async (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        query = Object.fromEntries(new URL(request.url()).searchParams),
        action = body?.action || query.action;
      calls.push({ action, body });
      let status = 200,
        json;
      await handler(
        {
          method: request.method(),
          headers: { origin, 'content-type': 'application/json' },
          query,
          body,
        },
        {
          setHeader() {},
          status(code) {
            status = code;
            return this;
          },
          json(value) {
            json = value;
          },
        },
      );
      if (action === 'assessment_submit' && lost) {
        lost = false;
        return route.fulfill({ status: 503, json: { error: 'Mất phản hồi sau khi đã lưu' } });
      }
      return route.fulfill({ status, json });
    });
    await page.goto(origin + '/' + dir + '/index.html');
    const card = () =>
      page.locator('.assessment-list-item').filter({
        has: page.getByRole('heading', {
          name: 'Kiểm tra ' + (Number(examId.slice(-12)) + 1),
          exact: true,
        }),
      });
    await card().getByRole('button', { name: 'Bắt đầu', exact: true }).waitFor();
    await card()
      .getByRole('button', { name: 'Bắt đầu', exact: true })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await page.locator('.assessment-runner').waitFor();
    assert.equal(calls.filter((c) => c.action === 'assessment_start').length, 1);
    return { page, calls, card };
  };
  const fit = async (page) => {
    const clipped = await page.locator('.play-surface').evaluate((root) => {
      const bounds = root.getBoundingClientRect();
      return [...root.querySelectorAll('.keyboard.touchboard,.quest-challenge,textarea,.arena')]
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({ name: el.className, rect: el.getBoundingClientRect().toJSON() }))
        .filter(
          ({ rect }) =>
            rect.bottom > bounds.bottom + 1 ||
            rect.top < bounds.top - 1 ||
            rect.right > bounds.right + 1 ||
            rect.left < bounds.left - 1,
        );
    });
    assert.deepEqual(clipped, []);
  };
  const resume = async (page) => {
    const button = page.getByRole('button', { name: 'Tiếp tục', exact: true });
    if (await button.count()) await button.last().click();
  };
  for (const size of [
    { width: 360, height: 800 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const item = TEST_CONTENT.find((x) => x.kind === 'text' && x.target === 'á');
    const examId = await publish({ questIds: ['keys-as-1', item.id], falling: null });
    const { page, calls, card } = await open(size, examId);
    await page.getByRole('button', { name: 'Gõ A', exact: true }).waitFor();
    await fit(page);
    assert.equal(await page.locator('.touchboard .key-row').count(), 4);
    const before = calls.length;
    await page.waitForTimeout(2200);
    assert.equal(calls.length, before, 'idle playing has no network');
    await page.getByRole('button', { name: 'Gõ A', exact: true }).click();
    await page.locator('textarea').waitFor();
    await page.locator('textarea').fill('bản nháp');
    await page.waitForTimeout(400);
    assert.equal(
      calls.filter((c) => c.action === 'assessment_checkpoint' || c.action === 'assessment_submit')
        .length,
      0,
    );
    await fit(page);
    await page.screenshot({ path: dir + '/' + size.width + '-keyboard.png' });
    await page.reload();
    await card().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.locator('textarea').waitFor();
    await resume(page);
    assert.equal(await page.locator('textarea').inputValue(), 'bản nháp');
    await page.locator('textarea').fill('');
    await page.getByRole('button', { name: 'Gõ á', exact: true }).click();
    await page.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
    assert.equal(calls.filter((c) => c.action === 'assessment_submit').length, 1);
    assert.equal(calls.filter((c) => c.action === 'assessment_checkpoint').length, 0);
    assert.ok((await page.locator('.play-result-scores').innerText()).includes('100'));
    const actions = await page.locator('.play-result-actions button').allTextContents();
    assert.deepEqual(actions, ['Quay lại', 'Làm lại']);
    await page.screenshot({ path: dir + '/' + size.width + '-result.png' });
    metrics.push({
      size,
      start: calls.filter((c) => c.action === 'assessment_start').length,
      playingWrites: 0,
      finish: calls.filter((c) => c.action === 'assessment_submit').length,
      reloadRestored: true,
    });
    await page.close();
  }
  // One combined attempt switches sections automatically; lost final response retries the same token.
  const mixed = await publish({
    questIds: ['keys-as-1'],
    falling: { difficulty: 'easy', keys: ['A'], targetScore: 15 },
  });
  const { page, calls } = await open({ width: 1280, height: 720 }, mixed, {
    rejectFullscreen: false,
    failFinal: true,
  });
  await page.locator('.letter[data-key="A"]').first().waitFor();
  await page.keyboard.press('A');
  await page.locator('.letter[data-key="A"]').first().waitFor();
  await page.keyboard.press('A');
  await page.locator('.quest-playfield').waitFor();
  await page.getByRole('button', { name: 'Gõ A', exact: true }).click();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).waitFor();
  assert.equal(await page.locator('.play-result').count(), 0);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
  const final = calls.filter((c) => c.action === 'assessment_submit');
  assert.equal(final.length, 2);
  assert.equal(final[0].body.requestId, final[1].body.requestId);
  assert.equal(
    (
      await f.q(
        'select count(*)::int n from assessment_attempts where assessment_id=$1 and submitted_at is not null',
        [mixed],
      )
    ).n,
    1,
  );
  assert.ok((await page.locator('.play-result-scores').innerText()).includes('20 điểm'));
  metrics.push({ mixedParts: true, lostAcknowledgement: true, finalRequests: 2, uniqueResults: 1 });
  await page.close();

  const timedId = await publish(
    { questIds: ['keys-as-1'], falling: null },
    {
      mode: 'scheduled',
      opensAt: new Date(Date.now() - 10000).toISOString(),
      closesAt: new Date(Date.now() + 35000).toISOString(),
    },
  );
  const timed = await open({ width: 360, height: 800 }, timedId);
  await timed.page
    .getByRole('heading', { name: 'Chưa hoàn thành', exact: true })
    .waitFor({ timeout: 45000 })
    .catch(async (error) => {
      writeFileSync(
        dir + '/deadline-failure.json',
        JSON.stringify(
          {
            calls: timed.calls,
            body: await timed.page.locator('body').innerText(),
            database: await f.q(
              'select payload,results,submitted_at,deadline,closed_reason from assessment_attempts where assessment_id=$1',
              [timedId],
            ),
          },
          null,
          2,
        ),
      );
      await timed.page.screenshot({ path: dir + '/deadline-failure.png' });
      throw error;
    });
  assert.equal(timed.calls.filter((c) => c.action === 'assessment_checkpoint').length, 1);
  assert.equal(timed.calls.filter((c) => c.action === 'assessment_submit').length, 1);
  assert.equal(await timed.page.getByRole('button', { name: 'Làm lại', exact: true }).count(), 0);
  metrics.push({
    scheduledSeconds: 35,
    evidenceRequests: 1,
    finishRequests: 1,
    retryAfterClose: false,
  });
  await timed.page.close();
  const touchId = await publish({ questIds: ['keys-as-1'], falling: null });
  const touch = await open({ width: 360, height: 800 }, touchId);
  await touch.page.getByRole('button', { name: 'Gõ S', exact: true }).evaluate((button) => {
    button.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' }),
    );
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  });
  await touch.page.getByRole('button', { name: 'Gõ A', exact: true }).tap();
  await touch.page.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
  const touchResult = await f.q('select results from assessment_attempts where assessment_id=$1', [
    touchId,
  ]);
  assert.equal(touchResult.results[0].wrong, 1);
  assert.equal(touch.calls.filter((c) => c.action === 'assessment_submit').length, 1);
  metrics.push({ touchSyntheticClick: true, wrongPresses: 1, finishRequests: 1 });
  await touch.page.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(metrics, null, 2));
  writeFileSync(dir + '/metrics.json', JSON.stringify(metrics, null, 2));
} finally {
  await browser?.close();
  server.kill();
  await f.db.close();
}
