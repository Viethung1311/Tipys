import { ApiError, fail } from '../errors.js';
import { uuid } from './classrooms.js';
export function createStars(db) {
  return {
    async stars(profile) {
      const result = await db.rpc('tipy_star_total', { p_user: profile.user_id });
      fail(result.error, 'Chưa tải được sao của bạn.');
      return result.data;
    },
    async classStars(profile, input) {
      uuid(input.classId);
      if (input.week !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.week))
        throw new ApiError(400, 'Tuần chưa hợp lệ.');
      const result = await db.rpc('tipy_class_star_board', {
        p_actor: profile.user_id,
        p_class: input.classId,
        p_week: input.week ?? null,
      });
      if (result.error?.message === 'Class access denied')
        throw new ApiError(403, 'Bạn không còn quyền vào lớp này.');
      fail(result.error, 'Chưa mở được bảng sao. Kiểm tra quyền lớp hoặc tuần đang chọn.');
      return result.data;
    },
  };
}
