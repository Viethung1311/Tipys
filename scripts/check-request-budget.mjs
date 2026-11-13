import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4199'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const classOnly = process.argv.includes('--class-only');
const classes = classOnly
  ? [{ class_id: 'fixture-class', name: 'Lớp thử', archived_at: null }]
  : [];
try {
  await new Promise((r) => setTimeout(r, 1200));
  const page = await browser.newPage();
  const calls = [];
  await page.route('**/api/tipy*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    const action = route.request().postDataJSON()?.action || q.get('action');
    calls.push(action);
    const user = {
      user_id: 'fixture-student',
      role: 'student',
      full_name: 'Bạn thử',
      username: 'test',
    };
    const data = {
      bootstrap: { configured: true, user, games: [], classes },
      avatar: { avatar: { animal: 'icon_01' } },
      stars: { stars: 0 },
      classes: { classes },
      classroom: { classroom: classes[0], members: [], posts: [] },
      class_stars: {
        lessons: [],
        weekly: [],
        memberCount: 0,
        weekStart: '2026-11-09',
        currentWeek: '2026-11-09',
      },
      assessments: { items: [], total: 0, page: 1, pages: 1 },
    };
    await route.fulfill({ json: data[action] || {} });
  });
  const snapshot = () =>
    Object.fromEntries([...new Set(calls)].map((a) => [a, calls.filter((x) => x === a).length]));
  await page.goto('http://127.0.0.1:4199');
  await page.locator('.loading-fullscreen').waitFor({ state: 'hidden' });
  await page.locator('.account-points').getByText('Sao của bạn: 0').waitFor();
  const opening = snapshot();
  calls.length = 0;
  if (classOnly) {
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .getByRole('button', { name: 'Lớp học', exact: true })
      .click();
    await page.getByText('Chưa có học sinh', { exact: true }).waitFor();
    await page.waitForTimeout(300);
    console.log(JSON.stringify({ classroom: snapshot() }));
  } else {
    await page.waitForTimeout(60500);
    const idle = snapshot();
    calls.length = 0;
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await nav.getByRole('button', { name: 'Gõ chữ', exact: true }).click();
    await page.locator('.game-library').waitFor();
    await nav.getByRole('button', { name: 'Trang chủ', exact: true }).click();
    await page.waitForTimeout(300);
    const returnHome = snapshot();
    calls.length = 0;
    await nav.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
    await page.getByText('Chưa có bài kiểm tra nào', { exact: true }).waitFor();
    calls.length = 0;
    await page.waitForTimeout(31000);
    console.log(
      JSON.stringify({
        opening,
        idle60s: idle,
        typingAndHome: returnHome,
        examsIdle31s: snapshot(),
      }),
    );
  }
} finally {
  await browser.close();
  server.kill();
}
