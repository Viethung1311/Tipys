import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  credential,
  username,
  requireAdmin,
  validateProgress,
  validateLevels,
  createBackend,
  emailFor,
} from '../server/backend.js';
import { createHandler, readCookies } from '../api/tipy.js';
import { playRecorder } from '../src/game/backend.js';
test('student PINs of any nonempty length work without treating frontend data as roles', () => {
  for (const pin of ['1', 'a', '123', 'a long phrase'])
    assert.equal(credential('banan', pin, 'test-secret').length, 64);
  assert.notEqual(credential('a', '1', 'secret'), credential('b', '1', 'secret'));
  assert.throws(() => credential('a', '', 'secret'));
  assert.equal(username(' BaNAn '), 'banan');
  assert.throws(() => username('a@evil.com'));
  assert.throws(() => requireAdmin({ role: 'student', user_metadata: { role: 'admin' } }));
  assert.doesNotThrow(() => requireAdmin({ role: 'admin' }));
});
test('server rejects forged score/time, inconsistent game-over and backwards progress', () => {
  const play = {
    score: 10,
    active_seconds: 1,
    started_at: new Date(0).toISOString(),
    metrics: { correct: 1 },
    games: { engine_code: 'falling_letters' },
  };
  const input = {
    seconds: 10,
    score: 20,
    result: 'game_over',
    metrics: { correct: 2, wrong: 1, missed: 3 },
  };
  assert.equal(validateProgress(play, input, 10000).score, 20);
  assert.throws(() => validateProgress(play, { ...input, score: 999 }, 10000));
  assert.throws(() => validateProgress(play, { ...input, seconds: 1000 }, 10000));
  assert.throws(() =>
    validateProgress(play, { ...input, metrics: { correct: 2, wrong: 0, missed: 1 } }, 10000),
  );
  assert.throws(() => validateProgress(play, { ...input, result: 'completed' }, 10000));
});
test('teacher configuration rejects impossible speeds and oversized letter density', () => {
  const levels = Object.fromEntries(
    ['easy', 'normal', 'hard'].map((key) => [
      key,
      { fall: 9, minFall: 5, spawn: 2, minSpawn: 1, max: 4 },
    ]),
  );
  validateLevels(levels);
  assert.throws(() => validateLevels({ ...levels, easy: { ...levels.easy, max: 100 } }));
  assert.throws(() => validateLevels({ ...levels, easy: { ...levels.easy, minFall: 0.01 } }));
});
test('future games can store stage completion and custom metrics without overwriting configuration snapshots', () => {
  const play = {
    score: 0,
    active_seconds: 0,
    started_at: new Date(0).toISOString(),
    stage_number: 1,
    metrics: { config_snapshot: { version: 1 } },
    games: { engine_code: 'math_game' },
  };
  const values = validateProgress(
    play,
    {
      seconds: 12,
      score: 50,
      result: 'completed',
      stageNumber: 2,
      metrics: { answers: 5, config_snapshot: { version: 999 } },
    },
    12000,
  );
  assert.equal(values.stage_number, 2);
  assert.equal(values.metrics.details.answers, 5);
  assert.deepEqual(values.metrics.config_snapshot, { version: 1 });
  assert.throws(() =>
    validateProgress(
      { ...play, stage_number: 3 },
      { seconds: 12, score: 50, stageNumber: 2 },
      12000,
    ),
  );
});
const response = () => ({
  headers: {},
  setHeader(key, value) {
    this.headers[key] = value;
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
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only',
  TIPY_AUTH_SECRET: 's'.repeat(40),
  APP_ORIGIN: 'https://tipys.vercel.app',
};
test('API blocks cross-origin writes, non-JSON bodies and unsupported methods before backend access', async () => {
  let calls = 0;
  const handler = createHandler({
    env,
    makeBackend: () => {
      calls++;
      return {};
    },
  });
  for (const [req, status] of [
    [
      {
        method: 'POST',
        headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
      },
      403,
    ],
    [{ method: 'POST', headers: { origin: env.APP_ORIGIN, 'content-type': 'text/plain' } }, 415],
    [{ method: 'DELETE', headers: {} }, 405],
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.code, status);
  }
  assert.equal(calls, 0);
});
test('sessions use HttpOnly Secure cookies, never JSON tokens; unconfigured site stays usable', async () => {
  const login = createHandler({
    env,
    makeBackend: () => ({
      auth: async () => ({
        profile: { user_id: 'student' },
        session: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 },
      }),
    }),
  });
  const res = response();
  await login(
    {
      method: 'POST',
      headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' },
      body: { action: 'login', username: 'student', password: '1' },
    },
    res,
  );
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { user: { user_id: 'student' } });
  assert.ok(
    res.headers['Set-Cookie'].every(
      (cookie) =>
        cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Lax'),
    ),
  );
  assert.equal(readCookies('tipy_access=abc; tipy_refresh=def').tipy_refresh, 'def');
  const offline = response();
  await createHandler({ env: {} })({ method: 'GET', headers: {}, query: {} }, offline);
  assert.equal(offline.body.configured, false);
});
test('play persistence queues heartbeats before final result and retries do not duplicate completion', async () => {
  const calls = [],
    errors = [];
  const request = async (action, input) => {
    calls.push([action, input]);
    return { data: { play_id: 'play-1' } };
  };
  const recorder = playRecorder(
    {},
    { difficulty: 'easy', keys: ['F'] },
    (error) => errors.push(error),
    request,
  );
  const state = { elapsed: 10, score: 10, correct: 1, wrong: 0, missed: 0 };
  recorder.update(state);
  await recorder.update({ ...state, elapsed: 11, missed: 3 }, 'game_over');
  await recorder.update({ ...state, elapsed: 11, missed: 3 }, 'game_over');
  assert.deepEqual(
    calls.map(([action]) => action),
    ['start', 'progress', 'progress'],
  );
  assert.equal(calls[2][1].result, 'game_over');
  assert.deepEqual(errors, []);
});
test('server always provisions student role on signup and bootstraps admin only with the configured secret', async () => {
  const created = [];
  let existing = false;
  let profile = { user_id: 'student-1', role: 'student', is_active: true };
  const db = {
    rpc: async () => ({ data: true }),
    from: () => ({
      select() {
        return this;
      },
      update() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: existing ? { user_id: 'admin-1', role: 'admin' } : null }),
      single: async () => ({ data: profile }),
    }),
    auth: {
      admin: {
        updateUserById: async () => ({ data: {} }),
        createUser: async (values) => {
          created.push(values);
          return { data: { user: { id: 'user-1' } } };
        },
      },
      signInWithPassword: async () => ({
        data: { user: { id: profile.user_id }, session: { access_token: 'a' } },
      }),
    },
  };
  const backend = createBackend(
    { ...env, TIPY_ADMIN_INITIAL_PASSWORD: 'test-initial-password' },
    () => db,
  );
  await backend.auth(
    'signup',
    { username: 'banan', fullName: 'Bạn An', password: '1', role: 'admin' },
    'test-ip',
  );
  assert.equal(created[0].app_metadata.tipy_role, 'student');
  assert.notEqual(created[0].password, '1');
  assert.equal(created[0].email, emailFor('banan'));
  await assert.rejects(
    backend.auth('signup', { username: 'admin', fullName: 'Fake', password: '1' }, 'test-ip'),
  );
  profile = { user_id: 'admin-1', role: 'admin', is_active: true };
  await backend.auth(
    'login',
    { username: 'admin', password: 'not-the-initial-password' },
    'test-ip',
  );
  assert.equal(created.length, 1);
  await backend.auth('login', { username: 'admin', password: 'test-initial-password' }, 'test-ip');
  assert.equal(created[1].app_metadata.tipy_role, 'admin');
  existing = true;
  await backend.auth('login', { username: 'admin', password: 'test-initial-password' }, 'test-ip');
  assert.equal(created.length, 2);
});
