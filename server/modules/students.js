import { ApiError, requireAdmin, fail } from '../errors.js';
import { uuid } from './classrooms.js';

export function createStudents(db) {
  return {
    async studentsPage(profile, input = {}) {
      requireAdmin(profile);
      const page = Number(input.page ?? 1),
        search = String(input.search ?? '').trim(),
        classFilter = input.classFilter ?? 'all',
        sort = input.sort ?? 'desc',
        membership = input.membership ?? 'all';
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 1000000 ||
        search.length > 100 ||
        !['asc', 'desc'].includes(sort) ||
        !['all', 'members', 'candidates'].includes(membership)
      )
        throw new ApiError(400, 'Bộ lọc chưa hợp lệ.');
      if (!['all', 'none'].includes(classFilter)) uuid(classFilter);
      if (input.rosterClass) uuid(input.rosterClass);
      if (!input.rosterClass && membership !== 'all') throw new ApiError(400, 'Chọn lớp trước.');
      const result = await db.rpc('tipy_students_page', {
        p_page: page,
        p_search: search,
        p_class: classFilter,
        p_sort: sort,
        p_roster: input.rosterClass || null,
        p_membership: membership,
      });
      fail(result.error);
      return result.data;
    },
    async studentDelete(profile, input) {
      requireAdmin(profile);
      const id = uuid(input.userId);
      if (id === profile.user_id)
        throw new ApiError(403, 'Không được tự xóa tài khoản đang đăng nhập.');
      if (
        typeof input.confirmUsername !== 'string' ||
        !/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(input.confirmUsername)
      )
        throw new ApiError(400, 'Nhập lại đúng tên đăng nhập để xác nhận.');
      const target = await db
        .from('profiles')
        .select('user_id,username,role')
        .eq('user_id', id)
        .maybeSingle();
      fail(target.error);
      if (
        target.data &&
        (target.data.role !== 'student' || target.data.username !== input.confirmUsername)
      )
        throw new ApiError(403, 'Chỉ xóa học sinh và phải xác nhận đúng tên đăng nhập.');
      // Never delete classroom posts/files to unblock an account deletion.
      if (target.data) {
        const dependencies = await Promise.all(
          [
            ['classes', 'created_by'],
            ['class_posts', 'author_id'],
            ['class_attachments', 'uploaded_by'],
          ].map(([table, column]) =>
            db.from(table).select('*', { count: 'exact', head: true }).eq(column, id),
          ),
        );
        dependencies.forEach((result) => fail(result.error));
        if (dependencies.some((result) => result.count > 0))
          throw new ApiError(
            409,
            'Tài khoản còn sở hữu lớp hoặc tài liệu dùng chung. Chưa xóa; cần chuyển quyền sở hữu trước.',
          );
        await db.auth.admin.deleteUser(id, false).catch(() => ({ error: true }));
      }
      const [auth, remaining] = await Promise.all([
        db.auth.admin.getUserById(id),
        db.from('profiles').select('user_id').eq('user_id', id).maybeSingle(),
      ]);
      const missingAuth = auth.error?.status === 404 || auth.error?.code === 'user_not_found';
      if (missingAuth && !remaining.error && !remaining.data) return { deleted: true, userId: id };
      if (auth.data?.user && !remaining.error && remaining.data)
        throw new ApiError(
          503,
          'Chưa xóa được: tài khoản và hồ sơ vẫn còn. Có thể còn tệp Storage hoặc quan hệ dữ liệu cần xử lý; hãy thử lại. Không xóa dữ liệu dùng chung để bỏ chặn.',
        );
      throw new ApiError(
        503,
        'Chưa xác nhận xóa hoàn tất. Dữ liệu dùng chung được giữ nguyên. Hãy thử lại an toàn với cùng tài khoản.',
      );
    },
  };
}
