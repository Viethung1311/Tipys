/** Identity owns account provisioning, short-PIN hashing and session rotation. */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { ApiError, fail } from '../errors.js';
export function username(value) {
  const name = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(name))
    throw new ApiError(
      400,
      'Tên đăng nhập dùng chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.',
    );
  return name;
}
export function credential(name, password, secret) {
  if (typeof password !== 'string' || !password.length)
    throw new ApiError(400, 'Bạn nhập mật khẩu nhé.');
  if (Buffer.byteLength(password) > 1024) throw new ApiError(413, 'Nội dung nhập quá lớn.');
  return createHmac('sha256', secret).update(`tipy-pin-v1\0${name}\0${password}`).digest('hex');
}
export const emailFor = (name) =>
  `${createHash('sha256').update(name).digest('hex')}@accounts.tipy.invalid`;

export function createIdentity({ db, client, env }) {
  return {
    async auth(action, input, ip) {
      const name = username(input.username);
      const password = credential(name, input.password, env.TIPY_AUTH_SECRET);
      const limitKey = createHmac('sha256', env.TIPY_AUTH_SECRET)
        .update(`${action}\0${ip}\0${action === 'signup' ? '' : name}`)
        .digest('hex');
      const limit = await db.rpc('tipy_auth_limit', {
        p_key: limitKey,
        p_limit: action === 'signup' ? 60 : 10,
      });
      if (limit.error) throw new ApiError(503, 'Chưa kết nối được phần tài khoản.');
      if (!limit.data)
        throw new ApiError(429, 'Bạn thử nhiều lần rồi. Chờ 5 phút hoặc nhờ giáo viên giúp nhé.');
      if (action === 'login' && name === 'admin' && env.TIPY_ADMIN_INITIAL_PASSWORD) {
        const expected = credential(name, env.TIPY_ADMIN_INITIAL_PASSWORD, env.TIPY_AUTH_SECRET);
        if (timingSafeEqual(Buffer.from(password), Buffer.from(expected))) {
          const existing = await db
            .from('profiles')
            .select('user_id,role')
            .eq('username', 'admin')
            .maybeSingle();
          if (existing.error) throw new ApiError(503, 'Chưa kết nối được phần tài khoản.');
          let adminId = existing.data?.user_id;
          if (!adminId) {
            const created = await db.auth.admin.createUser({
              email: emailFor('admin'),
              password,
              email_confirm: true,
              user_metadata: { username: 'admin', full_name: 'Giáo viên TIPY' },
              app_metadata: { tipy_role: 'admin' },
            });
            // A concurrent first login may already have created the same admin.
            if (created.error && !/already|registered|exists/i.test(created.error.message))
              throw new ApiError(503, 'Chưa khởi tạo được tài khoản giáo viên.');
            adminId = created.data?.user?.id;
            if (!adminId) {
              const found = await db
                .from('profiles')
                .select('user_id')
                .eq('username', 'admin')
                .single();
              adminId = found.data?.user_id;
            }
          }
          if (!adminId) throw new ApiError(503, 'Chưa khởi tạo được tài khoản giáo viên.');
          if (existing.data?.role !== 'admin') {
            const secured = await db.auth.admin.updateUserById(adminId, {
              password,
              app_metadata: { tipy_role: 'admin' },
            });
            if (secured.error) throw new ApiError(503, 'Chưa khởi tạo được tài khoản giáo viên.');
            const promoted = await db
              .from('profiles')
              .update({ role: 'admin' })
              .eq('user_id', adminId);
            if (promoted.error) throw new ApiError(503, 'Chưa khởi tạo được tài khoản giáo viên.');
          }
        }
      }
      if (action === 'signup') {
        if (name === 'admin')
          throw new ApiError(400, 'Tên này dành riêng cho giáo viên. Bạn chọn tên khác nhé.');
        const fullName = String(input.fullName ?? '').trim();
        if (!fullName || fullName.length > 100)
          throw new ApiError(400, 'Bạn nhập tên của mình nhé.');
        const created = await db.auth.admin.createUser({
          email: emailFor(name),
          password,
          email_confirm: true,
          user_metadata: { username: name, full_name: fullName },
          app_metadata: { tipy_role: 'student' },
        });
        fail(created.error, 'Chưa tạo được tài khoản. Tên đăng nhập có thể đã được sử dụng.');
      }
      const signed = await client().auth.signInWithPassword({ email: emailFor(name), password });
      if (signed.error || !signed.data.session)
        throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
      const profile = await this.profile(signed.data.user.id);
      return { profile, session: signed.data.session };
    },
    async profile(id) {
      const { data, error } = await db
        .from('profiles')
        .select('user_id,username,full_name,role,is_active')
        .eq('user_id', id)
        .single();
      if (error || !data?.is_active)
        throw new ApiError(403, 'Tài khoản đang được khóa. Bạn nhờ giáo viên hỗ trợ nhé.');
      return data;
    },
    async session(access, refresh) {
      let rotated = null;
      let result = access ? await db.auth.getUser(access) : { error: true };
      if (result.error && refresh) {
        const renewed = await client().auth.refreshSession({ refresh_token: refresh });
        if (!renewed.error) {
          rotated = renewed.data.session;
          result = await db.auth.getUser(rotated.access_token);
        }
      }
      if (result.error || !result.data?.user) throw new ApiError(401, 'Bạn đăng nhập trước nhé.');
      return {
        profile: await this.profile(result.data.user.id),
        session: rotated,
        access: rotated?.access_token || access,
      };
    },
    async logout(access) {
      if (access) {
        const response = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${access}` },
        });
        if (!response.ok && response.status !== 401)
          throw new ApiError(503, 'Chưa đăng xuất được. Bạn thử lại nhé.');
      }
    },
  };
}
