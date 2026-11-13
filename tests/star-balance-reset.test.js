import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starFixture, id } from './star-balance-fixture.js';
import { createStars } from '../server/modules/stars.js';
import { createHandler } from '../api/tipy.js';

test('reset balance preserves earned ceilings, historical gifts, progress, receipts and class ranking', async () => {
  const f = await starFixture();
  try {
    assert.equal((await f.board()).lessons[0].stars, 7);
    assert.equal((await f.total()).stars, 7);
    await f.db.query(
      `insert into class_week_scores(class_id,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence)
      select m.class_id,tipy_week_start(now()),m.user_id,'hard-v1',10,1,1,0,2,$2,now(),m.joined_at,'{}' from class_members m where m.user_id=$1`,
      [id(1), id(300)],
    );
    const weekly = (await f.board()).weekly;
    await f.finish('keys-as', 3);
    await f.finish('keys-df', 2);
    await f.db.query(
      "insert into star_rewards(user_id,source,source_key,amount) values($1,'weekly','old-week',5)",
      [id(1)],
    );
    const given = await f.gift(id(100), 5);
    assert.equal(given.stars, 22);
    const before = (await f.db.query('select * from player_lesson_progress order by lesson_id'))
      .rows;
    for (const bad of ['Accept', 'accept ', ''])
      await assert.rejects(f.reset(id(101), id(1), bad), /accept/);
    await assert.rejects(f.reset(id(101), id(1), 'accept', id(2)), /Admin required/);
    assert.equal((await f.total()).stars, 22);
    const reset = await f.reset(id(101));
    assert.equal(reset.before.stars, 22);
    assert.equal(reset.stars, 0);
    assert.equal((await f.board()).lessons.find((r) => r.user_id === id(1)).stars, 0);
    assert.deepEqual(
      (await f.board()).weekly,
      weekly,
      'balance reset does not change ranked game results',
    );
    assert.deepEqual(
      (await f.db.query('select * from player_lesson_progress order by lesson_id')).rows,
      before,
    );
    const list = (await f.q('select tipy_students_page() r')).r;
    assert.equal(list.students.find((s) => s.user_id === id(1)).stars, 0);
    assert.equal(list.students.length, 7);
    assert.equal((await f.gift(id(102), 3)).stars, 3);
    assert.equal((await f.finish('keys-as', 3)).award_this_play, 0);
    assert.equal((await f.finish('keys-df', 3)).award_this_play, 1);
    assert.equal((await f.total()).stars, 4);
    assert.equal((await f.reset(id(101))).stars, 4, 'receipt retry does not clear newer gifts');
    assert.equal((await f.gift(id(102), 3)).stars, 4, 'gift retry does not reaward');
    await assert.rejects(f.gift(id(102), 4), /thao tác khác/);
    await Promise.all([f.gift(id(103), 5), f.gift(id(103), 5)]);
    assert.equal((await f.total()).stars, 9);
    await Promise.all([f.reset(id(104)), f.gift(id(105), 3)]);
    assert.equal((await f.total()).stars, 3);
    await Promise.all([f.gift(id(106), 5), f.reset(id(107))]);
    assert.equal((await f.total()).stars, 0);
    assert.equal(
      (
        await f.q(
          "select count(*)::int n from star_rewards where source='teacher' and source_key=$1",
          [id(90)],
        )
      ).n,
      1,
    );
    const audit = await f.q(
      'select actor_id,user_id,response,created_at from student_admin_actions where request_id=$1',
      [id(101)],
    );
    assert.equal(audit.actor_id, id(99));
    assert.equal(audit.user_id, id(1));
    assert.equal(audit.response.afterStars, 0);
    assert.ok(audit.created_at);
    assert.equal(
      (await f.q("select count(*)::int n from student_admin_actions where action='stars_reset'")).n,
      3,
    );
    await f.db.exec('set role authenticated');
    for (const sql of [
      "select tipy_reset_stars($1,$2,$3,'accept')",
      "select tipy_teacher_gift($1,$2,$3,5,'')",
    ])
      await assert.rejects(f.db.query(sql, [id(99), id(1), id(108)]), /permission denied/);
    await assert.rejects(f.db.query('select * from star_rewards'), /permission denied/);
    await f.db.exec('reset role');
    const legacyReset = (
      await f.q("select tipy_student_reset($1,$2,$3,$4,'accept') r", [
        id(99),
        id(1),
        f.game,
        id(109),
      ])
    ).r;
    assert.equal(legacyReset.revokedStars, 0);
    assert.equal((await f.total()).stars, 0);
    await f.db.query(
      `insert into class_week_scores(class_id,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence)
       select m.class_id,tipy_week_start(now())-7,m.user_id,'hard-v1',10,1,1,0,2,$2,now(),m.joined_at,'{}' from class_members m where m.user_id=$1`,
      [id(1), id(301)],
    );
    assert.equal((await f.q('select tipy_close_star_weeks() n')).n, 1);
    assert.equal((await f.q('select tipy_close_star_weeks() n')).n, 0);
    assert.equal((await f.total()).stars, 5, 'new weekly award after reset still counts');
    const falling = (await f.q("select game_id from games where game_code='falling_letters'"))
      .game_id;
    await f.q("select tipy_student_reset($1,$2,$3,$4,'accept')", [id(99), id(1), falling, id(110)]);
    assert.equal((await f.total()).stars, 5, 'legacy game reset preserves settled weekly awards');
    await f.db.query('update class_members set is_active=false where user_id=$1', [id(2)]);
    await assert.rejects(f.board(id(2)), /Class access denied/);
  } finally {
    await f.db.close();
  }
});

test('reset API validates confirmation and admin identity before RPC; valid reset uses one RPC', async () => {
  const calls = [];
  const service = createStars({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { completed: true, stars: 0 } };
    },
  });
  const input = { userId: id(1), requestId: id(20), confirm: 'accept' };
  await assert.rejects(
    service.starReset({ role: 'admin', user_id: id(99) }, { ...input, confirm: 'Accept' }),
  );
  assert.equal(calls.length, 0);
  const handler = createHandler({
    makeBackend: () => ({
      ...service,
      session: async () => ({ profile: { user_id: id(1), role: 'student' } }),
    }),
  });
  for (const action of ['star_gift', 'star_reset']) {
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json() {},
    };
    await handler(
      {
        method: 'POST',
        headers: { origin: 'https://tipys.vercel.app', 'content-type': 'application/json' },
        body: { ...input, action, amount: 5, role: 'admin', actorId: id(99) },
      },
      res,
    );
    assert.equal(res.code, 403);
  }
  assert.equal(calls.length, 0);
  await service.starReset({ role: 'admin', user_id: id(99) }, input);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_actor, id(99));
});
