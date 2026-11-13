import { ApiError, fail, requireAdmin } from '../errors.js';
import { uuid } from './classrooms.js';
export function createStars(db) {
  const adjust = async (profile, input, deduct = false) => {
    requireAdmin(profile);
    uuid(input.userId);
    uuid(input.requestId);
    if (input.classId !== undefined) uuid(input.classId);
    if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 2147483647)
      throw new ApiError(400, 'Nhập số sao nguyên dương hợp lệ.');
    if (input.message !== undefined && typeof input.message !== 'string')
      throw new ApiError(400, 'Lời nhắn chưa hợp lệ.');
    const message = (input.message || '').trim();
    if (message.length > 240) throw new ApiError(400, 'Lời nhắn tối đa 240 ký tự.');
    const result = await db.rpc(deduct ? 'tipy_deduct_stars' : 'tipy_class_star_gift', {
      p_actor: profile.user_id,
      p_user: input.userId,
      p_request: input.requestId,
      p_amount: input.amount,
      p_message: message,
      p_class: input.classId ?? null,
    });
    if (result.error?.message === 'Class access denied')
      throw new ApiError(403, 'Bạn không có quyền thao tác học sinh trong lớp này.');
    fail(result.error, 'Chưa xác nhận được thay đổi sao. Thử lại cùng yêu cầu để tránh ghi trùng.');
    return result.data;
  };
  return {
    starDeduct: (profile, input) => adjust(profile, input, true),
    async starReset(profile, input) {
      requireAdmin(profile);
      uuid(input.userId);
      uuid(input.requestId);
      if (input.confirm !== 'accept') throw new ApiError(400, 'Nhập chính xác accept để xác nhận.');
      const result = await db.rpc('tipy_reset_stars', {
        p_actor: profile.user_id,
        p_user: input.userId,
        p_request: input.requestId,
        p_confirm: input.confirm,
      });
      fail(result.error, 'Chưa xác nhận được reset sao. Thử lại cùng yêu cầu để kiểm tra an toàn.');
      return result.data;
    },
    async studentReset(profile, input) {
      requireAdmin(profile);
      uuid(input.userId);
      uuid(input.gameId);
      uuid(input.requestId);
      if (input.confirm !== 'accept') throw new ApiError(400, 'Nhập chính xác accept để xác nhận.');
      const result = await db.rpc('tipy_student_reset', {
        p_actor: profile.user_id,
        p_user: input.userId,
        p_game: input.gameId,
        p_request: input.requestId,
        p_confirm: input.confirm,
      });
      fail(result.error, 'Chưa xác nhận được đặt lại. Thử lại cùng yêu cầu để kiểm tra an toàn.');
      return result.data;
    },
    async starGift(profile, input) {
      return adjust(profile, input);
    },
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
