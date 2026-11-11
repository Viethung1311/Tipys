import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createClassrooms } from '../server/modules/classrooms.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = { user_id: id(1), role: 'admin' };

test('class deletion transaction scopes rows, preserves shared files, checks role/name/archive and retries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
   create table profiles(user_id uuid primary key,role text,is_active boolean);
   create table classes(class_id uuid primary key,name text,archived_at timestamptz);
   create table class_members(class_id uuid references classes,user_id uuid references profiles);
   create table class_posts(post_id uuid primary key,class_id uuid references classes,body text,link text);
   create table class_attachments(class_id uuid references classes,post_id uuid references class_posts,storage_path text unique);
   create table student_avatars(user_id uuid references profiles);
   create table player_game_stats(user_id uuid references profiles);
  `);
    await db.exec(readFileSync('db/class_delete.sql', 'utf8'));
    await db.query(`insert into profiles values($1,'admin',true),($2,'student',true)`, [
      id(1),
      id(2),
    ]);
    await db.query(`insert into classes values($1,'Lớp thử',null),($2,'Lớp khác',null)`, [
      id(3),
      id(4),
    ]);
    await db.query('insert into class_members values($1,$2),($3,$2)', [id(3), id(2), id(4)]);
    await db.query('insert into student_avatars values($1)', [id(2)]);
    await db.query('insert into player_game_stats values($1)', [id(2)]);
    const call = (actor = id(1), name = 'Lớp thử') =>
      db.query('select tipy_delete_class($1,$2,$3) result', [actor, id(3), name]);
    await assert.rejects(call(id(2)), /quản trị/);
    await assert.rejects(call(), /lưu trữ/);
    await db.query('update classes set archived_at=now() where class_id=$1', [id(3)]);
    await assert.rejects(call(id(1), 'sai'), /xác nhận/);
    await db.query(`insert into class_posts values($1,$2,'',''),($3,$4,'',$5)`, [
      id(5),
      id(3),
      id(6),
      id(4),
      `https://files/${id(3)}/shared.png`,
    ]);
    await db.query(
      'insert into class_attachments values($1,$2,$3),($1,null,$4),($1,null,$5),($6,$7,$8)',
      [
        id(3),
        id(5),
        `${id(3)}/solo.previewable.png`,
        `${id(3)}/shared.png`,
        `${id(4)}/foreign.png`,
        id(4),
        id(6),
        `${id(4)}/keep.png`,
      ],
    );
    // An unknown dependency must roll the entire transaction back.
    await db.exec('create table future_comments(class_id uuid references classes);');
    await db.query('insert into future_comments values($1)', [id(3)]);
    await assert.rejects(call(), /foreign key/);
    assert.equal((await db.query('select count(*) n from class_attachments')).rows[0].n, 4);
    assert.equal((await db.query('select count(*) n from class_deletions')).rows[0].n, 0);
    await db.exec('drop table future_comments');
    const result = (await call()).rows[0].result;
    assert.deepEqual(
      result.paths.sort(),
      [`${id(3)}/solo.previewable.png`, `${id(3)}/solo.previewable.png.webp`].sort(),
    );
    assert.equal((await db.query('select count(*) n from classes')).rows[0].n, 1);
    assert.equal((await db.query('select count(*) n from class_members')).rows[0].n, 1);
    assert.equal((await db.query('select count(*) n from class_posts')).rows[0].n, 1);
    assert.equal((await db.query('select count(*) n from profiles')).rows[0].n, 2);
    for (const table of ['student_avatars', 'player_game_stats', 'class_attachments'])
      assert.equal((await db.query(`select count(*) n from ${table}`)).rows[0].n, 1);
    assert.deepEqual((await call()).rows[0].result, result);
    await db.query('select tipy_ack_class_files($1,$2,$3)', [id(1), id(3), result.paths]);
    assert.deepEqual((await call()).rows[0].result.paths, []);
    await db.exec('set role authenticated');
    await assert.rejects(call(), /permission denied/);
  } finally {
    await db.close();
  }
});

test('class delete backend rejects students before access and reports Storage/ack failures as retryable partial completion', async () => {
  await assert.rejects(
    createClassrooms({}).classDelete({ role: 'student' }, { classId: id(3), confirmName: 'Test' }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    createClassrooms({}).classDeletions({ role: 'student' }),
    (e) => e.status === 403,
  );
  for (const failure of ['storage', 'ack', null]) {
    const calls = [];
    const service = createClassrooms({
      rpc: async (name, args) => {
        calls.push([name, args]);
        return name === 'tipy_delete_class'
          ? { data: { paths: ['a', 'b'] } }
          : failure === 'ack'
            ? { error: Error('ack') }
            : { data: 0 };
      },
      storage: {
        from(bucket) {
          assert.equal(bucket, 'tipy-classroom');
          return {
            remove: async (paths) => {
              assert.deepEqual(paths, ['a', 'b']);
              return failure === 'storage' ? { error: Error('storage') } : { data: [] };
            },
          };
        },
      },
    });
    const result = await service.classDelete(admin, { classId: id(3), confirmName: 'Test' });
    assert.equal(result.deleted, true);
    assert.equal(result.cleanupPending, !!failure);
    assert.equal(calls.length, failure === 'storage' ? 1 : 2);
  }
});
