import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  createAssessments,
  assessmentSnapshot,
  assessmentResult,
} from '../server/modules/assessments.js';
import { createGame } from '../src/game/engine.js';
import { LEVELS } from '../src/game/config.js';
import { assessmentSession } from '../src/features/assessments/session.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = { user_id: id(99), role: 'admin' },
  student = { user_id: id(1), role: 'student' };
const draft = (n, extra = {}) => ({
  assessmentId: id(n),
  requestId: crypto.randomUUID(),
  version: 0,
  title: `Fixture ${n}`,
  targets: { classIds: [], userIds: Array.from({ length: 15 }, (_, i) => id(i + 1)) },
  selection: { questIds: [], falling: { difficulty: 'easy', keys: ['A', 'S'], targetScore: 20 } },
  ...extra,
});

test('target is server graded at below/equal/above boundaries; schedule and retry policies validate with safe legacy defaults', () => {
  const definition = assessmentSnapshot(draft(100)),
    attempt = {
      active_seconds: 0,
      payload: {},
      started_at: new Date(Date.now() - 20000).toISOString(),
    };
  for (const [correct, outcome] of [
    [1, 'practice'],
    [2, 'good'],
    [3, 'good'],
  ]) {
    const state = {
      ...createGame(definition.sections[0].settings),
      status: 'playing',
      countdown: 0,
      elapsed: 10,
      correct,
      score: 9999,
    };
    const grade = assessmentResult(
      definition,
      { falling: { seconds: 10, state, outcome: 'good' } },
      attempt,
    );
    assert.equal(grade.results[0].score, correct * 10);
    assert.equal(grade.results[0].outcome, outcome);
    assert.equal(grade.results[0].targetScore, 20);
  }
  for (const targetScore of [-1, 0, 1.5, Infinity, '20'])
    assert.throws(() =>
      assessmentSnapshot({
        ...draft(100),
        selection: { falling: { difficulty: 'easy', keys: ['A'], targetScore } },
      }),
    );
  assert.throws(() =>
    assessmentSnapshot(
      draft(100, {
        schedule: {
          mode: 'scheduled',
          opensAt: '2026-11-12T20:00:00+07:00',
          closesAt: '2026-11-12T19:00:00+07:00',
        },
      }),
    ),
  );
  assert.throws(() =>
    assessmentSnapshot(
      draft(100, {
        schedule: { mode: 'scheduled', opensAt: '2026-11-12T20:00', closesAt: '2026-11-12T21:00' },
      }),
    ),
  );
  for (const extra of [0, -1, 1.5, 1000])
    assert.throws(() => assessmentSnapshot(draft(100, { repeats: { mode: 'limited', extra } })));
  const legacy = draft(100);
  delete legacy.selection.falling.targetScore;
  const def = assessmentSnapshot(legacy);
  assert.equal(def.sections[0].targetScore, null);
  assert.deepEqual(def.schedule, { mode: 'always' });
  assert.deepEqual(def.repeats, { mode: 'none' });
});

test('real database: deadlines, snapshot grading, concurrent starts, limits, unlimited, delete preservation, teacher paging and private histories', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);`,
    );
    for (const f of [
      'schema',
      'compact_results',
      'classrooms',
      'keyboard_quest',
      'stars',
      'student_actions',
      'lesson_star_upgrades',
      'assessments',
    ])
      await db.exec(readFileSync(`db/${f}.sql`, 'utf8'));
    for (const n of [...Array.from({ length: 15 }, (_, i) => i + 1), 99])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: `fixture${n}`, full_name: `Học sinh ${String(n).padStart(2, '0')}` },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [id(99)]);
    const old = assessmentSnapshot(draft(90));
    delete old.schedule;
    delete old.repeats;
    delete old.sections[0].targetScore;
    await db.query(
      "insert into assessments(assessment_id,created_by,definition,status) values($1,$2,$3,'published')",
      [id(90), id(99), old],
    );
    await db.query(
      'insert into assessment_assignments(assessment_id,user_id,direct) values($1,$2,true)',
      [id(90), id(1)],
    );
    await db.query(
      'insert into assessment_attempts(assessment_id,user_id,attempt_number,results,active_seconds,submitted_at) values($1,$2,1,$3,20,now())',
      [
        id(90),
        id(1),
        [
          {
            id: 'falling',
            type: 'falling',
            title: 'Chữ rơi',
            score: 10,
            seconds: 20,
            correct: 1,
            wrong: 0,
            accuracy: 100,
          },
        ],
      ],
    );
    await db.exec(readFileSync('db/assessment_policies.sql', 'utf8'));
    await db.exec(readFileSync('db/assessment_class_access.sql', 'utf8'));
    await db.exec(
      readFileSync('supabase/migrations/20261113042630_assessment_result_summary.sql', 'utf8'),
    );
    const rpc = async (actor, action, input = {}) =>
      (await db.query('select tipy_assessment($1,$2,$3) data', [actor.user_id, action, input]))
        .rows[0].data;
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
      rpc: async (_, args) => {
        try {
          return { data: await rpc({ user_id: args.p_actor }, args.p_action, args.p_input) };
        } catch (e) {
          return { error: { message: e.message } };
        }
      },
    });
    const scope = (n) => ({ assessmentId: id(n) });
    const publish = async (n, options) => {
      const saved = await service.assessmentSave(admin, draft(n, options));
      await service.assessmentPublish(admin, { ...scope(n), version: saved.version });
      return saved;
    };
    const finish = async (n, attempt, correct = 1) => {
      await db.query(
        "update assessment_attempts set started_at=clock_timestamp()-interval '20 seconds' where attempt_id=$1",
        [attempt.attempt_id],
      );
      const detail = await service.assessment(student, scope(n));
      const state = {
        ...createGame(detail.attempt.definition.sections[0].settings),
        status: 'playing',
        countdown: 0,
        elapsed: 10,
        correct,
        score: correct * 10,
      };
      const input = {
        ...scope(n),
        attemptId: attempt.attempt_id,
        revision: attempt.revision,
        requestId: crypto.randomUUID(),
        payload: { falling: { seconds: 10, state } },
      };
      const row = await service.assessmentSubmit(student, input);
      const retry = await service.assessmentSubmit(student, input);
      const { server_now: firstClock, ...firstReceipt } = row;
      const { server_now: retryClock, ...retryReceipt } = retry;
      assert.deepEqual(retryReceipt, firstReceipt);
      return row;
    };
    const legacy = await service.assessment(student, scope(90));
    assert.equal(legacy.attempt.active_seconds, 20);
    assert.equal(legacy.attempt.results[0].score, 10);
    assert.equal(legacy.attempt.results[0].outcome, undefined);
    assert.equal(legacy.remainingAttempts, 0);
    await publish(100, { repeats: { mode: 'limited', extra: 2 } });
    let a, b;
    [a, b] = await Promise.all([
      service.assessmentStart(student, scope(100)),
      service.assessmentStart(student, scope(100)),
    ]);
    assert.equal(a.attempt_id, b.attempt_id);
    assert.equal(a.attempt_number, 1);
    assert.equal(a.definition.targets, undefined);
    await finish(100, a, 1);
    a = await service.assessmentStart(student, scope(100));
    assert.equal(a.attempt_number, 2);
    await finish(100, a, 3);
    a = await service.assessmentStart(student, scope(100));
    await finish(100, a, 2);
    await assert.rejects(service.assessmentStart(student, scope(100)), /đã nộp/);
    const history = await service.assessmentAttempts(student, scope(100));
    assert.equal(history.total, 3);
    assert.equal(history.items[0].attempt_number, 3);
    assert.equal(history.best_sections[0].score, 30);
    assert.equal(history.best_sections[0].attempt_number, 2);
    assert.equal(history.items[0].results[0].score, 20);
    await assert.rejects(
      service.assessmentAttempts(student, { ...scope(100), userId: id(2) }),
      (e) => e.status === 403,
    );
    await assert.rejects(rpc(student, 'attempts', { ...scope(100), userId: id(2) }));
    await assert.rejects(service.assessmentResults(student, scope(100)), (e) => e.status === 403);
    await service.assessmentRetake(admin, {
      ...scope(100),
      userId: id(1),
      attemptId: a.attempt_id,
    });
    await service.assessmentRetake(admin, {
      ...scope(100),
      userId: id(1),
      attemptId: a.attempt_id,
    });
    a = await service.assessmentStart(student, scope(100));
    assert.equal(a.attempt_number, 4);
    await db.query("insert into classes(class_id,name,created_by) values($1,'Lớp thử',$2)", [
      id(50),
      id(99),
    ]);
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(1)]);
    let rows = await service.assessmentResults(admin, { ...scope(100), page: 1 });
    assert.equal(rows.total, 15);
    assert.equal(rows.items.length, 7);
    assert.equal(rows.items[0].attempt_status, 'in_progress');
    assert.equal(rows.items[0].latest_submitted.attempt_number, 3);
    assert.equal(rows.items[1].latest_submitted, null);
    rows = await service.assessmentResults(admin, { ...scope(100), page: 3 });
    assert.equal(rows.items.length, 1);
    assert.equal(rows.items[0].row_number, 15);
    rows = await service.assessmentResults(admin, {
      ...scope(100),
      classId: id(50),
      search: '01',
      status: 'in_progress',
      sort: 'score_desc',
    });
    assert.equal(rows.total, 1);
    rows = await service.assessmentResults(admin, {
      ...scope(100),
      status: 'not_started',
      sort: 'time_desc',
    });
    assert.equal(rows.total, 14);
    await publish(101, { repeats: { mode: 'unlimited' } });
    for (let i = 1; i <= 3; i++) {
      a = await service.assessmentStart(student, scope(101));
      assert.equal(a.attempt_number, i);
      await finish(101, a);
    }
    assert.equal((await service.assessment(student, scope(101))).remainingAttempts, null);
    await publish(102, {
      schedule: {
        mode: 'scheduled',
        opensAt: new Date(Date.now() + 60000).toISOString(),
        closesAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
    await assert.rejects(service.assessmentStart(student, scope(102)), /chưa đến giờ/);
    await publish(103, {
      schedule: {
        mode: 'scheduled',
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 60000).toISOString(),
      },
    });
    a = await service.assessmentStart(student, scope(103));
    await db.query(
      "update assessment_attempts set started_at=clock_timestamp()-interval '20 seconds' where attempt_id=$1",
      [a.attempt_id],
    );
    const state = {
      ...createGame(a.definition.sections[0].settings),
      status: 'playing',
      countdown: 0,
      elapsed: 10,
      correct: 2,
      score: 20,
    };
    const saved = await service.assessmentWrite(student, {
      ...scope(103),
      attemptId: a.attempt_id,
      revision: 0,
      requestId: crypto.randomUUID(),
      payload: { falling: { state, seconds: 10 } },
    });
    assert.equal(saved.results[0].outcome, 'good');
    // Clock boundary is simulated only in this isolated fixture, never on a real assignment.
    await db.query(
      "update assessment_attempts set deadline=clock_timestamp()-interval '1 second' where attempt_id=$1",
      [a.attempt_id],
    );
    await db.query('select tipy_expire_assessments($1,$2)', [id(103), id(1)]);
    const ended = await service.assessment(student, scope(103));
    assert.equal(ended.attempt.closed_reason, 'deadline');
    assert.equal(ended.attempt.results[0].score, 20);
    assert.equal(ended.attempt.active_seconds, 10);
    const late = await service.assessmentSubmit(student, {
      ...scope(103),
      attemptId: a.attempt_id,
      requestId: crypto.randomUUID(),
      revision: 0,
      payload: { forged: true },
    });
    assert.equal(late.results[0].score, 20);
    assert.equal((await db.query('select tipy_expire_assessments() n')).rows[0].n, 0);
    await publish(104);
    a = await service.assessmentStart(student, scope(104));
    await assert.rejects(
      service.assessmentDelete(student, { ...scope(104), title: 'Fixture 104', confirm: 'accept' }),
      (e) => e.status === 403,
    );
    await assert.rejects(service.assessmentDelete(admin, { ...scope(104), title: 'Fixture 104' }));
    await assert.rejects(
      service.assessmentDelete(admin, { ...scope(104), title: 'wrong', confirm: 'accept' }),
    );
    await service.assessmentDelete(admin, {
      ...scope(104),
      title: 'Fixture 104',
      confirm: 'accept',
    });
    await service.assessmentDelete(admin, {
      ...scope(104),
      title: 'Fixture 104',
      confirm: 'accept',
    });
    await assert.rejects(service.assessmentStart(student, scope(104)), (e) => e.status === 410);
    await assert.rejects(
      service.assessmentSubmit(student, {
        ...scope(104),
        attemptId: a.attempt_id,
        revision: 0,
        requestId: crypto.randomUUID(),
        payload: {},
      }),
      (e) => e.status === 410,
    );
    for (const table of [
      'assessments',
      'assessment_assignments',
      'assessment_attempts',
      'assessment_class_targets',
    ])
      assert.equal(
        (
          await db.query(`select count(*)::integer n from ${table} where assessment_id=$1`, [
            id(104),
          ])
        ).rows[0].n,
        0,
      );
    await service.assessmentSave(admin, draft(105));
    await service.assessmentDelete(admin, {
      ...scope(105),
      title: 'Fixture 105',
      confirm: 'accept',
    });
    await service.assessmentDelete(admin, {
      ...scope(105),
      title: 'Fixture 105',
      confirm: 'accept',
    });
    assert.equal(
      (
        await db.query('select count(*)::integer n from assessments where assessment_id=$1', [
          id(105),
        ])
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      service.assessmentSave(admin, { ...draft(100), version: 1, title: 'changed' }),
    );
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select tipy_expire_assessments()'));
    await assert.rejects(db.query('select * from assessment_attempts'));
    await db.exec('reset role');
    for (const table of ['player_lesson_progress', 'star_rewards', 'player_game_stats'])
      assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n, 0);
  } finally {
    await db.close();
  }
});

test('server deadline response closes checkpoint queue once and preserves its final row across retry/cleanup', async () => {
  let calls = 0,
    finished = 0;
  const attempt = { attempt_id: id(1), revision: 0, payload: {} };
  const final = {
    ...attempt,
    revision: 1,
    submitted_at: new Date().toISOString(),
    closed_reason: 'deadline',
    results: [],
  };
  const session = assessmentSession(
    id(100),
    attempt,
    () => {},
    async () => {
      calls++;
      return { data: final };
    },
    () => finished++,
  );
  session.update('falling', { seconds: 0 });
  assert.deepEqual(await session.flush(), final);
  assert.deepEqual(await session.flush(true), final);
  session.stop();
  assert.equal(calls, 1);
  assert.equal(finished, 1);
});
