import { test } from 'node:test';
import assert from 'node:assert/strict';
import { id } from './teacher-fixture.js';
import { createClassrooms } from '../server/modules/classrooms.js';
import { createStars } from '../server/modules/stars.js';
import { shortName, readHub, invalidateHub } from '../src/features/classroom/hub-cache.js';
import { hubFixture } from './hub-fixture.js';
test('classroom hub scopes roster, weekly top 3 and paginates before returning data', async () => {
  const f = await hubFixture();
  try {
    const rooms = createClassrooms(f.dbClient),
      stars = createStars(f.dbClient),
      a = await f.people(30),
      student = await f.people(1);
    await stars.starGift(a, { userId: id(1), requestId: id(600), classId: id(50), amount: 9 });
    const own = await rooms.classroomHub(a, { classId: id(50) });
    assert.equal(own.members.length, 7);
    assert.equal(own.top.length, 3);
    assert.equal(own.top[0].user_id, id(1));
    assert.equal(own.top[0].stars, 9);
    const child = await rooms.classroomHub(student, { classId: id(50) });
    assert.equal(child.members[0].username, null);
    assert.equal(child.members[0].stars, null);
    await assert.rejects(rooms.classroomHub(a, { classId: id(51) }), (e) => e.status === 403);
    await assert.rejects(rooms.classroomHub(student, { classId: id(51) }), (e) => e.status === 403);
    for (let n = 610; n < 640; n++) {
      await f.db.query('insert into auth.users values($1,$2,$3)', [
        id(n),
        { username: `new${n}`, full_name: `Học sinh ${n}` },
        {},
      ]);
      await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [
        id(50),
        id(n),
      ]);
    }
    const first = await rooms.classroomHub(a, { classId: id(50), page: 1 }),
      next = await rooms.classroomHub(a, { classId: id(50), page: 2 });
    assert.equal(first.total, 37);
    assert.equal(first.members.length, 24);
    assert.equal(next.members.length, 13);
    assert.ok(!next.members.some((m) => first.members.some((x) => x.user_id === m.user_id)));
  } finally {
    await f.db.close();
  }
});
test('assigned teachers deduct with receipts, remove only one membership and revoke reads', async () => {
  const f = await hubFixture();
  try {
    const rooms = createClassrooms(f.dbClient),
      stars = createStars(f.dbClient),
      a = await f.people(30),
      b = await f.people(31),
      s = await f.people(1);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(51), id(1)]);
    await stars.starGift(a, { userId: s.user_id, requestId: id(650), classId: id(50), amount: 9 });
    const input = {
      userId: s.user_id,
      requestId: id(651),
      classId: id(50),
      amount: 4,
      message: 'Lý do thử',
    };
    assert.equal((await stars.starDeduct(a, input)).stars, 12);
    assert.equal((await stars.starDeduct(a, input)).stars, 12);
    await assert.rejects(
      stars.starDeduct(b, { ...input, requestId: id(652) }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      stars.starDeduct(s, { ...input, requestId: id(653) }),
      (e) => e.status === 403,
    );
    await assert.rejects(stars.starDeduct(a, { ...input, requestId: id(654), amount: 13 }));
    assert.equal((await rooms.classroomHub(a, { classId: id(50) })).top[0].stars, 5);
    const remove = { userId: s.user_id, classId: id(50), requestId: id(655), confirm: 'accept' };
    await assert.rejects(
      rooms.classRemoveMember(a, { ...remove, confirm: 'Accept' }),
      (e) => e.status === 400,
    );
    await assert.rejects(rooms.classRemoveMember(b, remove), (e) => e.status === 403);
    const answer = await rooms.classRemoveMember(a, remove);
    assert.equal(answer.overview.total, 6);
    assert.deepEqual(await rooms.classRemoveMember(a, remove), answer);
    assert.equal(
      (
        await f.q('select count(*)::int n from class_members where user_id=$1 and is_active', [
          s.user_id,
        ])
      ).n,
      1,
    );
    assert.equal((await f.people(1)).is_active, true);
    assert.equal((await stars.stars(s)).stars, 12);
    await assert.rejects(rooms.classroomHub(s, { classId: id(50) }), (e) => e.status === 403);
    assert.equal((await rooms.classroomHub(s, { classId: id(51) })).classroom.class_id, id(51));
    await f.db.query('set role authenticated');
    await assert.rejects(
      f.db.query('select tipy_remove_class_member($1,$2,$3,$4,$5)', [
        a.user_id,
        id(50),
        id(2),
        id(656),
        'accept',
      ]),
      /permission denied/,
    );
    await f.db.query('reset role');
  } finally {
    await f.db.close();
  }
});
test('class assessment filter, hidden starts, active attempts, ownership and post notifications', async () => {
  const f = await hubFixture();
  try {
    const rooms = createClassrooms(f.dbClient),
      a = await f.people(30),
      b = await f.people(31),
      s = await f.people(1);
    await f.publish(700);
    await f.publish(701, { classIds: [id(51)], userIds: [] });
    assert.deepEqual(
      (await f.assessments.assessments(f.admin, { classId: id(50) })).items.map(
        (e) => e.assessment_id,
      ),
      [id(700)],
    );
    await f.assessments.assessmentVisibility(f.admin, { assessmentId: id(700), hidden: true });
    await assert.rejects(
      f.assessments.assessmentStart(s, { assessmentId: id(700) }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      f.assessments.assessmentVisibility(a, { assessmentId: id(700), hidden: false }),
      (e) => e.status === 403,
    );
    await f.assessments.assessmentVisibility(f.admin, { assessmentId: id(700), hidden: false });
    const attempt = await f.assessments.assessmentStart(s, { assessmentId: id(700) });
    await f.assessments.assessmentVisibility(f.admin, { assessmentId: id(700), hidden: true });
    assert.equal(
      (await f.assessments.assessmentStart(s, { assessmentId: id(700) })).attempt_id,
      attempt.attempt_id,
    );
    const postArgs = {
      p_admin: a.user_id,
      p_class: id(50),
      p_title: 'Tin nhắn thử',
      p_body: 'Nội dung',
      p_link: null,
      p_files: [],
      p_request: id(702),
    };
    const post = (await f.rpc('tipy_publish_post', postArgs)).data;
    assert.ok(post);
    await f.rpc('tipy_publish_post', postArgs);
    let feed = await rooms.classNotifications(s, { classId: id(50) });
    assert.equal(feed.items.filter((n) => n.kind === 'post').length, 1);
    await f.db.query('insert into auth.users values($1,$2,$3)', [
      id(703),
      { username: 'late703', full_name: 'Bạn vào sau' },
      {},
    ]);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [
      id(50),
      id(703),
    ]);
    assert.equal(
      (await rooms.classNotifications(await f.people(703), { classId: id(50) })).items.filter(
        (n) => n.kind === 'post',
      ).length,
      1,
    );
    await rooms.classRemoveMember(a, {
      classId: id(50),
      userId: s.user_id,
      requestId: id(704),
      confirm: 'accept',
    });
    assert.equal(
      (await f.notifications.notifications(s)).items.filter((n) => n.kind === 'post').length,
      0,
    );
    await assert.rejects(rooms.classNotifications(b, { classId: id(50) }), (e) => e.status === 403);
  } finally {
    await f.db.close();
  }
});
test('short names preserve Vietnamese and workspace cache shares pending reads and invalidates narrowly', async () => {
  assert.equal(shortName('  Nguyễn   Đình  Dương  '), 'Dương');
  assert.equal(shortName('Ha\u0300'), 'Hà');
  assert.equal(shortName('  '), 'Bạn');
  const cache = new Map();
  let reads = 0;
  const load = async () => {
    reads++;
    return { value: 1 };
  };
  const [a, b] = await Promise.all([
    readHub(cache, 'u:c:posts:1', load),
    readHub(cache, 'u:c:posts:1', load),
  ]);
  assert.equal(reads, 1);
  assert.equal(a, b);
  await readHub(cache, 'u:c:posts:1', load);
  assert.equal(reads, 1);
  cache.set('u:d:posts:1', { data: 2, time: Date.now() });
  invalidateHub(cache, 'u:c:');
  assert.equal(cache.has('u:d:posts:1'), true);
});
