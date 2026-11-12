import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classMembersView, createClassrooms } from '../server/modules/classrooms.js';
test('class member view preserves practice totals without merging game scores', () => {
  const rows = classMembersView([
    {
      user_id: 'an',
      profiles: {
        full_name: 'An',
        player_game_stats: [
          { best_play: { score: 500 }, total_active_seconds: 10 },
          { best_play: { score: 9999 }, total_active_seconds: 3 },
        ],
      },
    },
  ]);
  assert.equal(rows[0].total_active_seconds, 13);
  assert.equal(rows[0].best_score, undefined);
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
  assert.equal(admin.achievements, undefined);
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
        single: async () => ({ data: { animal: 'icon_24', accessory: 'star', color: 'sun' } }),
      };
      return q;
    },
  };
  const service = createClassrooms(db);
  assert.equal((await service.avatar({ user_id: owned })).animal, 'icon_01');
  await service.avatarSave(
    { user_id: owned },
    { animal: 'icon_24', accessory: 'star', color: 'sun', userId: 'forged' },
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
