import { createHash } from 'node:crypto';
import { ApiError, requireAdmin } from '../errors.js';
import { username, credential, emailFor } from './identity.js';
import { uuid, text } from './classrooms.js';

export function createTeachers(db, env) {
  const classes = (input) => {
    if (
      !Array.isArray(input.classIds) ||
      input.classIds.length > 200 ||
      new Set(input.classIds).size !== input.classIds.length
    )
      throw new ApiError(400, 'Danh sách lớp chưa hợp lệ.');
    input.classIds.forEach(uuid);
    return input.classIds;
  };
  const update = async (profile, action, input) => {
    const result = await db.rpc('tipy_teacher_admin', {
      p_actor: profile.user_id,
      p_action: action,
      p_input: input,
    });
    if (result.error)
      throw new ApiError(
        400,
        'Chưa lưu được giáo viên. Kiểm tra tài khoản và lớp được chọn, rồi thử lại.',
      );
    return result.data;
  };
  return {
    async teachers(profile, input = {}) {
      requireAdmin(profile);
      const page = Number(input.page || 1),
        search = String(input.search || '').trim();
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || search.length > 100)
        throw new ApiError(400, 'Bộ lọc chưa hợp lệ.');
      return update(profile, 'list', { page, search });
    },
    async teacherCreate(profile, input) {
      requireAdmin(profile);
      const name = username(input.username),
        fullName = text(input.fullName, 100, 'Họ tên');
      if (name === 'admin') throw new ApiError(400, 'Tên admin được bảo vệ.');
      const password = credential(name, input.password, env.TIPY_AUTH_SECRET);
      const classIds = classes(input),
        requestId = uuid(input.requestId);
      await update(profile, 'validate', { classIds });
      const hash = createHash('sha256')
        .update(JSON.stringify({ name, fullName, password, classIds: [...classIds].sort() }))
        .digest('hex');
      // Auth and SQL cannot share a transaction. The receipt in server-owned metadata makes retries recover the same account.
      const created = await db.auth.admin.createUser({
        email: emailFor(name),
        password,
        email_confirm: true,
        user_metadata: { username: name, full_name: fullName },
        app_metadata: {
          tipy_role: 'teacher',
          tipy_created_by: profile.user_id,
          tipy_create_request: requestId,
          tipy_create_hash: hash,
        },
      });
      let id = created.data?.user?.id;
      if (!id) {
        const existing = await db
          .from('profiles')
          .select('user_id')
          .eq('username', name)
          .maybeSingle();
        if (existing.error || !existing.data)
          throw new ApiError(409, 'Tên đăng nhập đã dùng hoặc chưa tạo được tài khoản.');
        const account = await db.auth.admin.getUserById(existing.data.user_id);
        const metadata = account.data?.user?.app_metadata;
        if (
          !metadata ||
          metadata.tipy_created_by !== profile.user_id ||
          metadata.tipy_create_request !== requestId ||
          metadata.tipy_create_hash !== hash
        )
          throw new ApiError(409, 'Tên đăng nhập đã được sử dụng.');
        id = existing.data.user_id;
      }
      return update(profile, 'provision', { userId: id, classIds });
    },
    async teacherSave(profile, input) {
      requireAdmin(profile);
      uuid(input.userId);
      const classIds = classes(input);
      if (typeof input.active !== 'boolean')
        throw new ApiError(400, 'Trạng thái tài khoản chưa hợp lệ.');
      return update(profile, 'save', { userId: input.userId, classIds, active: input.active });
    },
  };
}
