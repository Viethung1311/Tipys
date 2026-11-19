import { readFileSync } from 'node:fs';
import { notificationsFixture, id } from './notifications-fixture.js';
import { createTeachers } from '../server/modules/teachers.js';
export { id };
export async function teacherFixture() {
  const f = await notificationsFixture();
  for (const file of [
    'class_post_requests',
    'star_deductions',
    'assessment_best_results',
    'class_week_stars',
  ])
    await f.db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
  await f.db.exec(readFileSync('supabase/migrations/20261119101038_teacher_roles.sql', 'utf8'));
  for (const n of [8, 30, 31, 32])
    await f.db.query('insert into auth.users values($1,$2,$3)', [
      id(n),
      {
        username: n === 8 ? 'student8' : `teacher${n}`,
        full_name: n === 8 ? 'Học sinh thử 8' : `Giáo viên ${n}`,
      },
      {},
    ]);
  await f.db.query("insert into classes(class_id,name,created_by) values($1,'Lớp B',$2)", [
    id(51),
    id(99),
  ]);
  await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(51), id(8)]);
  const adminRpc = (action, input, actor = id(99)) =>
    f.q('select tipy_teacher_admin($1,$2,$3) r', [actor, action, input]).then((r) => r.r);
  for (const [teacher, group] of [
    [30, 50],
    [31, 51],
    [32, null],
  ])
    await adminRpc('provision', { userId: id(teacher), classIds: group ? [id(group)] : [] });
  const people = async (n) =>
    await f.q('select user_id,username,full_name,role,is_active from profiles where user_id=$1', [
      id(n),
    ]);
  const users = new Map();
  let created = 0;
  const db = {
    rpc: f.rpc,
    from: () => ({
      select() {
        return this;
      },
      eq(_, value) {
        this.username = value;
        return this;
      },
      async maybeSingle() {
        return {
          data: await f.q('select user_id,role from profiles where username=$1', [this.username]),
        };
      },
    }),
    auth: {
      admin: {
        async createUser(input) {
          if (users.has(input.email)) return { error: { message: 'exists' } };
          const user = { id: id(200 + ++created), app_metadata: input.app_metadata };
          users.set(input.email, user);
          await f.db.query('insert into auth.users values($1,$2,$3)', [
            user.id,
            input.user_metadata,
            input.app_metadata,
          ]);
          return { data: { user } };
        },
        async getUserById(userId) {
          return { data: { user: [...users.values()].find((u) => u.id === userId) } };
        },
      },
    },
  };
  return {
    ...f,
    dbClient: db,
    teachers: createTeachers(db, { TIPY_AUTH_SECRET: 'fixture-secret-'.repeat(3) }),
    adminRpc,
    people,
  };
}
