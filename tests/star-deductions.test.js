import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starFixture, id } from './star-balance-fixture.js';
import { createStars } from '../server/modules/stars.js';

test('deductions atomically consume current balance, preserve award ceilings and audit/retry/scope', async () => {
  const f = await starFixture();
  try {
    const sql = readFileSync('db/star_deductions.sql', 'utf8');
    assert.equal(
      sql,
      readFileSync('supabase/migrations/20261113170953_star_deductions.sql', 'utf8'),
    );
    await f.db.exec(sql);
    const deduct = async (request, amount, student = id(1), actor = id(99), group = id(50)) =>
      (
        await f.q('select tipy_deduct_stars($1,$2,$3,$4,$5,$6) r', [
          actor,
          student,
          request,
          amount,
          'Lý do thử',
          group,
        ])
      ).r;
    await f.finish('keys-as', 3);
    await f.finish('keys-df', 2);
    assert.equal((await f.total()).stars, 12);
    const [a, b] = await Promise.all([deduct(id(700), 9), deduct(id(700), 9)]);
    assert.equal(a.stars, 3);
    assert.equal(b.stars, 3);
    assert.equal((await f.total()).stars, 3);
    await assert.rejects(deduct(id(701), 4), /vượt/);
    await assert.rejects(deduct(id(700), 1), /Mã yêu cầu/);
    await assert.rejects(deduct(id(702), 1, id(1), id(2)), /Admin/);
    await f.db.query('update class_members set is_active=false where user_id=$1', [id(2)]);
    await assert.rejects(deduct(id(703), 1, id(2)), /Class access denied/);
    await assert.rejects(
      f.db.query("select tipy_class_star_gift($1,$2,$3,1,'',$4)", [id(99), id(2), id(704), id(50)]),
      /Class access denied/,
    );
    const audit = await f.q('select * from student_admin_actions where request_id=$1', [id(700)]);
    assert.equal(audit.action, 'deduct');
    assert.equal(audit.actor_id, id(99));
    assert.equal(audit.payload.message, 'Lý do thử');
    assert.equal(audit.response.beforeStars, 12);
    assert.equal(audit.response.afterStars, 3);
    assert.ok(audit.created_at);
    const before = await f.total();
    await f.finish('keys-as', 3);
    assert.deepEqual(await f.total(), before);
    await f.finish('keys-df', 3);
    assert.equal((await f.total()).stars, 4);
    await Promise.all([deduct(id(705), 3), f.gift(id(706), 5)]);
    assert.equal((await f.total()).stars, 6);
    const both = await Promise.allSettled([deduct(id(707), 4), deduct(id(708), 4)]);
    assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await f.total()).stars, 2);
    assert.equal((await f.board()).lessons.find((r) => r.user_id === id(1)).stars, 2);
    const members = (await f.q('select tipy_class_member_balances($1,$2) r', [id(99), id(50)])).r;
    assert.equal(members.find((r) => r.user_id === id(1)).stars, 2);
    await f.db.exec('set role authenticated');
    await assert.rejects(deduct(id(709), 1), /permission denied/);
    await f.db.exec('reset role');
  } finally {
    await f.db.close();
  }
});

test('gift/deduct validate session role and payload before RPC; scoped writes use one RPC', async () => {
  const calls = [];
  const api = createStars({
    rpc: async (...args) => {
      calls.push(args);
      return { data: { completed: true, stars: 4 } };
    },
  });
  const input = { userId: id(1), requestId: id(710), classId: id(50), amount: 2, message: 'Lý do' };
  for (const amount of [-1, 0, 1.5, Infinity, '2'])
    await assert.rejects(api.starDeduct({ role: 'admin' }, { ...input, amount }));
  await assert.rejects(api.starDeduct({ role: 'student' }, input), (e) => e.status === 403);
  assert.equal(calls.length, 0);
  await api.starDeduct({ user_id: id(99), role: 'admin' }, input);
  await api.starGift({ user_id: id(99), role: 'admin' }, input);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'tipy_deduct_stars');
  assert.equal(calls[1][0], 'tipy_class_star_gift');
  assert.equal(calls[0][1].p_class, id(50));
});
