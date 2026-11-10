import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { LESSONS, findLesson, isUnlocked } from '../src/features/keyboard-quest/curriculum.js';
import {
  matchesTarget,
  createAnswers,
  gradeLesson,
  updatedProgress,
  errorKind,
} from '../src/features/keyboard-quest/engine.js';
import {
  validateQuestFinish,
  questStart,
  createKeyboardQuest,
} from '../server/modules/keyboard-quest.js';
import { createHandler } from '../api/tipy.js';
import { ApiError } from '../server/errors.js';
import { validateProgress } from '../server/modules/game-validation.js';
import { createLessonSession } from '../src/features/keyboard-quest/session.js';

const answersFor = (lesson) =>
  createAnswers(lesson).map((row, index) => ({ ...row, answer: lesson.items[index].target }));
test('quest API requires an existing session; locked lessons and reset cannot target another user', async () => {
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://test.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      TIPY_AUTH_SECRET: 'x'.repeat(32),
    },
    makeBackend: () => ({
      session: async () => {
        throw new ApiError(401, 'Đăng nhập trước nhé.');
      },
    }),
  });
  for (const action of ['quest_progress', 'quest_finish', 'quest_reset']) {
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await handler(
      {
        method: action === 'quest_progress' ? 'GET' : 'POST',
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        query: { action },
        body: { action, userId: 'someone-else' },
      },
      res,
    );
    assert.equal(res.code, 401);
  }
  const calls = [];
  const db = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { game_id: 'quest' } }),
        then(resolve, reject) {
          return Promise.resolve({ data: [] }).then(resolve, reject);
        },
      };
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: {} };
    },
  };
  const profile = { user_id: 'session-owner' };
  await assert.rejects(
    questStart(
      db,
      profile,
      { game_id: 'quest', config: {} },
      { stageNumber: 2, lessonId: 'keys-asdf' },
    ),
    (error) => error.status === 403,
  );
  await questStart(
    db,
    profile,
    { game_id: 'quest', config: {} },
    { stageNumber: 16, lessonId: 'telex-demo', userId: 'someone-else' },
  );
  assert.equal(calls[0].args.p_user, 'session-owner');
  assert.equal(createKeyboardQuest(db).questReset, undefined);
});
test('quest grading preserves Unicode, case and spacing; unlocks use completed lessons', () => {
  assert.ok(matchesTarget('a\u0301', 'á'));
  assert.ok(!matchesTarget(' Me', 'Me'));
  assert.ok(!matchesTarget('me', 'Me'));
  assert.equal(errorKind(findLesson('telex-demo'), 'a', 'á'), 'telex');
  assert.equal(errorKind(findLesson('telex-demo'), 'b', 'á'), 'editing');
  assert.ok(!isUnlocked(LESSONS[1], []));
  assert.ok(isUnlocked(findLesson('telex-demo'), []));
  const lesson = LESSONS[0],
    answers = answersFor(lesson);
  let grade = gradeLesson(lesson, answers);
  assert.equal(grade.stars, 3);
  let progress = updatedProgress([], lesson, grade);
  assert.ok(isUnlocked(LESSONS[1], progress));
  answers[0].errors = 6;
  answers[0].position = 6;
  grade = gradeLesson(lesson, answers);
  assert.equal(grade.completed, false);
  assert.equal(grade.stars, 0);
  assert.deepEqual(grade.weakKeys, { A: 6 });
  progress = updatedProgress(progress, lesson, grade);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].best_stars, 3);
  assert.equal(progress[0].completed, true);
});
test('server derives stars and rejects incomplete, inconsistent or wrong-version results and generic completion', () => {
  const lesson = LESSONS[0],
    play = {
      stage_number: 1,
      score: 0,
      active_seconds: 0,
      started_at: new Date(0).toISOString(),
      games: { engine_code: 'keyboard_quest' },
      metrics: { config_snapshot: { lesson_id: lesson.id, curriculum_version: 1 } },
    };
  const answers = answersFor(lesson);
  assert.equal(validateQuestFinish(play, { answers, stars: 999 }).grade.stars, 3);
  assert.throws(() => validateQuestFinish(play, { answers: answers.slice(1) }));
  assert.throws(() =>
    validateQuestFinish(play, {
      answers: answers.map((row, i) => (i ? row : { ...row, answer: 'Z' })),
    }),
  );
  assert.throws(() =>
    validateQuestFinish(play, {
      answers: answers.map((row, i) => (i ? row : { ...row, errors: 1 })),
    }),
  );
  assert.throws(() => validateQuestFinish({ ...play, stage_number: 2 }, { answers }));
  assert.throws(() => validateProgress(play, { seconds: 1, score: 0, result: 'completed' }, 2000));
  assert.throws(() =>
    validateProgress(play, { seconds: 1, score: 0, result: 'in_progress', stageNumber: 2 }, 2000),
  );
  assert.equal(
    validateProgress(play, { seconds: 1, score: 0, result: 'quit' }, 2000).result,
    'quit',
  );
});
test('quest recorder serializes heartbeats, retries same play and stops after completion', async () => {
  const calls = [];
  let fail = true;
  const request = async (action, body) => {
    calls.push({ action, body });
    if (action === 'start') return { data: { play_id: 'same-play' } };
    if (action === 'quest_finish' && fail) {
      fail = false;
      throw Error('offline');
    }
    return { data: { progress: {} } };
  };
  const session = createLessonSession(LESSONS[0], request);
  await session.ready;
  await session.progress(9);
  await session.progress(10);
  await assert.rejects(session.finish(12, answersFor(LESSONS[0])));
  await session.finish(12, answersFor(LESSONS[0]));
  await session.progress(20);
  await session.quit(20);
  assert.deepEqual(
    calls.map((row) => row.action),
    ['start', 'progress', 'quest_finish', 'quest_finish'],
  );
  assert.ok(calls.slice(1).every((row) => row.body.playId === 'same-play'));
});
test('additive quest migration is repeatable, atomic, bounded, private and preserves lifetime stats on reset', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
    );
    for (const file of ['schema', 'compact_results', 'keyboard_quest', 'keyboard_quest'])
      await db.exec(readFileSync(new URL(`../db/${file}.sql`, import.meta.url), 'utf8'));
    const user = '11111111-1111-4111-8111-111111111111';
    await db.query('insert into auth.users values($1,$2,$3)', [
      user,
      { username: 'questtest', full_name: 'Test' },
      {},
    ]);
    const game = (await db.query("select * from games where game_code='keyboard_quest'")).rows[0];
    assert.equal(game.is_active, false);
    await db.query('update games set is_active=true where game_id=$1', [game.game_id]);
    const lesson = LESSONS[0],
      grade = gradeLesson(lesson, answersFor(lesson));
    const start = async () =>
      (
        await db.query('select tipy_begin_play($1,$2,null,$3,$4,1) as play', [
          user,
          game.game_id,
          [],
          { lesson_id: lesson.id, curriculum_version: 1 },
        ])
      ).rows[0].play.play_id;
    const finish = async (id, stars = 3) =>
      (
        await db.query('select tipy_finish_quest_lesson($1,$2,$3,$4,$5) as progress', [
          user,
          id,
          lesson.id,
          {
            score: 1000,
            active_seconds: 10,
            result: 'completed',
            ended_at: new Date().toISOString(),
            stage_number: 1,
            metrics: {},
          },
          { ...grade, stars },
        ])
      ).rows[0].progress;
    let id = await start();
    await db.query(
      "update active_plays set started_at=now()-interval '120 seconds' where play_id=$1",
      [id],
    );
    await assert.rejects(finish(id, 99));
    assert.equal((await db.query('select result from active_plays')).rows[0].result, 'in_progress');
    assert.equal(
      Number(
        (await db.query('select total_active_seconds from player_game_stats')).rows[0]
          .total_active_seconds,
      ),
      0,
    );
    await db.query(
      "update active_plays set started_at=now()-interval '120 seconds' where play_id=$1",
      [id],
    );
    await finish(id);
    await finish(id);
    assert.equal((await db.query('select * from player_lesson_progress')).rows[0].attempts, 1);
    id = await start();
    await db.query(
      "update active_plays set started_at=now()-interval '120 seconds' where play_id=$1",
      [id],
    );
    await finish(id);
    const stats = (await db.query('select * from player_game_stats')).rows[0];
    assert.equal(Number(stats.total_active_seconds), 20);
    assert.equal((await db.query('select * from player_lesson_progress')).rows.length, 1);
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';`,
    );
    assert.equal((await db.query('select * from player_lesson_progress')).rows.length, 0);
    await assert.rejects(db.query('select tipy_reset_quest_progress($1,$2)', [user, game.game_id]));
    await assert.rejects(db.query('delete from player_lesson_progress'));
    await db.exec(`set request.jwt.claim.sub='${user}';`);
    assert.equal((await db.query('select * from player_lesson_progress')).rows.length, 1);
    await db.exec('reset role');
    await db.query('select tipy_reset_quest_progress($1,$2)', [user, game.game_id]);
    assert.equal((await db.query('select * from player_lesson_progress')).rows.length, 0);
    assert.equal(
      Number(
        (await db.query('select total_active_seconds from player_game_stats')).rows[0]
          .total_active_seconds,
      ),
      20,
    );
    assert.equal((await finish(id)).superseded, true);
  } finally {
    await db.close();
  }
});
