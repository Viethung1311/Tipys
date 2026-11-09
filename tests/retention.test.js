import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('bounded result storage preserves best/latest and lifetime time without double counting retries', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
    );
    await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    const user = '11111111-1111-4111-8111-111111111111';
    await db.query('insert into auth.users values($1,$2,$3)', [
      user,
      { username: 'test', full_name: 'Test' },
      {},
    ]);
    const game = (await db.query('select game_id from games')).rows[0].game_id;
    await db.query(
      "insert into play_history(user_id,game_id,score,active_seconds,result,started_at,ended_at) values($1,$2,20,7,'quit',now()-interval '10 seconds',now())",
      [user, game],
    );
    const sql = readFileSync(new URL('../db/compact_results.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const start = async () => {
      const row = (
        await db.query('select tipy_begin_play($1,$2,$3,$4,$5,null) as play', [
          user,
          game,
          'easy',
          ['F'],
          {},
        ])
      ).rows[0].play;
      await db.query(
        "update active_plays set started_at=now()-interval '120 seconds' where play_id=$1",
        [row.play_id],
      );
      return row.play_id;
    };
    const save = async (id, seconds, score, result = 'quit') =>
      (
        await db.query('select tipy_save_play($1,$2,$3) as play', [
          user,
          id,
          {
            active_seconds: seconds,
            score,
            result,
            ended_at: result === 'in_progress' ? null : new Date().toISOString(),
            stage_number: null,
            metrics: { correct: score / 10, wrong: 0, missed: 0 },
          },
        ])
      ).rows[0].play;
    let id = await start();
    await save(id, 4, 40, 'in_progress');
    await save(id, 4, 40, 'in_progress');
    await save(id, 10, 100);
    await save(id, 10, 100);
    id = await start();
    await save(id, 6, 60);
    id = await start();
    await save(id, 8, 80);
    let stat = (await db.query('select * from player_game_stats')).rows[0];
    assert.equal(Number(stat.total_active_seconds), 31);
    assert.equal(Number(stat.total_plays), 4);
    assert.equal(stat.best_play.score, 100);
    assert.equal(stat.latest_play.score, 80);
    assert.equal((await db.query('select * from active_plays')).rows.length, 1);
    assert.deepEqual((await db.query('select metrics from active_plays')).rows[0].metrics, {});
    assert.equal((await db.query('select * from play_history')).rows.length, 1);
    const old = await start();
    await save(old, 2, 20, 'in_progress');
    await start();
    const stale = await save(old, 90, 900);
    assert.equal(stale.superseded, true);
    stat = (await db.query('select * from player_game_stats')).rows[0];
    assert.equal(Number(stat.total_active_seconds), 33);
    assert.equal(stat.latest_play.score, 20);
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';`,
    );
    assert.equal((await db.query('select * from player_game_stats')).rows.length, 0);
    await assert.rejects(db.query('select tipy_save_play($1,$2,$3)', [user, old, {}]));
  } finally {
    await db.close();
  }
});
