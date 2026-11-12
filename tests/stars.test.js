import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { RANKED_HARD } from '../src/game/ranked.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('reward transactions: legacy exclusions, first completion, retries/tabs, fixed weekly rules, membership periods, ties and missed-week settlement', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);`,
    );
    for (const file of ['schema', 'compact_results', 'classrooms', 'keyboard_quest'])
      await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    for (let n = 1; n <= 5; n++)
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
    await db.query(
      "insert into player_lesson_progress(user_id,game_id,lesson_id,completed,best_stars) values($1,$2,'old-lesson',true,3)",
      [id(1), quest],
    );
    await db.exec(readFileSync('db/stars.sql', 'utf8'));
    const total = async (n) => (await db.query('select tipy_star_total($1) r', [id(n)])).rows[0].r;
    assert.equal((await total(1)).stars, 0);
    assert.equal(
      (
        await db.query(
          "select reward_status from player_lesson_progress where lesson_id='old-lesson'",
        )
      ).rows[0].reward_status,
      'legacy',
    );
    const begin = async (lesson) =>
      (
        await db.query('select tipy_begin_play($1,$2,null,$3,$4,1) r', [
          id(1),
          quest,
          [],
          { lesson_id: lesson, curriculum_version: 1 },
        ])
      ).rows[0].r;
    const finish = async (play, lesson, stars) => {
      await db.query(
        "update active_plays set started_at=now()-interval '20 seconds' where play_id=$1",
        [play.play_id],
      );
      return (
        await db.query('select tipy_finish_quest_lesson($1,$2,$3,$4,$5) r', [
          id(1),
          play.play_id,
          lesson,
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
            stars,
            accuracy: 90,
            correct: 10,
            wrong: 1,
            weakKeys: {},
            weakRules: {},
          },
        ])
      ).rows[0].r;
    };
    let play = await begin('keys-as');
    let row = await finish(play, 'keys-as', 1);
    assert.equal(row.award_this_play, 1);
    assert.equal((await total(1)).stars, 1);
    await finish(play, 'keys-as', 1);
    assert.equal((await total(1)).stars, 1);
    play = await begin('keys-as');
    row = await finish(play, 'keys-as', 3);
    assert.equal(row.best_stars, 3);
    assert.equal(row.awarded_stars, 1);
    assert.equal(row.award_this_play, 0);
    assert.equal((await total(1)).stars, 1);
    const old = await begin('keys-df'),
      current = await begin('keys-df');
    assert.equal((await finish(old, 'keys-df', 3)).superseded, true);
    await finish(current, 'keys-df', 2);
    assert.equal((await total(1)).lessonStars, 3);
    play = await begin('old-lesson');
    row = await finish(play, 'old-lesson', 3);
    assert.equal(row.reward_status, 'legacy');
    assert.equal(row.awarded_stars, 0);
    assert.equal(
      (
        await db.query(
          "select tipy_week_start('2026-11-08 16:59:59+00')::text a,tipy_week_start('2026-11-08 17:00:00+00')::text b",
        )
      ).rows[0].a,
      '2026-11-02',
    );
    assert.equal(
      (await db.query("select tipy_week_start('2026-11-08 17:00:00+00')::text b")).rows[0].b,
      '2026-11-09',
    );
    for (let c = 10; c <= 12; c++) {
      await db.query('insert into classes(class_id,name,created_by) values($1,$2,$3)', [
        id(c),
        'Test class ' + c,
        id(5),
      ]);
      for (let n = 1; n <= 4; n++)
        await db.query(
          "insert into class_members(class_id,user_id,joined_at) values($1,$2,now()-interval '30 days')",
          [id(c), id(n)],
        );
    }
    let ranked = (await db.query('select tipy_begin_ranked($1,$2) r', [id(1), falling])).rows[0].r;
    assert.deepEqual(ranked.metrics.config_snapshot.levels.hard, RANKED_HARD);
    const rankedFinish = async (p) => {
      await db.query(
        "update active_plays set started_at=now()-interval '20 seconds' where play_id=$1",
        [p.play_id],
      );
      return db.query('select tipy_save_play($1,$2,$3)', [
        id(1),
        p.play_id,
        {
          score: 30,
          active_seconds: 5,
          result: 'game_over',
          ended_at: new Date().toISOString(),
          stage_number: null,
          metrics: { ...p.metrics, correct: 3, wrong: 6, missed: 0 },
        },
      ]);
    };
    await rankedFinish(ranked);
    await rankedFinish(ranked);
    assert.equal((await db.query('select * from class_week_scores')).rows.length, 3);
    assert.equal(
      (await db.query('select tipy_close_star_weeks() n')).rows[0].n,
      0,
      'open week never settles',
    );
    // Joining after a round starts never adds that class to the captured enrollment list.
    ranked = (await db.query('select tipy_begin_ranked($1,$2) r', [id(1), falling])).rows[0].r;
    await db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
      id(10),
      id(1),
    ]);
    await db.query('update class_members set is_active=true where class_id=$1 and user_id=$2', [
      id(10),
      id(1),
    ]);
    await rankedFinish(ranked);
    const board = async (actor) =>
      (await db.query('select tipy_class_star_board($1,$2,null) r', [actor, id(10)])).rows[0].r;
    assert.equal(
      (await board(id(1))).weekly.length,
      0,
      'old membership results disappear after rejoin',
    );
    await assert.rejects(
      db.query('select tipy_class_star_board($1,$2,null)', [id(1), id(99)]),
      /access denied/,
    );
    await db.exec('delete from class_week_scores');
    // Two old weeks, tied points, different accuracy, earliest result, then stable user ID.
    for (const c of [10, 11, 12])
      for (const n of [1, 2, 3, 4]) {
        await db.query(
          `insert into class_week_scores(class_id,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence)
   select $1,tipy_week_start(now())-7,$2,'hard-v1',100,10,$3,3,20,gen_random_uuid(),now()-interval '8 days'+($4::integer*interval '1 second'),m.joined_at,'{}' from class_members m where m.class_id=$1 and m.user_id=$2`,
          [id(c), id(n), n === 1 ? 1 : 0, n === 1 ? 0 : n === 4 ? 20 : 10],
        );
      }
    await db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
      id(11),
      id(2),
    ]);
    await db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
      id(11),
      id(3),
    ]);
    // Copy a trusted test result into a second missed week to exercise catch-up.
    await db.exec(
      "insert into class_week_scores select class_id,week_start-7,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at-interval '7 days',joined_at,evidence from class_week_scores where class_id='00000000-0000-4000-8000-000000000010'",
    );
    await db.query('insert into classes(class_id,name,created_by) values($1,$2,$3)', [
      id(13),
      'No eligible students',
      id(5),
    ]);
    await db.query('insert into class_members(class_id,user_id,is_active) values($1,$2,false)', [
      id(13),
      id(1),
    ]);
    await db.query(
      'insert into class_week_scores select $1,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence from class_week_scores where class_id=$2 and user_id=$3 limit 1',
      [id(13), id(10), id(1)],
    );
    await assert.rejects(
      db.query('select tipy_class_star_board($1,$2,null)', [id(2), id(11)]),
      /access denied/,
    );
    assert.equal((await db.query('select tipy_close_star_weeks() n')).rows[0].n, 4);
    assert.equal(
      (await db.query('select winner_id from class_week_closures where class_id=$1', [id(13)]))
        .rows[0].winner_id,
      null,
      'no eligible round means no reward',
    );
    assert.equal(
      (await total(2)).weeklyStars,
      15,
      'separate classes and missed weeks reward independently',
    );
    assert.equal((await total(4)).weeklyStars, 5, 'removed top students cannot win');
    assert.equal((await db.query('select tipy_close_star_weeks() n')).rows[0].n, 0);
    assert.equal((await total(2)).stars, 15);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select tipy_close_star_weeks()'), /permission denied/);
    await assert.rejects(db.query('select * from star_rewards'), /permission denied/);
  } finally {
    await db.close();
  }
});
