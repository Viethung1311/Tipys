/** Shared API errors and role checks. Never trust a role from browser input. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireAdmin(profile) {
  if (profile.role !== 'admin')
    throw new ApiError(403, 'Chỉ giáo viên quản trị được dùng chức năng này.');
}
export const fail = (error, message = 'Chưa xử lý được yêu cầu. Bạn thử lại nhé.') => {
  if (error) throw new ApiError(400, message);
};
