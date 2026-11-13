import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starFixture, id } from './star-balance-fixture.js';

test('class/week stars isolate sources, clamp deductions in order, reset safely, keep history and Vietnam boundaries', async () => {
  const f = await starFixture();
  try {
    await f.db.exec(readFileSync('db/star_deductions.sql', 'utf8'));
    await f.gift(id(690), 6, id(5));
    await f.db.query(
      "update student_admin_actions set payload=payload||jsonb_build_object('classId',$2::text) where request_id=$1",
      [id(690), id(50)],
    );
    await f.gift(id(691), 3, id(6));
    await f.db.query(
      'update student_admin_actions set payload=payload||\'{"classId":"not-a-uuid"}\'::jsonb where request_id=$1',
      [id(691)],
    );
    const sql = readFileSync('db/class_week_stars.sql', 'utf8');
    assert.equal(
      sql,
      readFileSync('supabase/migrations/20261113174557_class_week_stars.sql', 'utf8'),
    );
    await f.db.exec(sql);
    await f.db.query("insert into classes(class_id,name,created_by) values($1,'Lớp B',$2)", [
      id(51),
      id(99),
    ]);
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(51), id(1)]);
    const gift = async (request, amount, group = id(50), student = id(1)) =>
      (
        await f.q("select tipy_class_star_gift($1,$2,$3,$4,'Quà thử',$5) r", [
          id(99),
          student,
          request,
          amount,
          group,
        ])
      ).r;
    const deduct = async (request, amount, group = id(50)) =>
      (
        await f.q("select tipy_deduct_stars($1,$2,$3,$4,'Lý do',$5) r", [
          id(99),
          id(1),
          request,
          amount,
          group,
        ])
      ).r;
    const current = (await f.q('select tipy_week_start(now()) w')).w.toISOString().slice(0, 10);
    const next = (await f.q('select (tipy_week_start(now())+7) w')).w.toISOString().slice(0, 10);
    const board = async (group = id(50), week = current) =>
      (await f.q('select tipy_class_week_stars($1,$2) r', [group, week])).r;
    const score = async (group = id(50), week = current) =>
      (await board(group, week)).find((r) => r.user_id === id(1)).stars;
    assert.equal(await score(), 0, 'legacy unscoped gift is excluded');
    assert.equal(
      (await board()).find((r) => r.user_id === id(5)).stars,
      6,
      'explicit historical class evidence is preserved',
    );
    assert.equal(
      (await board()).find((r) => r.user_id === id(6)).stars,
      0,
      'malformed legacy class IDs are never guessed',
    );
    await f.finish('keys-as', 3);
    await f.db.query(
      "insert into star_rewards(user_id,source,source_key,amount) values($1,'weekly','old-week',5)",
      [id(1)],
    );
    assert.equal(
      await score(),
      0,
      'earned lessons and weekly competition awards only affect account',
    );
    await assert.rejects(gift(id(700), 5, null), /Chọn lớp/);
    assert.equal((await gift(id(700), 5)).classId, id(50));
    await gift(id(700), 5);
    await gift(id(701), 8, id(51));
    assert.equal(await score(), 5);
    assert.equal(await score(id(51)), 8);
    assert.equal((await f.total()).stars, 28);
    await assert.rejects(gift(id(700), 5, id(51)), /lớp khác/);
    await deduct(id(702), 9);
    assert.equal(await score(), 0);
    assert.equal(await score(id(51)), 8);
    await gift(id(703), 3);
    assert.equal(await score(), 3, 'deduction at zero carries no debt into a later gift');
    await deduct(id(704), 2);
    await deduct(id(704), 2);
    assert.equal(await score(), 1);
    await f.reset(id(705));
    assert.equal(await score(), 0);
    assert.equal(await score(id(51)), 0);
    await gift(id(706), 4);
    await gift(id(707), 6, id(51));
    assert.equal(await score(), 4);
    assert.equal(await score(id(51)), 6);
    const balance = await f.total();
    assert.equal(await score(id(50), next), 0);
    assert.deepEqual(await f.total(), balance);
    assert.equal(await score(), 4, 'reading another week does not overwrite old week');
    assert.equal(
      (await gift(id(708), 2, null, id(2))).classId,
      id(50),
      'single class defaults at the backend',
    );
    await f.db.query('update class_members set is_active=false where user_id=$1', [id(3)]);
    assert.equal(
      (await gift(id(709), 2, null, id(3))).classId,
      null,
      'no active class remains an account-only gift',
    );
    await assert.rejects(gift(id(710), 2, id(51), id(2)), /Class access denied/);
    const boundary = (
      await f.q(
        "select tipy_week_start('2026-11-15T16:59:59.999Z'::timestamptz) before,tipy_week_start('2026-11-15T17:00:00Z'::timestamptz) after",
      )
    ).before;
    assert.equal(boundary.toISOString().slice(0, 10), '2026-11-09');
    assert.equal(
      (await f.q("select tipy_week_start('2026-11-15T17:00:00Z'::timestamptz) w")).w
        .toISOString()
        .slice(0, 10),
      '2026-11-16',
    );
    // Test the exact half-open interval using historical fixture events.
    await gift(id(711), 3, id(50), id(4));
    await gift(id(712), 7, id(50), id(4));
    await f.db.query(
      "update star_rewards set class_awarded_at='2026-11-15T16:59:59.999Z' where source_key=$1",
      [id(711)],
    );
    await f.db.query(
      "update star_rewards set class_awarded_at='2026-11-15T17:00:00Z' where source_key=$1",
      [id(712)],
    );
    assert.equal((await board(id(50), '2026-11-09')).find((r) => r.user_id === id(4)).stars, 3);
    assert.equal((await board(id(50), '2026-11-16')).find((r) => r.user_id === id(4)).stars, 7);
    await f.reset(id(713), id(4));
    await f.db.query(
      "update student_admin_actions set response=jsonb_set(response,'{resetAt}','\"2026-11-15T18:00:00Z\"') where request_id=$1",
      [id(713)],
    );
    assert.equal(
      (await board(id(50), '2026-11-09')).find((r) => r.user_id === id(4)).stars,
      3,
      'a later reset does not rewrite a closed week',
    );
    assert.equal(
      (await board(id(50), '2026-11-16')).find((r) => r.user_id === id(4)).stars,
      0,
      'a reset inside the selected week clears its previous gifts',
    );
    const response = (await f.q('select tipy_class_star_board($1,$2) r', [id(99), id(50)])).r;
    assert.equal(response.starScope, 'class_week');
    assert.ok(response.serverNow);
    assert.ok(response.nextWeekAt);
    await assert.rejects(
      f.q('select tipy_class_star_board($1,$2)', [id(3), id(50)]),
      /Class access denied/,
    );
    await f.db.exec('set role authenticated');
    await assert.rejects(board(), /permission denied/);
    await f.db.exec('reset role');
  } finally {
    await f.db.close();
  }
});
