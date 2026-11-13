import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notificationsFixture, id } from './notifications-fixture.js';
import { createNotifications } from '../server/modules/notifications.js';
import { createHandler } from '../api/tipy.js';

test('notification transactions: publish, late class members, gifts, resets, exact-once state and scoped paged history', async () => {
  const f = await notificationsFixture();
  try {
    await f.db.exec(readFileSync('db/star_deductions.sql', 'utf8'));
    const list = (n = 1, page = 1) => f.notifications.notifications(f.person(n), { page });
    assert.equal((await list()).total, 0, 'old gifts are not backfilled');
    const input = await f.draft(80);
    assert.equal((await list()).total, 0, 'drafts never notify');
    await f.assessments.assessmentPublish(f.admin, input);
    await f.assessments.assessmentPublish(f.admin, input);
    assert.equal((await list()).total, 1);
    const schedule = {
      mode: 'scheduled',
      opensAt: new Date(Date.now() + 86400000).toISOString(),
      closesAt: new Date(Date.now() + 172800000).toISOString(),
    };
    await f.publish(81, { classIds: [], userIds: [id(1)] }, schedule);
    const exam = (await list()).items.find((n) => n.assessment_id === id(81));
    assert.deepEqual(exam.payload.schedule, schedule);
    assert.equal(
      (await f.assessments.assessment(f.person(1), { assessmentId: id(81) })).assessment.teacher,
      'Thầy Hùng',
    );
    await assert.rejects(
      f.assessments.assessmentStart(f.person(1), { assessmentId: id(81) }),
      /chưa đến giờ/,
    );
    await f.db.query('insert into auth.users values($1,$2,$3)', [
      id(8),
      { username: 'late8', full_name: 'Học sinh vào sau' },
      {},
    ]);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(8)]);
    assert.equal((await list(8)).total, 1, 'late member receives published class test');
    await f.db.query('update class_members set is_active=false where user_id=$1', [id(8)]);
    assert.equal((await list(8)).total, 0, 'lost class permission hides the private notification');
    await f.db.query('update class_members set is_active=true where user_id=$1', [id(8)]);
    assert.equal((await list(8)).total, 1, 'rejoin does not duplicate notification');
    const gift = await f.gift(id(100), 5);
    await f.gift(id(100), 5);
    let data = await list();
    assert.equal(data.total, 3);
    assert.equal(data.items.find((n) => n.kind === 'star_gift').payload.amount, 5);
    assert.equal(data.items.find((n) => n.kind === 'star_gift').payload.message, 'Quà thử');
    await f.rpc('tipy_deduct_stars', {
      p_actor: id(99),
      p_user: id(1),
      p_request: id(909),
      p_amount: 3,
      p_message: 'Lý do thử',
      p_class: id(50),
    });
    assert.equal((await list()).total, 3, 'deduction creates no gift notification');
    await f.reset(id(101));
    assert.equal((await list()).total, 3, 'balance reset creates no notification');
    const ids = data.items.map((n) => n.notification_id);
    const claims = await Promise.all([
      f.notifications.notificationsPresent(f.person(1), { ids, speak: true }),
      f.notifications.notificationsPresent(f.person(1), { ids, speak: true }),
    ]);
    assert.equal(claims.flatMap((r) => r.spoken).length, 3);
    assert.equal((await list()).unread, 0);
    assert.equal(
      (await f.notifications.notificationsPresent(f.person(2), { ids, speak: true })).spoken.length,
      0,
    );
    assert.equal(
      (await f.notifications.notificationsPresent(f.person(1), { ids, speak: true })).spoken.length,
      0,
      'history never speaks again',
    );
    await f.gift(id(102), 3);
    const silent = await list();
    const silentResult = await f.notifications.notificationsPresent(f.person(1), {
      ids: silent.items.filter((n) => !n.presented_at).map((n) => n.notification_id),
      speak: false,
    });
    assert.equal(silentResult.spoken.length, 0);
    assert.equal(
      (await list()).unread,
      0,
      'closing with companion hidden still persists presentation',
    );
    for (let i = 0; i < 22; i++) await f.gift(id(200 + i), 1);
    data = await list();
    assert.equal(data.items.length, 20);
    assert.equal(data.total, 26);
    assert.equal(data.pages, 2);
    assert.ok(
      data.items.every((n) => !n.presented_at),
      'unpresented notifications precede old history',
    );
    assert.equal((await list(1, 2)).items.length, 6);
    const detail = await f.assessments.assessment(f.person(8), { assessmentId: id(80) });
    await f.db.query('update class_members set is_active=false where user_id=$1', [id(8)]);
    await assert.rejects(f.assessments.assessment(f.person(8), { assessmentId: id(80) }), /quyền/);
    await f.db.exec('set role authenticated');
    await assert.rejects(f.db.query('select * from student_notifications'), /permission denied/);
    await assert.rejects(
      f.db.query('select tipy_notifications_list($1,1)', [id(2)]),
      /permission denied/,
    );
    await assert.rejects(
      f.db.query('select tipy_notifications_present($1,$2,true)', [id(2), ids]),
      /permission denied/,
    );
    await f.db.exec('reset role');
  } finally {
    await f.db.close();
  }
});

test('notification API uses session identity, validates batches and does not accept forged user IDs', async () => {
  const calls = [];
  const service = createNotifications({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { items: [], unread: 0, page: 1, pages: 1, total: 0 } };
    },
  });
  const profile = { user_id: id(1), role: 'student' };
  for (const input of [
    { ids: [], speak: true },
    { ids: [id(2)], speak: 'yes' },
    { ids: ['bad'], speak: true },
    { ids: Array(51).fill(id(2)), speak: true },
  ])
    await assert.rejects(service.notificationsPresent(profile, input));
  await assert.rejects(service.notifications({ user_id: id(99), role: 'admin' }));
  assert.equal(calls.length, 0);
  const handler = createHandler({
    makeBackend: () => ({ ...service, session: async () => ({ profile }) }),
  });
  const response = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handler(
    {
      method: 'POST',
      headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
      body: {
        action: 'notifications_present',
        ids: [id(3)],
        speak: true,
        userId: id(2),
        role: 'admin',
      },
    },
    response,
  );
  assert.equal(response.code, 200);
  assert.equal(calls[0].args.p_user, id(1));
});
