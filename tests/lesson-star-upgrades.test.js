import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createKeyboardQuest } from '../server/modules/keyboard-quest.js';
import { LESSONS } from '../src/features/keyboard-quest/curriculum.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('saved completion retry returns its delta, not the total already awarded for that lesson', async () => {
  const row = {
    lesson_id: 'keys-as',
    last_play_id: id(30),
    award_play_id: id(30),
    awarded_stars: 3,
    last_award_delta: 1,
  };
  const service = createKeyboardQuest({
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { game_id: id(10) } }),
        then(resolve) {
          return resolve({ data: [row] });
        },
      };
    },
    rpc() {
      assert.fail('retry must not award again');
    },
  });
  const result = await service.questFinish({ user_id: id(1) }, { playId: id(30) });
  assert.equal(result.progress.award_this_play, 1);
  assert.equal(result.progress.awarded_stars, 3);
});

test('progressive lesson rewards: full matrix, migration, duplicate/concurrent tabs, reload, reset and isolated reward sources', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);`,
    );
    for (const file of ['schema', 'compact_results', 'classrooms', 'keyboard_quest'])
      await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    for (const n of [1, 5])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: 'fixture' + n, full_name: 'Fixture ' + n },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [id(5)]);
    const q = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const game = (await q("select game_id from games where game_code='keyboard_quest'")).game_id;
    await db.query('update games set is_active=true where game_id=$1', [game]);
    await db.query(
      "insert into player_lesson_progress(user_id,game_id,lesson_id,completed,best_stars) values($1,$2,'legacy-test',true,3)",
      [id(1), game],
    );
    await db.exec(readFileSync('db/stars.sql', 'utf8'));
    await db.exec(readFileSync('db/student_actions.sql', 'utf8'));
    const begin = async (lesson) =>
      (
        await q('select tipy_begin_play($1,$2,null,$3,$4,1) r', [
          id(1),
          game,
          [],
          { lesson_id: lesson, curriculum_version: 1 },
        ])
      ).r;
    const finish = async (play, lesson, stars) => {
      await db.query(
        "update active_plays set started_at=now()-interval '20 seconds' where play_id=$1",
        [play.play_id],
      );
      return (
        await q('select tipy_finish_quest_lesson($1,$2,$3,$4,$5) r', [
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
            completed: stars > 0,
            stars,
            accuracy: 90,
            correct: 10,
            wrong: 1,
            weakKeys: {},
            weakRules: {},
          },
        ])
      ).r;
    };
    const total = async () => (await q('select tipy_star_total($1) r', [id(1)])).r;
    const oldPlay = await begin('existing-test');
    await finish(oldPlay, 'existing-test', 1);
    await db.query(
      "insert into star_rewards(user_id,source,source_key,amount) values($1,'weekly','fixture-week',5)",
      [id(1)],
    );
    await q("select tipy_teacher_gift($1,$2,$3,7,'Fixture only')", [id(5), id(1), id(50)]);
    const before = await total();
    await db.exec(readFileSync('db/lesson_star_upgrades.sql', 'utf8'));
    assert.deepEqual(await total(), before, 'migration never backfills or regrants stars');
    assert.equal(
      (await finish(oldPlay, 'existing-test', 1)).award_this_play,
      1,
      'pre-migration receipt retry remains stable',
    );
    assert.equal(
      (await finish(await begin('existing-test'), 'existing-test', 2)).award_this_play,
      1,
    );
    assert.equal(
      (await finish(await begin('legacy-test'), 'legacy-test', 1)).award_this_play,
      1,
      'legacy best=3 does not grant three stars from historical snapshots',
    );
    assert.equal(
      (await q("select best_stars from player_lesson_progress where lesson_id='legacy-test'"))
        .best_stars,
      3,
    );
    const cases = [
      [0, 2, 2],
      [1, 1, 0],
      [1, 2, 1],
      [1, 3, 2],
      [2, 2, 0],
      [2, 1, 0],
      [2, 3, 1],
      [3, 3, 0],
    ];
    for (const [index, [prior, stars, extra]] of cases.entries()) {
      const lesson = LESSONS[index].id;
      if (prior) await finish(await begin(lesson), lesson, prior);
      const balance = (await total()).stars,
        play = await begin(lesson);
      const [saved, retried] = await Promise.all([
        finish(play, lesson, stars),
        finish(play, lesson, stars),
      ]);
      assert.equal(saved.award_this_play, extra, `${prior}→${stars}`);
      assert.equal(retried.award_this_play, extra, 'same play retains the same delta');
      assert.equal(saved.awarded_stars, Math.max(prior, stars));
      assert.equal((await total()).stars, balance + extra, 'duplicates cannot add a second award');
      const reloaded = await q(
        'select awarded_stars,last_award_delta,attempts from player_lesson_progress where user_id=$1 and game_id=$2 and lesson_id=$3',
        [id(1), game, lesson],
      );
      assert.equal(reloaded.awarded_stars, Math.max(prior, stars));
      assert.equal(reloaded.last_award_delta, extra);
      assert.equal(reloaded.attempts, prior ? 2 : 1);
      const receipt = await q(
        "select amount from star_rewards where user_id=$1 and source='lesson' and source_key=$2",
        [id(1), game + ':' + lesson],
      );
      assert.equal(receipt.amount, Math.max(prior, stars));
    }
    const firstTab = await begin('two-tabs'),
      secondTab = await begin('two-tabs');
    const [stale, current] = await Promise.all([
      finish(firstTab, 'two-tabs', 3),
      finish(secondTab, 'two-tabs', 2),
    ]);
    assert.equal(stale.superseded, true);
    assert.equal(current.award_this_play, 2);
    const thirdTab = await begin('two-tabs');
    assert.equal((await finish(thirdTab, 'two-tabs', 3)).award_this_play, 1);
    assert.equal((await finish(await begin('two-tabs'), 'two-tabs', 1)).award_this_play, 0);
    assert.equal((await finish(await begin('not-complete'), 'not-complete', 0)).award_this_play, 0);
    const balance = await total();
    assert.equal(balance.teacherStars, 7);
    assert.equal(balance.weeklyStars, 5);
    await db.query("insert into classes(class_id,name,created_by) values($1,'Fixture class',$2)", [
      id(60),
      id(5),
    ]);
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(60), id(1)]);
    const board = (await q('select tipy_class_star_board($1,$2) r', [id(5), id(60)])).r;
    assert.equal(
      board.lessons[0].stars,
      balance.lessonStars,
      'class leaderboard matches actual awarded stars',
    );
    await q("select tipy_student_reset($1,$2,$3,$4,'accept')", [id(5), id(1), game, id(51)]);
    assert.deepEqual(await total(), { stars: 12, lessonStars: 0, weeklyStars: 5, teacherStars: 7 });
    assert.equal((await finish(await begin(LESSONS[0].id), LESSONS[0].id, 2)).award_this_play, 2);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select tipy_finish_quest_lesson($1,$2,$3,$4,$5)', [
        id(1),
        id(99),
        'keys-as',
        {},
        {},
      ]),
      /permission denied/,
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
