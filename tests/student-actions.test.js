import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createStars } from '../server/modules/stars.js';
import { weekLabel } from '../src/game/week-label.js';
import { createHandler } from '../api/tipy.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('teacher actions reject students, forged actors and invalid confirmation/amounts before RPC', async () => {
  const calls = [];
  const service = createStars({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: { completed: true } };
    },
  });
  const input = {
    userId: id(1),
    gameId: id(10),
    requestId: id(20),
    confirm: 'accept',
    amount: 5,
    actorId: id(99),
  };
  for (const method of ['studentReset', 'starGift'])
    await assert.rejects(
      service[method]({ user_id: id(1), role: 'student' }, input),
      (e) => e.status === 403,
    );
  const admin = { user_id: id(5), role: 'admin' };
  for (const confirm of ['Accept', 'accept ', ''])
    await assert.rejects(service.studentReset(admin, { ...input, confirm }));
  for (const amount of [0, -1, 1.5, '5', 2147483648])
    await assert.rejects(service.starGift(admin, { ...input, amount }));
  await assert.rejects(service.starGift(admin, { ...input, message: 'a'.repeat(241) }));
  assert.equal(calls.length, 0);
  await service.starGift(admin, input);
  await service.studentReset(admin, input);
  assert.equal(calls[0][1].p_actor, id(5));
  assert.equal(calls[1][1].p_actor, id(5));
  const handler = createHandler({
    makeBackend: () => ({
      ...service,
      session: async () => ({ profile: { user_id: id(1), role: 'student' } }),
    }),
  });
  for (const action of ['student_reset', 'star_gift']) {
    const response = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json() {},
    };
    await handler(
      {
        method: 'POST',
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        body: { ...input, action, role: 'admin' },
      },
      response,
    );
    assert.equal(response.code, 403);
  }
  assert.equal(calls.length, 2);
  assert.equal(weekLabel('2026-11-09'), '09/11–15/11');
  assert.equal(weekLabel('2026-12-28'), '28/12–03/01');
});

test('atomic scoped reset, re-earning, stale plays, gift receipts, weekly preservation and database permissions', async () => {
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
    ])
      await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    for (const n of [1, 2, 5])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: 'test' + n, full_name: 'Test ' + n },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [id(5)]);
    const quest = (await db.query("select game_id from games where game_code='keyboard_quest'"))
      .rows[0].game_id;
    const falling = (await db.query("select game_id from games where game_code='falling_letters'"))
      .rows[0].game_id;
    await db.query('update games set is_active=true where game_id=$1', [quest]);
    await db.query("insert into classes(class_id,name,created_by) values($1,'Test only',$2)", [
      id(10),
      id(5),
    ]);
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(10), id(1)]);
    const q = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const total = async () => (await q('select tipy_star_total($1) r', [id(1)])).r;
    const begin = async () =>
      (
        await q('select tipy_begin_play($1,$2,null,$3,$4,1) r', [
          id(1),
          quest,
          [],
          { lesson_id: 'keys-as', curriculum_version: 1 },
        ])
      ).r;
    const finish = async (play) => {
      await db.query(
        "update active_plays set started_at=now()-interval '20 seconds' where play_id=$1",
        [play.play_id],
      );
      return (
        await q('select tipy_finish_quest_lesson($1,$2,$3,$4,$5) r', [
          id(1),
          play.play_id,
          'keys-as',
          {
            score: 900,
            active_seconds: 2,
            stage_number: 1,
            result: 'completed',
            ended_at: new Date().toISOString(),
            metrics: play.metrics,
          },
          {
            completed: true,
            stars: 3,
            accuracy: 100,
            correct: 10,
            wrong: 0,
            weakKeys: {},
            weakRules: {},
          },
        ])
      ).r;
    };
    const reset = async (req, game = quest, actor = id(5), confirm = 'accept') =>
      (await q('select tipy_student_reset($1,$2,$3,$4,$5) r', [actor, id(1), game, req, confirm]))
        .r;
    const gift = async (req, amount = 7, actor = id(5)) =>
      (
        await q('select tipy_teacher_gift($1,$2,$3,$4,$5) r', [
          actor,
          id(1),
          req,
          amount,
          'Cố lên nhé!',
        ])
      ).r;
    await assert.rejects(gift(id(30), 7, id(1)), /Admin required/);
    await assert.rejects(reset(id(31), quest, id(1)), /Admin required/);
    const first = await begin();
    assert.equal((await finish(first)).award_this_play, 3);
    const receipt = await gift(id(30));
    assert.deepEqual(await gift(id(30)), receipt);
    await assert.rejects(gift(id(30), 8), /thao tác khác/);
    const given = await q(
      "select granted_by,message,created_at from star_rewards where source='teacher'",
    );
    assert.equal(given.granted_by, id(5));
    assert.equal(given.message, 'Cố lên nhé!');
    assert.ok(given.created_at);
    await db.query(
      "insert into star_rewards(user_id,source,source_key,amount) values($1,'weekly','test-week',5)",
      [id(1)],
    );
    await db.query(
      'insert into player_game_stats(user_id,game_id,total_active_seconds,total_plays) values($1,$2,99,2)',
      [id(1), falling],
    );
    await db.query('insert into play_history(user_id,game_id,score) values($1,$2,20),($1,$3,30)', [
      id(1),
      quest,
      falling,
    ]);
    const old = await begin();
    const seconds = (
      await q(
        'select total_active_seconds n from player_game_stats where user_id=$1 and game_id=$2',
        [id(1), quest],
      )
    ).n;
    await assert.rejects(reset(id(31), quest, id(5), 'accept '), /accept/);
    assert.equal((await total()).stars, 15);
    const cleared = await reset(id(31));
    assert.equal(cleared.revokedStars, 3);
    assert.equal(cleared.lifetimeSeconds, seconds);
    assert.deepEqual(await total(), { stars: 12, lessonStars: 0, weeklyStars: 5, teacherStars: 7 });
    assert.equal((await q('select count(*)::int n from player_lesson_progress')).n, 0);
    assert.equal(
      (await q('select count(*)::int n from active_plays where game_id=$1', [quest])).n,
      0,
    );
    assert.equal(
      (await q('select count(*)::int n from play_history where game_id=$1', [quest])).n,
      0,
    );
    assert.equal(
      (await q('select count(*)::int n from play_history where game_id=$1', [falling])).n,
      1,
    );
    const stats = await q('select * from player_game_stats where user_id=$1 and game_id=$2', [
      id(1),
      quest,
    ]);
    assert.equal(stats.total_plays, 0);
    assert.equal(stats.best_play, null);
    assert.equal(stats.latest_play, null);
    assert.equal(stats.total_active_seconds, seconds);
    assert.equal(
      (await q('select total_active_seconds n from player_game_stats where game_id=$1', [falling]))
        .n,
      99,
    );
    assert.equal((await q('select count(*)::int n from class_members')).n, 1);
    assert.equal((await finish(old)).superseded, true);
    const fresh = await begin();
    assert.equal((await finish(fresh)).award_this_play, 3);
    await finish(fresh);
    assert.equal((await total()).lessonStars, 3);
    assert.deepEqual(await reset(id(31)), cleared);
    assert.equal(
      (await total()).lessonStars,
      3,
      'retry reset must not erase results earned after its first commit',
    );
    for (const week of ['2026-11-02', '2026-11-09'])
      await db.query(
        "insert into class_week_scores(class_id,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence) values($1,$2,$3,'hard-v1',10,1,1,0,2,$4,now(),now(),'{}')",
        [id(10), week, id(1), id(40)],
      );
    await db.query(
      "insert into class_week_closures(class_id,week_start,winner_id) values($1,'2026-11-02',$2)",
      [id(10), id(1)],
    );
    await reset(id(32), falling);
    assert.equal((await q('select count(*)::int n from class_week_scores')).n, 1);
    assert.equal((await total()).stars, 15);
    assert.equal((await q('select count(*)::int n from player_lesson_progress')).n, 1);
    const board = (await q('select tipy_class_star_board($1,$2) r', [id(5), id(10)])).r;
    assert.equal(board.memberCount, 1);
    assert.equal(board.lessons[0].stars, 3, 'teacher/weekly stars excluded from lesson ranking');
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query("select tipy_teacher_gift($1,$2,$3,1,'')", [id(5), id(1), id(99)]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select tipy_student_reset($1,$2,$3,$4,'accept')", [id(5), id(1), quest, id(99)]),
      /permission denied/,
    );
    await assert.rejects(db.query('select * from student_admin_actions'), /permission denied/);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
