import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { assessmentSnapshot, createAssessments } from '../server/modules/assessments.js';
import { createAnswers } from '../src/features/keyboard-quest/engine.js';
import { createHandler } from '../api/tipy.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (n) => ({ user_id: id(n), role: n === 99 ? 'admin' : 'student' });
const scope = (n) => ({ assessmentId: id(n) });
const draft = (n, targets, more = {}) => ({
  ...scope(n),
  title: `Fixture ${n}`,
  version: 0,
  requestId: crypto.randomUUID(),
  targets,
  selection: { questIds: ['keys-as-1'], falling: null },
  ...more,
});

test('class targets migrate only from explicit evidence; late members, multiple sources, empty classes and revocation keep existing attempts', async () => {
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
      'assessment_policies',
    ])
      await db.exec(readFileSync(`db/${f}.sql`, 'utf8'));
    for (const n of [1, 2, 3, 4, 5, 99])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: `fixture${n}`, full_name: `Học sinh ${n}` },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [id(99)]);
    for (const n of [50, 51, 52])
      await db.query('insert into classes(class_id,name,created_by) values($1,$2,$3)', [
        id(n),
        `Lớp thử ${n}`,
        id(99),
      ]);
    const join = async (user, group) =>
      db.query(
        'insert into class_members(class_id,user_id) values($1,$2) on conflict(class_id,user_id) do update set is_active=true',
        [id(group), id(user)],
      );
    const leave = async (user, group) =>
      db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
        id(group),
        id(user),
      ]);
    await join(1, 50);
    await join(2, 51);
    for (const n of [90, 91, 92, 93]) {
      const definition = assessmentSnapshot(
        draft(n, {
          classIds: n === 90 || n === 93 ? [id(50)] : [],
          userIds: n === 91 ? [id(3)] : [],
        }),
      );
      definition.targetNames = ['Lớp thử 50'];
      await db.query(
        'insert into assessments(assessment_id,created_by,definition,status) values($1,$2,$3,$4)',
        [id(n), id(99), definition, n === 93 ? 'deleted' : 'published'],
      );
      await db.query(
        'insert into assessment_assignments(assessment_id,user_id,direct,class_ids) values($1,$2,$3,$4)',
        [id(n), id(n === 91 ? 3 : 1), n === 91, n === 92 ? [id(50)] : []],
      );
    }
    const oldDefinition = (
      await db.query('select definition from assessments where assessment_id=$1', [id(90)])
    ).rows[0].definition;
    const legacyAttempt = (
      await db.query(
        'insert into assessment_attempts(assessment_id,user_id,attempt_number,definition) values($1,$2,1,$3) returning attempt_id',
        [id(90), id(1), oldDefinition],
      )
    ).rows[0].attempt_id;
    await db.exec(readFileSync('db/assessment_class_access.sql', 'utf8'));
    assert.equal(
      (await db.query('select count(*)::int n from assessments')).rows[0].n,
      4,
      'migration does not delete old hidden assessments',
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from assessment_class_targets where assessment_id=$1',
          [id(91)],
        )
      ).rows[0].n,
      0,
      'display names are not class evidence',
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from assessment_class_targets where assessment_id=$1',
          [id(92)],
        )
      ).rows[0].n,
      1,
      'explicit historical class UUIDs are evidence',
    );
    const raw = async (n, action, input = {}) =>
      (await db.query('select tipy_assessment($1,$2,$3) data', [id(n), action, input])).rows[0]
        .data;
    const service = createAssessments({
      rpc: async (_, args) => {
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
    const publish = async (n, targets, more) => {
      const row = await service.assessmentSave(person(99), draft(n, targets, more));
      return service.assessmentPublish(person(99), { ...scope(n), version: row.version });
    };
    await join(4, 50);
    const legacyList = await service.assessments(person(4), {});
    assert.deepEqual(legacyList.items.map((e) => e.assessment_id).sort(), [id(90), id(92)]);
    assert.equal(
      (await service.assessment(person(1), scope(90))).attempt.attempt_id,
      legacyAttempt,
    );
    await assert.rejects(service.assessment(person(4), scope(91)), (e) => e.status === 403);
    await publish(100, { classIds: [id(50), id(51)], userIds: [id(2)] });
    await publish(101, { classIds: [], userIds: [id(2)] });
    await assert.rejects(service.assessment(person(3), scope(100)), (e) => e.status === 403);
    await join(3, 50);
    let result = await service.assessmentResults(person(99), scope(100));
    assert.equal(result.items.find((p) => p.user_id === id(3)).attempt_status, 'not_started');
    assert.equal(result.items.find((p) => p.user_id === id(3)).latest_submitted, null);
    assert.equal(result.items.filter((p) => p.user_id === id(2)).length, 1);
    let list = await service.assessments(person(3), {});
    assert.equal(list.items.filter((e) => e.assessment_id === id(100)).length, 1);
    await assert.rejects(service.assessment(person(3), scope(101)), (e) => e.status === 403);
    const a = await service.assessmentStart(person(3), scope(100));
    const answers = createAnswers(a.definition.sections[0]);
    answers[0].answer = 'A';
    const checkpoint = {
      ...scope(100),
      attemptId: a.attempt_id,
      revision: 0,
      requestId: crypto.randomUUID(),
      payload: { quest: { answers, seconds: 0 } },
    };
    await service.assessmentWrite(person(3), checkpoint);
    await leave(3, 50);
    assert.equal(
      (await service.assessments(person(3), {})).items.some((e) => e.assessment_id === id(100)),
      false,
    );
    await assert.rejects(service.assessmentSubmit(person(3), checkpoint), (e) => e.status === 403);
    await assert.rejects(
      raw(3, 'checkpoint', { ...checkpoint, results: [], seconds: 0 }),
      /Access denied/,
    );
    await join(3, 51);
    await join(3, 50);
    await leave(3, 50);
    assert.equal((await service.assessmentStart(person(3), scope(100))).attempt_id, a.attempt_id);
    assert.equal((await service.assessment(person(3), scope(100))).attempt.results[0].correct, 1);
    await leave(2, 51);
    assert.equal(
      (await service.assessment(person(2), scope(100))).assessment.assessment_id,
      id(100),
      'direct source survives leaving class',
    );
    await leave(3, 51);
    await join(3, 50);
    assert.equal(
      (await service.assessment(person(3), scope(100))).attempt.attempt_id,
      a.attempt_id,
    );
    await publish(102, { classIds: [id(52)], userIds: [] });
    assert.equal(
      (await service.assessmentResults(person(99), scope(102))).total,
      0,
      'publishing to an empty class is allowed',
    );
    await join(5, 52);
    assert.equal(
      (await service.assessmentResults(person(99), scope(102))).items[0].attempt_status,
      'not_started',
    );
    assert.equal((await service.assessmentStart(person(5), scope(102))).attempt_number, 1);
    const now = Date.now();
    for (const [n, opensAt, closesAt] of [
      [103, now + 60000, now + 120000],
      [104, now - 120000, now - 60000],
    ]) {
      await publish(
        n,
        { classIds: [id(52)], userIds: [] },
        {
          schedule: {
            mode: 'scheduled',
            opensAt: new Date(opensAt).toISOString(),
            closesAt: new Date(closesAt).toISOString(),
          },
        },
      );
    }
    await join(4, 52);
    list = await service.assessments(person(4), {});
    assert.ok(list.items.some((e) => e.assessment_id === id(103)));
    assert.ok(list.items.some((e) => e.assessment_id === id(104)));
    await assert.rejects(service.assessmentStart(person(4), scope(103)), /chưa đến giờ/);
    await assert.rejects(service.assessmentStart(person(4), scope(104)), /đã kết thúc/);
    await db.query('update classes set archived_at=clock_timestamp() where class_id=$1', [id(52)]);
    await assert.rejects(service.assessment(person(5), scope(102)), (e) => e.status === 403);
    await db.query('update classes set archived_at=null where class_id=$1', [id(52)]);
    const deleteInput = { ...scope(100), title: 'Fixture 100', confirm: 'accept' };
    await assert.rejects(service.assessmentDelete(person(3), deleteInput), (e) => e.status === 403);
    for (const confirm of [undefined, 'ACCEPT', ' accept', 'accept '])
      await assert.rejects(
        service.assessmentDelete(person(99), { ...deleteInput, confirm }),
        (e) => e.status === 400,
      );
    await assert.rejects(
      raw(99, 'delete', { ...deleteInput, confirm: 'no' }),
      /Confirmation required/,
    );
    await db.exec(
      `create function public.fixture_reject_delete() returns trigger language plpgsql as $$begin raise exception 'Fixture dependent failure'; end$$; create trigger fixture_delete_failure before delete on public.assessment_attempts for each row execute function public.fixture_reject_delete();`,
    );
    await assert.rejects(service.assessmentDelete(person(99), deleteInput));
    assert.equal(
      (await service.assessment(person(3), scope(100))).attempt.attempt_id,
      a.attempt_id,
      'failed cascade rolls back the entire deletion',
    );
    await db.exec(
      'drop trigger fixture_delete_failure on public.assessment_attempts;drop function public.fixture_reject_delete();',
    );
    assert.deepEqual(await service.assessmentDelete(person(99), deleteInput), {
      deleted: true,
      permanent: true,
    });
    assert.deepEqual(await service.assessmentDelete(person(99), deleteInput), {
      deleted: true,
      permanent: true,
    });
    for (const table of [
      'assessments',
      'assessment_assignments',
      'assessment_attempts',
      'assessment_class_targets',
    ])
      assert.equal(
        (await db.query(`select count(*)::int n from ${table} where assessment_id=$1`, [id(100)]))
          .rows[0].n,
        0,
      );
    for (const request of [
      () => service.assessmentStart(person(3), scope(100)),
      () => service.assessmentSubmit(person(3), checkpoint),
      () => service.assessment(person(3), scope(100)),
    ])
      await assert.rejects(
        request(),
        (e) => e.status === 410 && e.message === 'Bài kiểm tra đã được xóa',
      );
    await assert.rejects(
      raw(3, 'submit', { ...checkpoint, results: [], seconds: 0 }),
      /Assessment deleted/,
    );
    assert.equal(
      (await service.assessment(person(2), scope(101))).assessment.assessment_id,
      id(101),
    );
    assert.equal(
      (await service.assessment(person(1), scope(90))).attempt.attempt_id,
      legacyAttempt,
    );
    assert.equal((await db.query('select count(*)::int n from profiles')).rows[0].n, 6);
    assert.equal((await db.query('select count(*)::int n from classes')).rows[0].n, 3);
    await publish(105, { classIds: [], userIds: [id(1)] });
    await Promise.allSettled([
      service.assessmentStart(person(1), scope(105)),
      service.assessmentDelete(person(99), {
        ...scope(105),
        title: 'Fixture 105',
        confirm: 'accept',
      }),
    ]);
    assert.equal(
      (
        await db.query('select count(*)::int n from assessment_attempts where assessment_id=$1', [
          id(105),
        ])
      ).rows[0].n,
      0,
    );
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from assessment_class_targets'));
    await assert.rejects(db.query('select tipy_sync_assessment_assignments()'));
    await db.exec('reset role');
    for (const table of ['player_lesson_progress', 'player_game_stats', 'star_rewards'])
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
  } finally {
    await db.close();
  }
});

test('HTTP deletion cannot forge admin and requires exact accept before calling the database', async () => {
  let role = 'student',
    calls = 0;
  const service = createAssessments({
    rpc: async () => {
      calls++;
      return { data: { deleted: true, permanent: true } };
    },
  });
  const handler = createHandler({
    env: { APP_ORIGIN: 'https://fixture.test' },
    makeBackend: () => ({ ...service, session: async () => ({ profile: { ...person(1), role } }) }),
  });
  const call = async (body) => {
    let status = 200,
      data;
    await handler(
      {
        method: 'POST',
        headers: { origin: 'https://fixture.test', 'content-type': 'application/json' },
        body: { action: 'assessment_delete', ...scope(100), title: 'Fixture 100', ...body },
      },
      {
        setHeader() {},
        status(code) {
          status = code;
          return this;
        },
        json(value) {
          data = value;
        },
      },
    );
    return { status, data };
  };
  assert.equal((await call({ role: 'admin', confirm: 'accept' })).status, 403);
  role = 'admin';
  assert.equal((await call({})).status, 400);
  assert.equal(calls, 0);
  assert.equal((await call({ confirm: 'accept' })).status, 200);
  assert.equal(calls, 1);
});
