import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createClassrooms, safeLink, validateFile } from '../server/modules/classrooms.js';
import { ApiError } from '../server/errors.js';

test('classroom validation rejects unsafe links, executable uploads and invalid avatars', async () => {
  assert.equal(safeLink('https://example.com/lesson'), 'https://example.com/lesson');
  assert.throws(() => safeLink('javascript:alert(1)'));
  assert.throws(() => safeLink('https://a:b@example.com'));
  assert.equal(
    validateFile({ name: 'bai.pdf', mime: 'application/pdf', size: 20 }).extension,
    'pdf',
  );
  assert.throws(() => validateFile({ name: 'a.exe', mime: 'text/plain', size: 20 }));
  assert.throws(() => validateFile({ name: 'a.png', mime: 'image/png', size: 5242881 }));
  const service = createClassrooms({});
  await assert.rejects(
    service.classSave({ role: 'student' }, { name: 'Fake' }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.classArchive({ role: 'student' }, { classId: 'fake', archived: true }),
    (e) => e.status === 403,
  );
  await assert.rejects(service.avatarSave({ role: 'student' }, { animal: 'bad' }));
});
test('nonmembers cannot read a class or sign its files and students cannot publish/upload', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  let table;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    maybeSingle: async () => ({ data: table === 'classes' ? { class_id: id } : null }),
  };
  const service = createClassrooms({
    from: (name) => {
      table = name;
      return query;
    },
  });
  const student = { user_id: id, role: 'student' };
  await assert.rejects(service.classroom(student, { classId: id }), (e) => e.status === 403);
  await assert.rejects(service.classUpload(student, { classId: id }), (e) => e.status === 403);
  await assert.rejects(service.classPost(student, { classId: id }), (e) => e.status === 403);
});
test('Postgres classrooms enforce membership, preserve archived rosters and atomically attach uploaded files', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);grant usage on schema storage to service_role;grant all on storage.objects to service_role;`,
    );
    await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    const sql = readFileSync(new URL('../db/classrooms.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const teacher = '11111111-1111-4111-8111-111111111111',
      student = '22222222-2222-4222-8222-222222222222',
      outsider = '33333333-3333-4333-8333-333333333333';
    for (const [id, name] of [
      [teacher, 'admin'],
      [student, 'an'],
      [outsider, 'binh'],
    ])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id,
        { username: name, full_name: name },
        {},
      ]);
    await db.query("update profiles set role='admin' where user_id=$1", [teacher]);
    const classroom = (
      await db.query(
        "insert into classes(name,created_by) values('STEM 3A',$1) returning class_id",
        [teacher],
      )
    ).rows[0].class_id;
    await db.query('insert into class_members(class_id,user_id) values($1,$2)', [
      classroom,
      student,
    ]);
    const attachment = (
      await db.query(
        "insert into class_attachments(class_id,uploaded_by,storage_path,name,mime_type,size_bytes) values($1,$2,'test/a.pdf','a.pdf','application/pdf',20) returning attachment_id",
        [classroom, teacher],
      )
    ).rows[0].attachment_id;
    await assert.rejects(
      db.query('select tipy_publish_post($1,$2,$3,$4,$5,$6)', [
        student,
        classroom,
        'Fake',
        'text',
        null,
        [],
      ]),
    );
    await assert.rejects(
      db.query('select tipy_publish_post($1,$2,$3,$4,$5,$6)', [
        teacher,
        classroom,
        'Not ready',
        'text',
        null,
        [attachment],
      ]),
    );
    assert.equal((await db.query('select * from class_posts')).rows.length, 0);
    await db.exec("insert into storage.objects values('tipy-classroom','test/a.pdf')");
    await db.query('select tipy_publish_post($1,$2,$3,$4,$5,$6)', [
      teacher,
      classroom,
      'Bài 1',
      'Nội dung',
      'https://example.com',
      [attachment],
    ]);
    assert.ok((await db.query('select post_id from class_attachments')).rows[0].post_id);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${outsider}'`);
    assert.equal((await db.query('select * from classes')).rows.length, 0);
    assert.equal((await db.query('select * from class_posts')).rows.length, 0);
    assert.equal((await db.query('select * from class_attachments')).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub='${student}'`);
    assert.equal((await db.query('select * from class_posts')).rows.length, 1);
    assert.equal((await db.query('select * from class_members')).rows.length, 1);
    await assert.rejects(
      db.exec("insert into classes(name,created_by) values('Fake',gen_random_uuid())"),
    );
    await assert.rejects(
      db.query('select tipy_publish_post($1,$2,$3,$4,$5,$6)', [
        student,
        classroom,
        'Fake',
        '',
        null,
        [],
      ]),
    );
    await db.exec('reset role');
    await db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
      classroom,
      student,
    ]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${student}'`);
    for (const table of ['classes', 'class_members', 'class_posts', 'class_attachments'])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    await assert.rejects(db.exec('select * from storage.objects'), /permission denied/);
    await db.exec('reset role');
    await db.query('update class_members set is_active=true where class_id=$1 and user_id=$2', [
      classroom,
      student,
    ]);
    await db.query('update classes set archived_at=now() where class_id=$1', [classroom]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${student}'`);
    assert.equal((await db.query('select * from class_posts')).rows.length, 0);
    await db.exec('reset role');
    await db.query('update classes set archived_at=null where class_id=$1', [classroom]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${student}'`);
    assert.equal((await db.query('select * from class_posts')).rows.length, 1);
    await db.exec('reset role');
    await db.query('update class_members set is_active=false where class_id=$1', [classroom]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${student}'`);
    assert.equal((await db.query('select * from class_attachments')).rows.length, 0);
  } finally {
    await db.close();
  }
});
