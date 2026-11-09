import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classMembersView, classTop, createClassrooms } from '../server/modules/classrooms.js';
test('class top uses the supplied class members, highest typing score and cumulative practice', () => {
  const row = (user_id, score, seconds) => ({
    user_id,
    profiles: {
      full_name: user_id,
      player_game_stats: [
        {
          best_play: { score },
          total_active_seconds: seconds,
          games: { game_code: 'falling_letters' },
        },
        { best_play: { score: 99999 }, total_active_seconds: 3, games: { game_code: 'other' } },
      ],
    },
  });
  const members = classMembersView([
      row('an', 500, 10),
      row('binh', 1000, 20),
      row('chi', 500, 30),
      row('new', 0, 0),
    ]),
    top = classTop(members);
  assert.deepEqual(
    top.map((m) => [m.user_id, m.best_score, m.rank]),
    [
      ['binh', 1000, 1],
      ['chi', 500, 2],
      ['an', 500, 3],
    ],
  );
  assert.equal(top[0].total_active_seconds, 23);
  assert.equal(
    top.some((m) => m.user_id === 'outsider'),
    false,
  );
  assert.equal(members.length, 4);
});
test('classroom gathers achievements only after class authorization and queries by class ID', async () => {
  const calls = [];
  const student = { user_id: '11111111-1111-4111-8111-111111111111', role: 'student' },
    classId = '22222222-2222-4222-8222-222222222222';
  const db = {
    from(table) {
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          calls.push([table, key, value]);
          return query;
        },
        is() {
          return query;
        },
        order() {
          return query;
        },
        limit: async () => ({
          data: [
            { user_id: student.user_id, profiles: { full_name: 'An', player_game_stats: [] } },
          ],
        }),
        range: async () => ({ data: [] }),
        maybeSingle: async () => ({ data: table === 'classes' ? { class_id: classId } : null }),
      };
      return query;
    },
  };
  await assert.rejects(
    createClassrooms(db).classroom(student, { classId }),
    (e) => e.status === 403,
  );
  assert.equal(
    calls.some((c) => c[0] === 'class_posts'),
    false,
  );
  const admin = await createClassrooms(db).classroom({ role: 'admin' }, { classId });
  assert.equal(admin.members.length, 1);
  assert.deepEqual(admin.achievements, []);
  assert.ok(calls.some((c) => c[0] === 'class_members' && c[1] === 'class_id' && c[2] === classId));
});
test('avatar settings work without enrollment and cannot target another user', async () => {
  const calls = [],
    owned = '11111111-1111-4111-8111-111111111111';
  const db = {
    from(table) {
      calls.push(['table', table]);
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          calls.push([key, value]);
          return q;
        },
        maybeSingle: async () => ({ data: null }),
        upsert(value) {
          calls.push(['write', value]);
          return q;
        },
        single: async () => ({ data: { animal: 'cat', accessory: 'star', color: 'sun' } }),
      };
      return q;
    },
  };
  const service = createClassrooms(db);
  assert.equal((await service.avatar({ user_id: owned })).animal, 'rat');
  await service.avatarSave(
    { user_id: owned },
    { animal: 'cat', accessory: 'star', color: 'sun', userId: 'forged' },
  );
  assert.equal(calls.find((c) => c[0] === 'write')[1].user_id, owned);
  assert.equal(
    calls.some((c) => c[0] === 'table' && c[1] === 'classes'),
    false,
  );
  await assert.rejects(
    service.avatarSave({ user_id: owned }, { animal: 'fake', accessory: 'star', color: 'sun' }),
  );
});
