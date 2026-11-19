import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teacherFixture, id } from './teacher-fixture.js';
import { createStars } from '../server/modules/stars.js';
import { createStudents } from '../server/modules/students.js';
import { createClassrooms } from '../server/modules/classrooms.js';

test('teacher assignments scope gifts, recipients, tests, posts, files and RLS; revocation and locking take effect', async () => {
  const f = await teacherFixture();
  try {
    const a = await f.people(30),
      b = await f.people(31),
      student = f.person(1),
      stars = createStars(f.dbClient),
      students = createStudents(f.dbClient);
    const query = async (name, args) => {
      const r = await f.rpc(name, args);
      if (r.error) throw Error(r.error.message);
      return r.data;
    };
    await assert.rejects(f.teachers.teacherCreate(a, { username: 'bad' }), (e) => e.status === 403);
    await assert.rejects(
      f.teachers.teacherSave(student, { userId: a.user_id, classIds: [] }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      f.adminRpc('save', { userId: b.user_id, classIds: [id(50)], active: true }, a.user_id),
      /Admin required/,
    );
    await assert.rejects(
      f.adminRpc('save', { userId: id(99), classIds: [], active: false }),
      /Protected account/,
    );
    assert.equal((await f.people(99)).role, 'admin');
    const roster = await students.studentsPage(a, {});
    assert.equal(roster.total, 7);
    assert.ok(
      roster.students.every((s) => s.class_members.every((m) => m.classes.class_id === id(50))),
    );
    await assert.rejects(
      students.studentsPage(a, { classFilter: id(51) }),
      (e) => e.status === 403,
    );
    const gift = {
      userId: id(1),
      classId: id(50),
      requestId: id(300),
      amount: 5,
      message: 'Giỏi lắm',
    };
    const before = (await f.total()).stars;
    await stars.starGift(a, gift);
    await stars.starGift(a, gift);
    assert.equal((await f.total()).stars, before + 5);
    const log = await f.q(
      'select granted_by,class_id,amount from star_rewards where source_key=$1',
      [id(300)],
    );
    assert.deepEqual(log, { granted_by: a.user_id, class_id: id(50), amount: 5 });
    const notice = await f.q('select payload from student_notifications where source_key=$1', [
      id(300),
    ]);
    assert.equal(notice.payload.teacher, a.full_name);
    await stars.starGift(b, { userId: id(8), classId: id(51), requestId: id(303), amount: 2 });
    assert.equal(
      (await stars.classStars(b, { classId: id(51) })).lessons.find((r) => r.user_id === id(8))
        .stars,
      2,
    );
    await assert.rejects(
      stars.starGift(a, { ...gift, amount: 0, requestId: id(304) }),
      (e) => e.status === 400,
    );
    assert.equal(
      (await stars.classStars(a, { classId: id(50) })).lessons.find((r) => r.user_id === id(1))
        .stars,
      5,
    );
    await assert.rejects(
      stars.starGift(a, { ...gift, userId: id(8), classId: id(51), requestId: id(301) }),
      (e) => e.status === 403,
    );
    await assert.rejects(stars.starGift(student, gift), (e) => e.status === 403);
    await assert.rejects(stars.starDeduct(a, gift), (e) => e.status === 403);
    await assert.rejects(
      stars.starReset(a, { userId: id(1), requestId: id(302), confirm: 'accept' }),
      (e) => e.status === 403,
    );
    const save = {
      assessmentId: id(350),
      requestId: id(351),
      version: 0,
      title: 'Bài của cô A',
      targets: { classIds: [id(50)], userIds: [] },
      selection: { questIds: ['keys-as-1'], falling: null },
    };
    const draft = await f.assessments.assessmentSave(a, save);
    await assert.rejects(
      f.assessments.assessmentSave(a, {
        ...save,
        assessmentId: id(352),
        targets: { classIds: [id(51)], userIds: [] },
      }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      f.assessments.assessmentSave(a, {
        ...save,
        assessmentId: id(352),
        targets: { classIds: [], userIds: [id(8)] },
      }),
      (e) => e.status === 403,
    );
    await f.assessments.assessmentPublish(a, {
      assessmentId: save.assessmentId,
      version: draft.version,
    });
    assert.equal((await f.assessments.assessments(a, { page: 1 })).items.length, 1);
    assert.equal((await f.assessments.assessments(b, { page: 1 })).items.length, 0);
    await assert.rejects(
      f.assessments.assessment(b, { assessmentId: save.assessmentId }),
      (e) => e.status === 403,
    );
    await f.assessments.assessment(student, { assessmentId: save.assessmentId });
    await assert.rejects(
      f.assessments.assessmentResults(a, {
        assessmentId: save.assessmentId,
        classId: id(51),
        page: 1,
      }),
      (e) => e.status === 403,
    );
    const shared = await f.draft(349, { classIds: [id(50), id(51)], userIds: [] });
    await f.assessments.assessmentPublish(f.admin, shared);
    const sharedView = (await f.assessments.assessment(a, { assessmentId: id(349) })).assessment;
    assert.equal(sharedView.can_manage, false);
    assert.deepEqual(sharedView.definition.targets.classIds, [id(50)]);
    await assert.rejects(
      f.assessments.assessmentDelete(a, {
        assessmentId: id(349),
        title: sharedView.definition.title,
        confirm: 'accept',
      }),
      (e) => e.status === 403,
    );
    const deletable = await f.assessments.assessmentSave(a, {
      ...save,
      assessmentId: id(348),
      requestId: id(347),
    });
    const deleteInput = {
      assessmentId: id(348),
      title: deletable.definition.title,
      confirm: 'accept',
    };
    await f.assessments.assessmentDelete(a, deleteInput);
    assert.equal((await f.assessments.assessmentDelete(a, deleteInput)).deleted, true);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(8)]);
    assert.equal(
      (await stars.classStars(a, { classId: id(50) })).lessons.find((r) => r.user_id === id(8))
        .stars,
      0,
      'class B gift stays in B',
    );
    assert.equal(
      (await f.assessments.assessmentResults(a, { assessmentId: save.assessmentId, page: 1 }))
        .total,
      8,
    );
    const publishedNotice = await f.q(
      'select payload from student_notifications where user_id=$1 and assessment_id=$2',
      [id(1), save.assessmentId],
    );
    assert.equal(publishedNotice.payload.teacher, a.full_name);
    const postArgs = {
      p_admin: a.user_id,
      p_class: id(50),
      p_title: 'Bài cô A',
      p_body: 'Nội dung',
      p_link: null,
      p_files: [],
      p_request: id(360),
    };
    await query('tipy_publish_post', postArgs);
    await query('tipy_publish_post', postArgs);
    await f.adminRpc('save', { userId: b.user_id, classIds: [id(50), id(51)], active: true });
    await assert.rejects(
      query('tipy_archive_post', { p_actor: b.user_id, p_post: id(360) }),
      /Class access denied/,
    );
    await f.adminRpc('save', { userId: b.user_id, classIds: [id(51)], active: true });
    await assert.rejects(
      query('tipy_publish_post', { ...postArgs, p_class: id(51), p_request: id(361) }),
      /Admin required/,
    );
    await assert.rejects(
      query('tipy_archive_post', { p_actor: b.user_id, p_post: id(360) }),
      /Class access denied/,
    );
    await query('tipy_publish_post', {
      ...postArgs,
      p_admin: b.user_id,
      p_class: id(51),
      p_request: id(365),
    });
    const attachment = {
      attachment_id: id(370),
      class_id: id(51),
      post_id: id(365),
      mime_type: 'application/pdf',
      storage_path: 'private',
      name: 'file.pdf',
      class_posts: { archived_at: null },
    };
    let downloaded = 0;
    const files = createClassrooms({
      rpc: f.rpc,
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        not() {
          return this;
        },
        single: async () => ({ data: attachment }),
      }),
      storage: {
        from: () => ({
          download: async () => {
            downloaded++;
            return { data: new Blob(['x']) };
          },
        }),
      },
    });
    await assert.rejects(
      files.classDownload(a, { attachmentId: id(370) }),
      (e) => e.status === 403,
    );
    assert.equal(downloaded, 0);
    await files.classDownload(b, { attachmentId: id(370) });
    assert.equal(downloaded, 1);
    assert.equal(
      (
        await f.q(
          "select has_function_privilege('authenticated','public.tipy_teacher_admin(uuid,text,jsonb)','EXECUTE') allowed",
        )
      ).allowed,
      false,
    );
    await f.db.query('set role authenticated');
    await f.db.query("select set_config('request.jwt.claim.sub',$1,false)", [a.user_id]);
    assert.equal((await f.db.query('select class_id from classes')).rows.length, 1);
    assert.equal(
      (await f.db.query('select user_id from profiles where user_id=$1', [id(8)])).rows.length,
      1,
    );
    await f.db.query('reset role');
    await f.adminRpc('save', { userId: a.user_id, classIds: [], active: true });
    await assert.rejects(
      stars.starGift(a, { ...gift, requestId: id(380) }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      f.assessments.assessment(a, { assessmentId: save.assessmentId }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      query('tipy_publish_post', { ...postArgs, p_request: id(381) }),
      /Admin required/,
    );
    await f.adminRpc('save', { userId: a.user_id, classIds: [id(50)], active: false });
    assert.equal(await query('tipy_manages_class', { p_actor: a.user_id, p_class: id(50) }), false);
    await f.db.query('set role authenticated');
    await f.db.query("select set_config('request.jwt.claim.sub',$1,false)", [a.user_id]);
    assert.equal((await f.db.query('select * from classes')).rows.length, 0);
    await f.db.query('reset role');
  } finally {
    await f.db.query('reset role');
    await f.db.close();
  }
});

test('administrator creates teachers through existing PIN/Auth scheme; retry recovers same account without changing later assignments', async () => {
  const f = await teacherFixture();
  try {
    const input = {
      username: 'co.lan',
      fullName: 'Cô Lan',
      password: '1',
      classIds: [id(50)],
      requestId: id(400),
    };
    await f.teachers.teacherCreate(f.admin, input);
    await f.teachers.teacherCreate(f.admin, input);
    let list = await f.teachers.teachers(f.admin, { search: 'co.lan' });
    assert.equal(list.total, 1);
    const teacher = list.items[0];
    assert.equal(teacher.full_name, 'Cô Lan');
    assert.deepEqual(teacher.classIds, [id(50)]);
    await f.teachers.teacherSave(f.admin, {
      userId: teacher.user_id,
      classIds: [id(51)],
      active: true,
    });
    await f.teachers.teacherCreate(f.admin, input);
    list = await f.teachers.teachers(f.admin, { search: 'co.lan' });
    assert.deepEqual(list.items[0].classIds, [id(51)]);
    await f.db.query('update classes set archived_at=now() where class_id=$1', [id(51)]);
    await f.teachers.teacherSave(f.admin, {
      userId: teacher.user_id,
      classIds: [id(51)],
      active: false,
    });
    assert.equal(
      (await f.teachers.teachers(f.admin, { search: 'co.lan' })).items[0].is_active,
      false,
    );
    await assert.rejects(
      f.teachers.teacherCreate(f.admin, { ...input, requestId: id(401) }),
      (e) => e.status === 409,
    );
    const publicProfile = await f.q('select role from profiles where user_id=$1', [
      teacher.user_id,
    ]);
    assert.equal(publicProfile.role, 'teacher');
    for (let n = 210; n < 220; n++) {
      await f.db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: `extra${n}`, full_name: `Giáo viên ${n}` },
        {},
      ]);
      await f.adminRpc('provision', { userId: id(n), classIds: [] });
    }
    const secondPage = await f.teachers.teachers(f.admin, { page: 2 });
    assert.equal(secondPage.total, 14);
    assert.equal(secondPage.items.length, 7);
  } finally {
    await f.db.close();
  }
});
