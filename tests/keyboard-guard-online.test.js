import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createGames } from '../server/modules/games.js';
import { createHandler } from '../api/tipy.js';
import { defaultGuardSettings } from '../src/features/keyboard-guard/settings.js';
const row = () => ({
  game_id: 'guard-id',
  game_code: 'keyboard_guard',
  game_name: 'Vệ binh bàn phím',
  engine_code: 'keyboard_guard',
  description: 'Gõ từ để bảo vệ tàu',
  is_active: true,
  config: defaultGuardSettings(),
});
function storeDb() {
  let game = row(),
    writes = 0,
    rpcs = 0;
  const filters = [];
  return {
    get game() {
      return game;
    },
    get writes() {
      return writes;
    },
    get rpcs() {
      return rpcs;
    },
    filters,
    from(table) {
      assert.equal(table, 'games');
      return {
        select() {
          return this;
        },
        eq(k, v) {
          filters.push([k, v]);
          return this;
        },
        upsert(values) {
          writes++;
          game = { ...game, ...structuredClone(values) };
          return this;
        },
        single: async () => ({ data: structuredClone(game) }),
      };
    },
    rpc() {
      rpcs++;
      throw Error('Guard must not record account points or stars');
    },
  };
}
test('shared Guard config uses existing games row, validates nested waves and rejects non-admin before writes', async () => {
  const db = storeDb(),
    service = createGames(db),
    input = {
      gameCode: 'keyboard_guard',
      engineCode: 'keyboard_guard',
      name: 'Vệ binh bàn phím',
      active: true,
      config: defaultGuardSettings(),
    };
  for (const role of ['student', 'teacher'])
    await assert.rejects(
      service.saveGame({ role }, { ...input, role: 'admin' }),
      (e) => e.status === 403,
    );
  assert.equal(db.writes, 0);
  const bad = structuredClone(input);
  bad.config.stages[1].waves[1].maxActive = 6;
  await assert.rejects(service.saveGame({ role: 'admin' }, bad), (e) => e.status === 400);
  assert.equal(db.writes, 0);
  input.config.stages[2].waves[1].speed = 150;
  await service.saveGame({ role: 'admin' }, input);
  const deviceA = await service.guardConfig(),
    deviceB = await service.guardConfig();
  assert.equal(deviceA.game.config.stages[2].waves[1].speed, 150);
  assert.deepEqual(deviceA, deviceB);
  assert.equal(db.writes, 1);
  assert.ok(db.filters.some(([k, v]) => k === 'is_active' && v === true));
  await assert.rejects(
    service.start({ user_id: 'student', role: 'student' }, { gameCode: 'keyboard_guard' }),
    (e) => e.status === 400,
  );
  assert.equal(db.rpcs, 0);
});
test('Guard public config GET bypasses session only for read; save retains trusted backend admin checks', async () => {
  const db = storeDb();
  let sessions = 0;
  const env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    TIPY_AUTH_SECRET: 'test-only-secret-longer-than-32-characters',
    APP_ORIGIN: 'https://tipy.test',
  };
  const handler = createHandler({
    env,
    makeBackend: () => ({
      ...createGames(db),
      session: async () => {
        sessions++;
        return { profile: { role: 'student', user_id: 's' } };
      },
    }),
  });
  const response = () => ({
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });
  let res = response();
  await handler({ method: 'GET', headers: {}, query: { action: 'guard_config' } }, res);
  assert.equal(res.code, 200);
  assert.equal(sessions, 0);
  res = response();
  await handler(
    {
      method: 'POST',
      headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' },
      body: {
        action: 'save_game',
        gameCode: 'keyboard_guard',
        role: 'admin',
        config: defaultGuardSettings(),
      },
    },
    res,
  );
  assert.equal(res.code, 403);
  assert.equal(db.writes, 0);
  assert.equal(sessions, 1);
});

test('Guard catalog seed is idempotent, preserves existing games/config and keeps RLS read-only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    const before = (await db.query(`select game_code,config from games order by game_code`)).rows;
    const seed = readFileSync(new URL('../db/keyboard_guard.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    assert.equal(
      (await db.query(`select count(*)::int n from games where game_code='keyboard_guard'`)).rows[0]
        .n,
      1,
    );
    assert.deepEqual(
      (
        await db.query(
          `select game_code,config from games where game_code<>'keyboard_guard' order by game_code`,
        )
      ).rows,
      before,
    );
    await db.exec(`set role anon;`);
    assert.equal(
      (await db.query(`select count(*)::int n from games where game_code='keyboard_guard'`)).rows[0]
        .n,
      0,
    );
    await assert.rejects(
      db.exec(`update games set is_active=true where game_code='keyboard_guard'`),
    );
    await db.exec(
      `reset role;update games set is_active=true where game_code='keyboard_guard';set role authenticated;`,
    );
    assert.equal(
      (await db.query(`select config from games where game_code='keyboard_guard'`)).rows[0].config
        .version,
      3,
    );
    await assert.rejects(db.exec(`update games set config='{}' where game_code='keyboard_guard'`));
    await db.exec(
      `reset role;update games set config=jsonb_set(config,'{stages,1,speed}','150') where game_code='keyboard_guard';`,
    );
    await db.exec(seed);
    assert.equal(
      (await db.query(`select config from games where game_code='keyboard_guard'`)).rows[0].config
        .stages[1].speed,
      150,
    );
  } finally {
    await db.close();
  }
});
