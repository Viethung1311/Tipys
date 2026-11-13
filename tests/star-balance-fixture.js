import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const balanceMigration = 'supabase/migrations/20261113080419_student_star_balance_reset.sql';
export async function starFixture() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);`);
  for (const file of [
    'schema',
    'compact_results',
    'classrooms',
    'keyboard_quest',
    'stars',
    'student_actions',
    'lesson_star_upgrades',
    'admin_students',
  ])
    await db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
  for (const n of [1, 2, 3, 4, 5, 6, 7, 99])
    await db.query('insert into auth.users values($1,$2,$3)', [
      id(n),
      { username: `fixture${n}`, full_name: `Học sinh thử ${n}` },
      {},
    ]);
  await db.query("update profiles set role='admin' where user_id=$1", [id(99)]);
  const q = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const game = (await q("select game_id from games where game_code='keyboard_quest'")).game_id;
  await db.query('update games set is_active=true where game_id=$1', [game]);
  await db.query("insert into classes(class_id,name,created_by) values($1,'Lớp thử',$2)", [
    id(50),
    id(99),
  ]);
  for (let n = 1; n <= 7; n++)
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(n)]);
  // Existing gifts must enter the new ranking without being awarded again.
  await db.query("select tipy_teacher_gift($1,$2,$3,7,'Quà cũ')", [id(99), id(1), id(90)]);
  await db.exec(readFileSync(balanceMigration, 'utf8'));
  const total = async (user = id(1)) => (await q('select tipy_star_total($1) r', [user])).r;
  const gift = async (request, amount, user = id(1)) =>
    (await q("select tipy_teacher_gift($1,$2,$3,$4,'Quà thử') r", [id(99), user, request, amount]))
      .r;
  const reset = async (request, user = id(1), confirm = 'accept', actor = id(99)) =>
    (await q('select tipy_reset_stars($1,$2,$3,$4) r', [actor, user, request, confirm])).r;
  const board = async (actor = id(99)) =>
    (await q('select tipy_class_star_board($1,$2) r', [actor, id(50)])).r;
  const finish = async (lesson, stars) => {
    const play = (
      await q('select tipy_begin_play($1,$2,null,$3,$4,1) r', [
        id(1),
        game,
        [],
        { lesson_id: lesson, curriculum_version: 1 },
      ])
    ).r;
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
          completed: true,
          stars,
          accuracy: 100,
          correct: 10,
          wrong: 0,
          weakKeys: {},
          weakRules: {},
        },
      ])
    ).r;
  };
  return { db, q, game, total, gift, reset, board, finish };
}
