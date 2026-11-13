import { ApiError, fail } from '../errors.js';
import { uuid } from './classrooms.js';
const student = (profile) => {
  if (profile.role !== 'student') throw new ApiError(403, 'Thông báo này dành cho học sinh.');
};
export function createNotifications(db) {
  return {
    async notifications(profile, input = {}) {
      student(profile);
      const page = Number(input.page ?? 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
        throw new ApiError(400, 'Trang chưa hợp lệ.');
      const result = await db.rpc('tipy_notifications_list', {
        p_user: profile.user_id,
        p_page: page,
      });
      fail(result.error, 'Chưa tải được thông báo. Em thử lại nhé.');
      return result.data;
    },
    async notificationsPresent(profile, input) {
      student(profile);
      if (
        !Array.isArray(input.ids) ||
        !input.ids.length ||
        input.ids.length > 50 ||
        typeof input.speak !== 'boolean'
      )
        throw new ApiError(400, 'Thông báo chưa hợp lệ.');
      input.ids.forEach(uuid);
      const result = await db.rpc('tipy_notifications_present', {
        p_user: profile.user_id,
        p_ids: [...new Set(input.ids)],
        p_speak: input.speak,
      });
      fail(result.error, 'Chưa lưu được trạng thái thông báo.');
      return result.data;
    },
    watchNotifications(profile, changed, status) {
      student(profile);
      const channel = db
        .channel(`student-notifications:${profile.user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'student_notifications',
            filter: `user_id=eq.${uuid(profile.user_id)}`,
          },
          changed,
        )
        .subscribe(status);
      return async () => {
        await db.removeChannel(channel);
        db.realtime.disconnect();
      };
    },
  };
}
