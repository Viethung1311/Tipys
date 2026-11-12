/** Real API validation + SQL against an isolated PGlite database. Never publishes to real classes. */
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from '@playwright/test';
import { createAssessments } from '../server/modules/assessments.js';
import { createHandler } from '../api/tipy.js';
import { LEVELS } from '../src/game/config.js';
import { studentPage } from '../tests/student-page-fixture.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const origin = 'http://127.0.0.1:4198';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4198'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync('test-results/assessments', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 1200));
  for (const width of [320, 768, 1440]) {
    const db = new PGlite(),
      pages = [];
    try {
      await db.exec(
        `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);`,
      );
      for (const file of [
        'schema',
        'compact_results',
        'classrooms',
        'keyboard_quest',
        'stars',
        'student_actions',
        'lesson_star_upgrades',
        'assessments',
        'assessment_policies',
      ])
        await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
      for (const n of [...Array.from({ length: 15 }, (_, i) => i + 1), 99])
        await db.query('insert into auth.users values($1,$2,$3)', [
          id(n),
          {
            username: n === 99 ? 'teacher' : `kid${String(n).padStart(2, '0')}`,
            full_name: n === 99 ? 'Giáo viên thử' : `Học sinh ${n}`,
          },
          {},
        ]);
      await db.query("update profiles set role='admin' where user_id=$1", [id(99)]);
      await db.query("insert into classes(class_id,name,created_by) values($1,'Lớp thử A',$2)", [
        id(50),
        id(99),
      ]);
      await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(1)]);
      const writes = [],
        errors = [];
      const failPages = new WeakSet();
      const service = createAssessments({
        from: () => ({
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({ data: { config: { levels: LEVELS } } }),
        }),
        rpc: async (name, args) => {
          try {
            return {
              data: (
                await db.query('select tipy_assessment($1,$2,$3) data', [
                  args.p_actor,
                  args.p_action,
                  args.p_input,
                ])
              ).rows[0].data,
            };
          } catch (e) {
            return { error: { message: e.message } };
          }
        },
      });
      const classList = async (n) =>
        n === 99 ||
        (
          await db.query('select is_active from class_members where class_id=$1 and user_id=$2', [
            id(50),
            id(n),
          ])
        ).rows[0]?.is_active
          ? [{ class_id: id(50), name: 'Lớp thử A', archived_at: null }]
          : [];
      const makePage = async (n) => {
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: 'reduce',
        });
        await page.addInitScript(() => {
          window.__recordNotes = 0;
          const original = AudioParam.prototype.setValueAtTime;
          AudioParam.prototype.setValueAtTime = function (value, ...args) {
            if (value === 1320) window.__recordNotes++;
            return original.call(this, value, ...args);
          };
        });
        pages.push(page);
        page.on('pageerror', (e) => errors.push(e.message));
        const profile = (await db.query('select * from profiles where user_id=$1', [id(n)]))
          .rows[0];
        const handler = createHandler({
          env: { APP_ORIGIN: origin, NODE_ENV: 'development' },
          makeBackend: () => ({ ...service, session: async () => ({ profile }) }),
        });
        await page.route('**/api/tipy*', async (route) => {
          const req = route.request(),
            query = Object.fromEntries(new URL(req.url()).searchParams),
            body = req.postDataJSON(),
            action = body?.action || query.action;
          if (body) writes.push(body);
          if (action === 'bootstrap')
            return route.fulfill({
              json: { configured: true, user: profile, games: [], classes: await classList(n) },
            });
          if (action === 'avatar')
            return route.fulfill({ json: { avatar: { animal: 'icon_01' } } });
          if (action === 'stars') return route.fulfill({ json: { stars: 0 } });
          if (action === 'classes') return route.fulfill({ json: { classes: await classList(n) } });
          if (action === 'students_page') {
            const rows = (
              await db.query(
                "select *,0 as total_active_seconds,0 as total_plays from profiles where role='student' order by user_id",
              )
            ).rows.map((s) => ({ ...s, class_members: [] }));
            return route.fulfill({ json: studentPage(rows, new URLSearchParams(query)) });
          }
          if (action.startsWith('assessment')) {
            if (action === 'assessments' && failPages.has(page))
              return route.fulfill({ status: 503, json: { error: 'Lỗi tải thử' } });
            let status = 200,
              json;
            await handler(
              {
                method: req.method(),
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
                json(data) {
                  json = data;
                },
              },
            );
            return route.fulfill({ status, json });
          }
          if (['start', 'progress', 'quest_finish'].includes(action))
            return route.fulfill({
              status: 500,
              json: { error: 'Practice endpoint must not run for tests' },
            });
          return route.fulfill({ json: {} });
        });
        return page;
      };
      const teacher = await makePage(99),
        student = await makePage(1),
        direct = await makePage(9),
        outsider = await makePage(3);
      const fit = async (page) =>
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `overflow at ${width}`,
        );
      await teacher.goto(origin + '/admin');
      await teacher.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
      await teacher.getByText('Chưa có bài kiểm tra nào', { exact: true }).waitFor();
      await teacher.getByRole('button', { name: 'Tạo mới', exact: true }).click();
      await teacher.getByLabel('Tên bài kiểm tra', { exact: true }).fill('Bài kiểm tra vui');
      await teacher.getByLabel('Giới thiệu', { exact: true }).fill('Cùng thử hai phần chơi.');
      await teacher.getByLabel('Cách chơi', { exact: true }).fill('Làm từng phần rồi bấm Nộp bài.');
      await teacher.getByRole('checkbox', { name: 'Lớp thử A', exact: true }).check();
      await teacher.getByLabel('Tìm học sinh nhận riêng', { exact: true }).fill('kid09');
      await teacher.getByRole('checkbox', { name: 'Học sinh 9 · kid09', exact: true }).check();
      await teacher.getByLabel('Tìm học sinh nhận riêng', { exact: true }).fill('');
      await teacher
        .getByText('Đã chọn riêng 1 học sinh, giữ lựa chọn khi đổi trang.', { exact: true })
        .waitFor();
      await teacher.getByRole('checkbox', { name: 'Thêm phần Chữ rơi', exact: true }).check();
      await teacher.getByLabel('Điểm hoàn thành tốt', { exact: true }).fill('10');
      const picker = teacher.locator('.assessment-picker'),
        search = picker.getByRole('searchbox');
      await search.fill('Hai người bạn A, S');
      await picker
        .getByRole('button', { name: 'Chọn tất cả kết quả đang lọc (10)', exact: true })
        .click();
      await picker
        .getByRole('button', { name: 'Chọn tất cả kết quả đang lọc (10)', exact: true })
        .click();
      await picker.getByRole('status').getByText('Đã chọn 10 mục', { exact: false }).waitFor();
      await search.fill('Phép thuật Telex');
      await picker.getByRole('button', { name: /Chọn tất cả kết quả đang lọc/ }).click();
      await picker.getByRole('status').getByText('Đã chọn 21 mục', { exact: false }).waitFor();
      await picker.getByRole('button', { name: 'Bỏ chọn trong màn', exact: true }).click();
      await picker.getByRole('checkbox', { name: 'á', exact: true }).check();
      await search.fill('Hai người bạn A, S');
      await picker.getByRole('button', { name: 'Bỏ chọn trong màn', exact: true }).click();
      await picker.getByRole('checkbox', { name: 'A', exact: true }).first().check();
      await picker.getByRole('checkbox', { name: 'S', exact: true }).first().check();
      await search.fill('');
      await picker.getByRole('status').getByText('Đã chọn 3 mục', { exact: false }).waitFor();
      await teacher.getByRole('button', { name: 'Xem trước', exact: true }).click();
      await teacher.getByRole('button', { name: 'Gửi bài', exact: true }).waitFor();
      await fit(teacher);
      await teacher.screenshot({
        path: `test-results/assessments/${width}-preview.png`,
        fullPage: true,
      });
      const examId = writes.find((w) => w.action === 'assessment_save').assessmentId;
      await student.goto(origin + '/#tests');
      await student.getByText('Chưa có bài kiểm tra nào', { exact: true }).waitFor();
      const draftRead = await student.evaluate(async (examId) => {
        const r = await fetch(
          '/api/tipy?' + new URLSearchParams({ action: 'assessment', assessmentId: examId }),
        );
        return r.status;
      }, examId);
      assert.equal(draftRead, 403);
      await teacher.reload();
      await teacher.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
      await teacher.getByRole('button', { name: 'Sửa / Xem trước', exact: true }).click();
      await teacher.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
      assert.equal(
        await teacher.getByRole('checkbox', { name: 'Thêm phần Chữ rơi', exact: true }).isChecked(),
        true,
      );
      await picker.getByRole('status').getByText('Đã chọn 3 mục', { exact: false }).waitFor();
      await teacher.getByLabel('Tên bài kiểm tra', { exact: true }).fill('Bài kiểm tra đã chỉnh');
      await teacher.getByRole('button', { name: 'Xem trước', exact: true }).click();
      await teacher.getByRole('button', { name: 'Gửi bài', exact: true }).click();
      await teacher.getByText('Đã gửi bài kiểm tra cho học sinh.', { exact: true }).waitFor();
      await student.reload();
      await student.getByRole('button', { name: 'Xem bài', exact: true }).click();
      await student.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
      await student
        .locator('.assessment-section-list article')
        .filter({ hasText: 'Gõ và viết chữ' })
        .getByRole('button')
        .click();
      const input = student.locator('textarea');
      await input.waitFor();
      await input.dispatchEvent('compositionstart');
      await input.fill('a\u0301');
      assert.ok(await student.getByRole('button', { name: 'Kiểm tra', exact: true }).isDisabled());
      await input.dispatchEvent('compositionend');
      await student.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
      await student.getByText('Đã lưu', { exact: true }).waitFor();
      await student.reload();
      await student.getByRole('button', { name: 'Xem bài', exact: true }).click();
      await student.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
      await student
        .locator('.assessment-section-list article')
        .filter({ hasText: 'Gõ và viết chữ' })
        .getByRole('button')
        .click();
      await student.getByRole('button', { name: 'Gõ A', exact: true }).waitFor();
      await student.getByRole('button', { name: 'Gõ A', exact: true }).click();
      await student.getByRole('button', { name: 'Gõ S', exact: true }).click();
      await student
        .getByText('Đã lưu phần làm bài. Bạn vẫn cần bấm Nộp bài.', { exact: true })
        .waitFor();
      assert.doesNotMatch(
        await student.locator('.assessment-section-result').innerText(),
        /Nhận thêm|sao thành tích/,
      );
      await student
        .locator('.assessment-section-result')
        .getByRole('button', { name: 'Các phần', exact: true })
        .click();
      await student
        .locator('.assessment-section-list article')
        .filter({ hasText: 'Chữ rơi' })
        .getByRole('button')
        .click();
      await student.locator('.countdown').waitFor({ state: 'hidden' });
      for (let i = 0; i < 6; i++) await student.keyboard.press('KeyZ');
      await student
        .getByRole('heading', { name: 'Đã kết thúc phần Chữ rơi', exact: true })
        .waitFor();
      await student
        .locator('.assessment-section-result')
        .getByRole('button', { name: 'Các phần', exact: true })
        .click();
      await student
        .locator('.assessment-run-header')
        .getByRole('button', { name: 'Nộp bài', exact: true })
        .click();
      await student.getByRole('heading', { name: 'Cần luyện thêm', exact: true }).waitFor();
      await fit(student);
      await student.screenshot({
        path: `test-results/assessments/${width}-submitted.png`,
        fullPage: true,
      });
      await direct.goto(origin + '/#tests');
      await direct.getByRole('button', { name: 'Xem bài', exact: true }).waitFor();
      await outsider.goto(origin + '/#tests');
      await outsider.getByText('Chưa có bài kiểm tra nào', { exact: true }).waitFor();
      failPages.add(outsider);
      await outsider.reload();
      await outsider.getByRole('alert').waitFor();
      assert.match(await outsider.getByRole('alert').innerText(), /Lỗi tải thử/);
      assert.equal(
        await outsider.getByText('Chưa có bài kiểm tra nào', { exact: true }).count(),
        0,
      );
      failPages.delete(outsider);
      await outsider.getByRole('button', { name: 'Tải lại', exact: true }).click();
      await outsider.getByText('Chưa có bài kiểm tra nào', { exact: true }).waitFor();
      const denied = await outsider.evaluate(async (examId) => {
        const r = await fetch(
          '/api/tipy?' + new URLSearchParams({ action: 'assessment', assessmentId: examId }),
        );
        return { status: r.status, text: await r.text() };
      }, examId);
      assert.equal(denied.status, 403);
      assert.doesNotMatch(denied.text, /Gõ và viết chữ|Phép thuật/);
      await teacher.getByRole('button', { name: 'Danh sách', exact: true }).click();
      await teacher.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
      await teacher.getByRole('button', { name: 'Cho làm lại', exact: true }).click();
      await teacher.getByText('Đã cho làm lại', { exact: true }).waitFor();
      await student.reload();
      await student.getByRole('button', { name: 'Xem bài', exact: true }).click();
      await student.getByRole('button', { name: 'Làm lại', exact: true }).click();
      await student
        .locator('.assessment-run-header')
        .getByRole('button', { name: 'Nộp bài', exact: true })
        .click();
      await student
        .getByRole('dialog')
        .getByRole('button', { name: 'Nộp bài', exact: true })
        .click();
      await student.getByRole('heading', { name: 'Cần luyện thêm', exact: true }).waitFor();
      // Separate fixture exercises the new table, successful target, repeat cap and deletion without real users.
      const extraId = id(500),
        fixtureAdmin = { user_id: id(99), role: 'admin' };
      const extraDraft = await service.assessmentSave(fixtureAdmin, {
        assessmentId: extraId,
        requestId: crypto.randomUUID(),
        version: 0,
        title: 'Bài mục tiêu thử',
        targets: { classIds: [], userIds: Array.from({ length: 15 }, (_, i) => id(i + 1)) },
        repeats: { mode: 'limited', extra: 1 },
        selection: { questIds: [], falling: { difficulty: 'easy', keys: ['A'], targetScore: 10 } },
      });
      await service.assessmentPublish(fixtureAdmin, {
        assessmentId: extraId,
        version: extraDraft.version,
      });
      await direct.reload();
      await direct
        .locator('article')
        .filter({ hasText: 'Bài mục tiêu thử' })
        .getByRole('button', { name: 'Xem bài', exact: true })
        .click();
      await direct.getByText('Số lượt còn lại: 2', { exact: true }).waitFor();
      await direct.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
      await direct.getByRole('button', { name: 'Bắt đầu phần', exact: true }).click();
      await direct.locator('.letter').first().waitFor();
      await direct.keyboard.press('a');
      for (let i = 0; i < 6; i++) await direct.keyboard.press('z');
      await direct
        .getByRole('heading', { name: 'Đã kết thúc phần Chữ rơi', exact: true })
        .waitFor();
      await direct
        .locator('.assessment-run-header')
        .getByRole('button', { name: 'Nộp bài', exact: true })
        .click();
      await direct.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
      assert.equal(await direct.evaluate(() => window.__recordNotes), 1);
      await direct.getByRole('button', { name: 'Kết quả của em', exact: true }).click();
      await direct.getByRole('dialog').getByText('Tốt nhất từng phần', { exact: true }).waitFor();
      await direct.keyboard.press('Escape');
      await direct.reload();
      await direct
        .locator('article')
        .filter({ hasText: 'Bài mục tiêu thử' })
        .getByRole('button', { name: 'Xem bài', exact: true })
        .click();
      await direct.getByRole('heading', { name: 'Hoàn thành tốt', exact: true }).waitFor();
      assert.equal(await direct.evaluate(() => window.__recordNotes), 0);
      await direct.getByText('Số lượt còn lại: 1', { exact: true }).waitFor();
      await direct.getByRole('button', { name: 'Làm lại', exact: true }).waitFor();
      await teacher.reload();
      await teacher.getByRole('button', { name: 'Bài kiểm tra', exact: true }).click();
      const extraCard = teacher.locator('article').filter({ hasText: 'Bài mục tiêu thử' });
      await extraCard.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
      await teacher.locator('.assessment-table tbody tr').last().waitFor();
      assert.equal(await teacher.locator('.assessment-table tbody tr').count(), 7);
      await teacher
        .getByRole('navigation', { name: 'Phân trang kết quả' })
        .getByRole('button', { name: '3', exact: true })
        .click();
      await teacher
        .locator('.assessment-table tbody tr')
        .filter({ hasText: 'Học sinh 9' })
        .waitFor();
      await fit(teacher);
      await teacher.screenshot({
        path: `test-results/assessments/${width}-teacher-results.png`,
        fullPage: true,
      });
      await teacher.getByLabel('Tìm học sinh', { exact: true }).fill('kid09');
      await teacher
        .locator('.assessment-table tbody tr')
        .filter({ hasText: 'Học sinh 9' })
        .waitFor();
      await teacher
        .getByRole('navigation', { name: 'Phân trang kết quả' })
        .getByText('1 mục · Trang 1/1', { exact: true })
        .waitFor();
      assert.equal(await teacher.locator('.assessment-table tbody tr').count(), 1);
      await teacher.getByRole('button', { name: 'Chi tiết', exact: true }).click();
      await teacher.getByRole('dialog').getByText('Tốt nhất từng phần', { exact: true }).waitFor();
      await teacher.keyboard.press('Escape');
      await teacher.getByLabel('Trạng thái', { exact: true }).selectOption('not_started');
      await teacher.getByText('Chưa có học sinh phù hợp.', { exact: true }).waitFor();
      await teacher.getByRole('button', { name: 'Danh sách', exact: true }).click();
      await extraCard.getByRole('button', { name: 'Xóa bài', exact: true }).click();
      await teacher
        .getByRole('dialog')
        .getByRole('button', { name: 'Quay lại', exact: true })
        .click();
      await extraCard.getByRole('button', { name: 'Xóa bài', exact: true }).click();
      await teacher
        .getByRole('dialog')
        .getByRole('button', { name: 'Xóa bài', exact: true })
        .click();
      await extraCard.getByText('Đã xóa / Ẩn', { exact: false }).waitFor();
      await direct.reload();
      await direct
        .locator('article')
        .filter({ hasText: 'Bài mục tiêu thử' })
        .getByRole('button', { name: 'Xem bài', exact: true })
        .click();
      assert.equal(
        await direct.getByRole('button', { name: 'Làm lại', exact: true }).isDisabled(),
        true,
      );
      if (width === 1440) {
        const timedId = id(501);
        const timed = await service.assessmentSave(fixtureAdmin, {
          assessmentId: timedId,
          requestId: crypto.randomUUID(),
          version: 0,
          title: 'Bài đóng giờ thử',
          targets: { classIds: [], userIds: [id(9)] },
          schedule: {
            mode: 'scheduled',
            opensAt: new Date(Date.now() - 60000).toISOString(),
            closesAt: new Date(Date.now() + 6000).toISOString(),
          },
          repeats: { mode: 'unlimited' },
          selection: {
            questIds: [],
            falling: { difficulty: 'easy', keys: ['A'], targetScore: 10 },
          },
        });
        await service.assessmentPublish(fixtureAdmin, {
          assessmentId: timedId,
          version: timed.version,
        });
        await direct.reload();
        await direct
          .locator('article')
          .filter({ hasText: 'Bài đóng giờ thử' })
          .getByRole('button', { name: 'Xem bài', exact: true })
          .click();
        await direct.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
        await direct.locator('.assessment-runner').waitFor();
        await direct.evaluate(() => {
          Date.now = () => 0;
        });
        await direct
          .getByText('Đã hết giờ. Kết quả được chốt từ phần đã lưu.', { exact: true })
          .waitFor();
        const ended = await service.assessment(
          { user_id: id(9), role: 'student' },
          { assessmentId: timedId },
        );
        assert.equal(ended.attempt.closed_reason, 'deadline');
        await direct.reload();
        await direct
          .locator('article')
          .filter({ hasText: 'Bài đóng giờ thử' })
          .getByRole('button', { name: 'Xem bài', exact: true })
          .click();
        await direct.getByText('Đã kết thúc', { exact: true }).waitFor();
        assert.equal(
          await direct.getByRole('button', { name: 'Làm lại', exact: true }).isDisabled(),
          true,
        );
      }
      await db.query('update class_members set is_active=false where user_id=$1', [id(1)]);
      await student.reload();
      assert.equal(
        await student.locator('article').filter({ hasText: 'Bài kiểm tra đã chỉnh' }).count(),
        0,
      );
      const lost = await student.evaluate(
        async (examId) =>
          (
            await fetch(
              '/api/tipy?' + new URLSearchParams({ action: 'assessment', assessmentId: examId }),
            )
          ).status,
        examId,
      );
      assert.equal(lost, 403);
      for (const table of ['star_rewards', 'player_lesson_progress', 'player_game_stats'])
        assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
      assert.equal(
        writes.filter((w) => ['start', 'progress', 'quest_finish'].includes(w.action)).length,
        0,
      );
      assert.deepEqual(errors, []);
      for (const page of pages) await fit(page);
      console.log(
        JSON.stringify({
          width,
          draftPreviewEditPublish: true,
          multiWorldSelection: true,
          studentResume: true,
          bothEngines: true,
          submitAndRetake: true,
          accessRevocation: true,
          successfulTargetAndSoundOnce: true,
          teacherSevenRowTableAndFilters: true,
          ownHistory: true,
          deleteAndPreserveResults: true,
          practiceUntouched: true,
          errors,
        }),
      );
    } finally {
      for (const page of pages) await page.close();
      await db.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
