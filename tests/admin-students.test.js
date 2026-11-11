import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createStudents } from '../server/modules/students.js';
import { createHandler } from '../api/tipy.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = { role: 'admin', user_id: id(99) };

test('HTTP endpoints ignore forged admin fields and enforce the authenticated student role before database access', async () => {
  const backend = {
    ...createStudents({
      from() {
        throw Error('No database access allowed');
      },
      rpc() {
        throw Error('No database access allowed');
      },
    }),
    session: async () => ({ profile: { role: 'student', user_id: id(2) } }),
  };
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      TIPY_AUTH_SECRET: 'x'.repeat(40),
    },
    makeBackend: () => backend,
  });
  for (const request of [
    { method: 'GET', headers: {}, query: { action: 'students_page', role: 'admin' } },
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://tipys.vercel.app' },
      body: { action: 'student_delete', userId: id(1), confirmUsername: 'kid', role: 'admin' },
    },
  ]) {
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
    await handler(request, res);
    assert.equal(res.code, 403);
  }
});

test('real SQL filters and sorts all students before seven-row pages; cascades personal data atomically and protects shared classes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create table auth.users(id uuid primary key);
   create table profiles(user_id uuid primary key references auth.users(id) on delete restrict,username text,full_name text,role text,is_active boolean);
   create table classes(class_id uuid primary key,name text,archived_at timestamptz,created_by uuid references profiles(user_id));
   create table class_members(user_id uuid references profiles(user_id),class_id uuid references classes(class_id),is_active boolean);
   create table player_game_stats(user_id uuid references profiles(user_id),total_active_seconds bigint,total_plays bigint);
   create table play_history(user_id uuid references profiles(user_id));create table active_plays(user_id uuid references profiles(user_id));
   create table student_avatars(user_id uuid references profiles(user_id));create table player_lesson_progress(user_id uuid references profiles(user_id));
   create table class_posts(author_id uuid references profiles(user_id));create table class_attachments(uploaded_by uuid references profiles(user_id));`);
    for (let n = 1; n <= 16; n++) await db.query(`insert into auth.users values($1);`, [id(n)]);
    await db.query(`insert into auth.users values($1)`, [id(99)]);
    await db.query(`insert into profiles values($1,'admin','Teacher','admin',true)`, [id(99)]);
    for (let n = 1; n <= 16; n++) {
      await db.query(`insert into profiles values($1,$2,$3,'student',true)`, [
        id(n),
        `kid${n}`,
        `Bạn ${n}`,
      ]);
      await db.query(`insert into player_game_stats values($1,$2,1)`, [id(n), n * 60]);
    }
    await db.query(`insert into classes values($1,'STEM A',null,$3),($2,'STEM B',null,$3)`, [
      id(50),
      id(51),
      id(99),
    ]);
    for (let n = 1; n <= 8; n++)
      await db.query(`insert into class_members values($1,$2,true)`, [id(n), id(50)]);
    await db.query(`insert into class_members values($1,$2,true)`, [id(1), id(51)]);
    const sql = readFileSync(new URL('../db/admin_students.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const page = async (
      p = 1,
      search = '',
      cls = 'all',
      sort = 'desc',
      roster = null,
      membership = 'all',
    ) =>
      (
        await db.query(`select tipy_students_page($1,$2,$3,$4,$5,$6) result`, [
          p,
          search,
          cls,
          sort,
          roster,
          membership,
        ])
      ).rows[0].result;
    let result = await page();
    assert.equal(result.total, 16);
    assert.equal(result.pages, 3);
    assert.equal(result.students.length, 7);
    assert.equal(result.students[0].username, 'kid16');
    assert.equal(result.summary.seconds, 8160);
    result = await page(99);
    assert.equal(result.page, 3);
    assert.equal(result.students.length, 2);
    result = await page(1, 'Bạn', id(50), 'asc');
    assert.equal(result.total, 8);
    assert.equal(result.students[0].username, 'kid1');
    assert.equal(result.students[0].classes.length, 2);
    assert.equal((await page(1, '', 'none')).total, 8);
    assert.equal((await page(1, '', 'all', 'desc', id(50), 'members')).total, 8);
    assert.equal((await page(1, 'kid1', id(50))).total, 1);
    assert.equal(
      (
        await db.query(
          `select has_function_privilege('anon','tipy_students_page(integer,text,text,text,uuid,text)','execute') allowed`,
        )
      ).rows[0].allowed,
      false,
    );
    for (const t of ['play_history', 'active_plays', 'student_avatars', 'player_lesson_progress'])
      await db.query(`insert into ${t} values($1)`, [id(1)]);
    await db.query(`delete from auth.users where id=$1`, [id(1)]);
    for (const t of [
      'profiles',
      'class_members',
      'player_game_stats',
      'play_history',
      'active_plays',
      'student_avatars',
      'player_lesson_progress',
    ])
      assert.equal(
        (await db.query(`select count(*)::int count from ${t} where user_id=$1`, [id(1)])).rows[0]
          .count,
        0,
      );
    assert.equal((await db.query('select count(*)::int count from classes')).rows[0].count, 2);
    await db.query(`insert into class_posts values($1)`, [id(2)]);
    await assert.rejects(db.query(`delete from auth.users where id=$1`, [id(2)]));
    assert.equal(
      (await db.query(`select count(*)::int count from profiles where user_id=$1`, [id(2)])).rows[0]
        .count,
      1,
    );
    assert.equal(
      (
        await db.query(`select count(*)::int count from player_game_stats where user_id=$1`, [
          id(2),
        ])
      ).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});

function mock({
  role = 'student',
  name = 'kid',
  shared = 0,
  deleteFails = false,
  uncertain = false,
  alreadyDeleted = false,
} = {}) {
  let exists = !alreadyDeleted;
  const calls = [];
  const db = {
    calls,
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        async maybeSingle() {
          return {
            data: exists
              ? table === 'profiles'
                ? { user_id: id(1), username: name, role }
                : null
              : null,
          };
        },
        then(resolve) {
          resolve({ count: shared });
        },
      };
      return q;
    },
    auth: {
      admin: {
        async deleteUser(userId, soft) {
          calls.push({ userId, soft });
          if (!deleteFails) exists = false;
          return { error: deleteFails ? {} : null };
        },
        async getUserById() {
          return uncertain
            ? { error: { status: 503 } }
            : exists
              ? { data: { user: { id: id(1) } } }
              : { error: { status: 404 } };
        },
      },
    },
  };
  return db;
}
test('delete requires backend admin, exact confirmation and student role; refuses self and shared data', async () => {
  for (const [profile, input, options, status] of [
    [{ role: 'student' }, {}, {}, 403],
    [admin, { userId: id(99), confirmUsername: 'kid' }, {}, 403],
    [admin, { userId: id(1), confirmUsername: 'wrong' }, {}, 403],
    [admin, { userId: id(1), confirmUsername: 'kid' }, { role: 'admin' }, 403],
    [admin, { userId: id(1), confirmUsername: 'kid' }, { shared: 1 }, 409],
  ]) {
    const db = mock(options);
    await assert.rejects(
      createStudents(db).studentDelete(profile, input),
      (e) => e.status === status,
    );
    assert.equal(db.calls.length, 0);
  }
});
test('delete only reports success after Auth and profile are absent; retries after lost responses are safe', async () => {
  for (const options of [{}, { alreadyDeleted: true }]) {
    const db = mock(options);
    assert.equal(
      (await createStudents(db).studentDelete(admin, { userId: id(1), confirmUsername: 'kid' }))
        .deleted,
      true,
    );
    assert.equal(db.calls.length, options.alreadyDeleted ? 0 : 1);
    if (db.calls.length) assert.equal(db.calls[0].soft, false);
  }
  for (const options of [{ deleteFails: true }, { uncertain: true }])
    await assert.rejects(
      createStudents(mock(options)).studentDelete(admin, { userId: id(1), confirmUsername: 'kid' }),
      (e) => e.status === 503,
    );
});
test('paged API checks admin and rejects invalid filters before querying', async () => {
  let called = 0;
  const service = createStudents({
    rpc: async (name, args) => {
      called++;
      return { data: args };
    },
  });
  await assert.rejects(service.studentsPage({ role: 'student' }, {}), (e) => e.status === 403);
  for (const input of [
    { page: 0 },
    { page: 'x' },
    { sort: 'SQL' },
    { classFilter: 'bad' },
    { membership: 'members' },
    { search: 'x'.repeat(101) },
  ])
    await assert.rejects(service.studentsPage(admin, input));
  assert.equal(called, 0);
  const r = await service.studentsPage(admin, { page: '2', sort: 'asc', classFilter: 'none' });
  assert.equal(r.p_page, 2);
  assert.equal(r.p_sort, 'asc');
});
