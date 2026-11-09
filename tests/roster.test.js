import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClassrooms } from '../server/modules/classrooms.js';
const id = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
function database(validIds) {
  const writes = [],
    calls = [];
  return {
    writes,
    calls,
    from(table) {
      let write;
      const q = {
        select() {
          calls.push([table, 'select']);
          if (write)
            return Promise.resolve({
              data: write.map((x) => ({ user_id: x.user_id, is_active: x.is_active })),
            });
          return q;
        },
        eq() {
          return q;
        },
        is() {
          return q;
        },
        in() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle: async () => ({ data: { class_id: id(9) } }),
        upsert(rows) {
          write = rows;
          writes.push(rows);
          return q;
        },
        then(resolve) {
          return Promise.resolve({ data: validIds.map((user_id) => ({ user_id })) }).then(resolve);
        },
      };
      return q;
    },
  };
}
test('bulk roster checks admin and all students before one atomic upsert', async () => {
  const db = database([id(1), id(2)]),
    service = createClassrooms(db),
    admin = { role: 'admin' };
  const input = { classId: id(9), userIds: [id(1), id(2)], active: true };
  assert.deepEqual(await service.classMembers(admin, input), {
    classId: id(9),
    userIds: input.userIds,
    active: true,
  });
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].length, 2);
  await assert.rejects(service.classMembers({ role: 'student' }, input), (e) => e.status === 403);
  assert.equal(db.writes.length, 1);
  for (const userIds of [[], [id(1), id(1)], ['bad'], Array.from({ length: 201 }, (_, n) => id(n))])
    await assert.rejects(service.classMembers(admin, { ...input, userIds }));
  assert.equal(db.writes.length, 1);
  const invalid = database([id(1)]);
  await assert.rejects(
    createClassrooms(invalid).classMembers(admin, input),
    (e) => e.status === 400,
  );
  assert.equal(invalid.writes.length, 0);
});
test('bulk removal accepts a single student and writes inactive without deleting accounts', async () => {
  const db = database([id(1)]);
  const result = await createClassrooms(db).classMembers(
    { role: 'admin' },
    { classId: id(9), userIds: [id(1)], active: false },
  );
  assert.equal(result.active, false);
  assert.deepEqual(db.writes, [[{ class_id: id(9), user_id: id(1), is_active: false }]]);
});
