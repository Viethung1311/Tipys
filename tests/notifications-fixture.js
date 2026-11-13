import { readFileSync } from 'node:fs';
import { starFixture, id } from './star-balance-fixture.js';
import { createAssessments } from '../server/modules/assessments.js';
import { createNotifications } from '../server/modules/notifications.js';
export { id };
export const notificationMigration = 'supabase/migrations/20261113092435_student_notifications.sql';
export async function notificationsFixture() {
  const f = await starFixture();
  for (const name of ['assessments', 'assessment_policies', 'assessment_class_access'])
    await f.db.exec(readFileSync(`db/${name}.sql`, 'utf8'));
  await f.db.exec(readFileSync(notificationMigration, 'utf8'));
  const rpc = async (name, args) => {
    const entries = Object.entries(args);
    try {
      return {
        data: (
          await f.q(
            `select public.${name}(${entries.map(([key], i) => `${key}=>$${i + 1}`).join(',')}) r`,
            entries.map(([, v]) => v),
          )
        ).r,
      };
    } catch (e) {
      return { error: { message: e.message } };
    }
  };
  const assessments = createAssessments({ rpc }),
    notifications = createNotifications({ rpc });
  const admin = { user_id: id(99), role: 'admin' },
    person = (n) => ({ user_id: id(n), role: 'student' });
  const draft = async (
    n,
    targets = { classIds: [id(50)], userIds: [] },
    schedule = { mode: 'always' },
  ) => {
    const row = await assessments.assessmentSave(admin, {
      assessmentId: id(n),
      requestId: crypto.randomUUID(),
      version: 0,
      title: `Bài kiểm tra thử ${n}`,
      targets,
      selection: { questIds: ['keys-as-1'], falling: null },
      schedule,
    });
    return { assessmentId: id(n), version: row.version };
  };
  const publish = async (n, targets, schedule) =>
    assessments.assessmentPublish(admin, await draft(n, targets, schedule));
  return { ...f, rpc, assessments, notifications, person, admin, draft, publish };
}
