import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  assessmentSnapshot,
  assessmentResult,
  createAssessments,
} from '../server/modules/assessments.js';
import { TEST_CONTENT } from '../src/features/assessments/content.js';
import { createAnswers } from '../src/features/keyboard-quest/engine.js';
import { createGame } from '../src/game/engine.js';
import { LEVELS } from '../src/game/config.js';
import { assessmentSession } from '../src/features/assessments/session.js';
import { createHandler } from '../api/tipy.js';
import { ApiError } from '../server/errors.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const profile = (n) => ({ user_id: id(n), role: n === 5 ? 'admin' : 'student' });
const draft = () => ({
  assessmentId: id(100),
  requestId: id(200),
  version: 0,
  title: 'Fixture only',
  description: 'Bài thử',
  instructions: 'Làm rồi nộp',
  targets: { classIds: [id(20)], userIds: [id(2)] },
  selection: {
    questIds: ['keys-as-1', 'short-words-1'],
    falling: { difficulty: 'easy', keys: ['A', 'S'] },
  },
});

test('assessment catalog snapshots exact source items; validation and grading reject forged data without awarding practice stars', () => {
  assert.equal(TEST_CONTENT.length, 327);
  assert.equal(new Set(TEST_CONTENT.map((i) => i.id)).size, 327);
  const definition = assessmentSnapshot(draft());
  assert.equal(definition.sections[1].items[0].target, 'A');
  assert.throws(() =>
    assessmentSnapshot({ ...draft(), selection: { questIds: ['not-a-real-item'] } }),
  );
  assert.throws(() =>
    assessmentSnapshot({ ...draft(), selection: { questIds: ['keys-as-1', 'keys-as-1'] } }),
  );
  assert.throws(() =>
    assessmentSnapshot({ ...draft(), selection: { falling: { difficulty: 'hard', keys: ['á'] } } }),
  );
  const part = definition.sections[1],
    answers = createAnswers(part);
  answers[0].answer = 'A';
  const attempt = {
    active_seconds: 0,
    payload: {},
    started_at: new Date(Date.now() - 20000).toISOString(),
  };
  assert.throws(() =>
    assessmentResult(definition, { quest: { answers, seconds: 2 }, stars: 999 }, attempt),
  );
  const grade = assessmentResult(definition, { quest: { answers, seconds: 2 } }, attempt);
  assert.equal(grade.results.find((s) => s.type === 'quest').correct, 1);
  assert.equal(grade.results.find((s) => s.type === 'quest').completed, false);
  const state = createGame(definition.sections[0].settings);
  state.countdown = 0;
  state.status = 'playing';
  state.elapsed = 2;
  assert.equal(
    assessmentResult(definition, { falling: { state, seconds: 2 } }, attempt).results[0].score,
    0,
  );
  assert.throws(() =>
    assessmentResult(
      definition,
      { falling: { state: { ...state, correct: 500 }, seconds: 2 } },
      attempt,
    ),
  );
});

test('database assessment lifecycle isolates practice, freezes publication, checks class permissions, one attempt, retake and replay/conflicts', async () => {
  const db = new PGlite();
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
    ])
      await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    for (const n of [1, 2, 3, 5])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: 'fixture' + n, full_name: 'Fixture ' + n },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [id(5)]);
    await db.query("insert into classes(class_id,name,created_by) values($1,'Fixture class',$2)", [
      id(20),
      id(5),
    ]);
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(20), id(1)]);
    const calls = [];
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
        calls.push([name, args]);
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
          if (!/Access|Admin|Conflict|immutable|already submitted/.test(e.message))
            console.error('SQL fixture:', e.message);
          return { error: { message: e.message } };
        }
      },
    });
    const admin = profile(5),
      student = profile(1);
    await assert.rejects(service.assessmentSave(student, draft()), (e) => e.status === 403);
    assert.equal(calls.length, 0);
    const first = await service.assessmentSave(admin, draft());
    assert.equal(first.version, 1);
    assert.equal((await service.assessmentSave(admin, draft())).version, 1);
    await assert.rejects(
      service.assessmentSave(admin, { ...draft(), title: 'different same token' }),
      (e) => e.status === 409,
    );
    assert.equal((await service.assessments(student, {})).total, 0);
    await assert.rejects(
      service.assessment(student, { assessmentId: id(100) }),
      (e) => e.status === 403,
    );
    const preview = await service.assessment(admin, { assessmentId: id(100) });
    assert.equal(preview.assessment.definition.targetNames.length, 2);
    const second = await service.assessmentSave(admin, {
      ...draft(),
      requestId: id(201),
      version: 1,
      title: 'Edited fixture',
    });
    assert.equal(second.version, 2);
    await assert.rejects(
      service.assessmentPublish(admin, { assessmentId: id(100), version: 1 }),
      (e) => e.status === 409,
    );
    await service.assessmentPublish(admin, { assessmentId: id(100), version: 2 });
    await service.assessmentPublish(admin, { assessmentId: id(100), version: 2 });
    assert.equal(
      (await db.query('select count(*)::int n from assessment_assignments')).rows[0].n,
      2,
    );
    await assert.rejects(
      service.assessmentSave(admin, { ...draft(), requestId: id(202), version: 2 }),
      (e) => e.status === 409,
    );
    for (const n of [1, 2]) assert.equal((await service.assessments(profile(n), {})).total, 1);
    assert.equal((await service.assessments(profile(3), {})).total, 0);
    await assert.rejects(
      service.assessment(profile(3), { assessmentId: id(100) }),
      (e) => e.status === 403,
    );
    let detail = await service.assessment(student, { assessmentId: id(100) });
    assert.equal(detail.assessment.definition.targets, undefined);
    const [attempt, duplicate] = await Promise.all([
      service.assessmentStart(student, { assessmentId: id(100) }),
      service.assessmentStart(student, { assessmentId: id(100) }),
    ]);
    assert.equal(attempt.attempt_id, duplicate.attempt_id);
    await db.query(
      "update assessment_attempts set started_at=now()-interval '30 seconds' where attempt_id=$1",
      [attempt.attempt_id],
    );
    const answers = createAnswers(
      detail.assessment.definition.sections.find((s) => s.id === 'quest'),
    );
    answers[0].answer = 'A';
    let body = {
      assessmentId: id(100),
      attemptId: attempt.attempt_id,
      requestId: id(210),
      revision: 0,
      payload: { quest: { seconds: 1, answers } },
      stars: 999,
    };
    let saved = await service.assessmentWrite(student, body);
    assert.equal(saved.revision, 1);
    assert.equal(saved.results.find((s) => s.type === 'quest').answered, 1);
    assert.equal((await service.assessmentWrite(student, body)).revision, 1);
    await assert.rejects(
      service.assessmentWrite(student, { ...body, requestId: id(211) }),
      (e) => e.status === 409,
    );
    await assert.rejects(service.assessmentWrite(profile(2), body), (e) => e.status === 403);
    await db.query('update class_members set is_active=false where user_id=$1', [id(1)]);
    await assert.rejects(
      service.assessmentWrite(student, { ...body, revision: 1, requestId: id(212) }),
      (e) => e.status === 403,
    );
    assert.equal((await service.assessments(student, {})).total, 0);
    assert.equal(
      (await service.assessments(profile(2), {})).total,
      1,
      'direct recipient does not require a class',
    );
    await db.query('update class_members set is_active=true where user_id=$1', [id(1)]);
    body = { ...body, revision: 1, requestId: id(213) };
    const submitted = await service.assessmentSubmit(student, body);
    assert.ok(submitted.submitted_at);
    assert.equal((await service.assessmentSubmit(student, body)).attempt_id, submitted.attempt_id);
    await assert.rejects(
      service.assessmentStart(student, { assessmentId: id(100) }),
      (e) => e.status === 409,
    );
    const results = await service.assessmentResults(admin, { assessmentId: id(100) });
    assert.equal(results.total, 2);
    assert.equal(results.items[0].attempts[0].results.length, 2);
    await assert.rejects(
      service.assessmentResults(student, { assessmentId: id(100) }),
      (e) => e.status === 403,
    );
    const retake = { assessmentId: id(100), userId: id(1), attemptId: attempt.attempt_id };
    await service.assessmentRetake(admin, retake);
    await service.assessmentRetake(admin, retake);
    const again = await service.assessmentStart(student, { assessmentId: id(100) });
    assert.equal(again.attempt_number, 2);
    await service.assessmentRetake(admin, retake);
    assert.equal((await service.assessment(student, { assessmentId: id(100) })).allowedAttempts, 2);
    await assert.rejects(
      service.assessmentWrite(student, { ...body, requestId: id(214), revision: 2 }),
      (e) => e.status === 403,
    );
    for (const table of ['player_lesson_progress', 'player_game_stats', 'star_rewards'])
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query("select tipy_assessment($1,'list','{}')", [id(5)]),
      /permission denied/,
    );
    for (const table of ['assessments', 'assessment_assignments', 'assessment_attempts'])
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('checkpoint queue retries the exact request, coalesces changes and submits once without practice endpoints', async () => {
  const writes = [],
    attempt = { attempt_id: id(100), revision: 0, payload: {} };
  let fail = true;
  const session = assessmentSession(
    id(101),
    attempt,
    () => {},
    async (action, body) => {
      writes.push({ action, body: structuredClone(body) });
      if (fail) {
        fail = false;
        throw Error('network');
      }
      return {
        data: {
          ...attempt,
          revision: body.revision + 1,
          payload: body.payload,
          submitted_at: action === 'assessment_submit' ? 'now' : null,
        },
      };
    },
  );
  session.update('quest', { seconds: 0, answers: [] }, false);
  await assert.rejects(session.flush(), /network/);
  await session.flush();
  assert.equal(writes[0].body.requestId, writes[1].body.requestId);
  const submitted = await session.flush(true);
  assert.ok(submitted.submitted_at);
  const count = writes.length;
  await session.flush();
  assert.equal(writes.length, count);
  assert.ok(
    writes.every((write) => ['assessment_checkpoint', 'assessment_submit'].includes(write.action)),
  );
  session.stop();
});

test('HTTP assessment actions enforce the actual session role and keep other request size limits', async () => {
  const calls = [];
  const services = createAssessments({
    rpc: async (name, args) => {
      calls.push(args);
      return { error: { message: 'Access denied' } };
    },
  });
  const send = async (role, action, method = 'POST', extra = {}) => {
    const handler = createHandler({
      makeBackend: () => ({
        ...services,
        session: async () => {
          if (!role) throw new ApiError(401, 'Đăng nhập');
          return { profile: { user_id: id(1), role } };
        },
      }),
    });
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json(value) {
        this.body = value;
      },
    };
    await handler(
      {
        method,
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        query: { action, assessmentId: id(100) },
        body:
          method === 'POST'
            ? { ...draft(), action, role: 'admin', userId: id(5), ...extra }
            : undefined,
      },
      res,
    );
    return res;
  };
  for (const action of ['assessment_save', 'assessment_publish', 'assessment_retake'])
    assert.equal((await send('student', action)).code, 403);
  assert.equal(calls.length, 0);
  assert.equal((await send('student', 'assessment_results', 'GET')).code, 403);
  assert.equal((await send(null, 'assessments', 'GET')).code, 401);
  assert.equal((await send('student', 'assessment', 'GET')).code, 403);
  assert.equal(calls[0].p_actor, id(1));
  assert.equal((await send('student', 'login', 'POST', { padding: 'x'.repeat(20000) })).code, 413);
  assert.equal(
    (await send('student', 'assessment_save', 'POST', { padding: 'x'.repeat(20000) })).code,
    403,
    'larger assessment body still checks role',
  );
});
