import { ApiError, createBackend, ready } from '../server/backend.js';

export function readCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => {
        const index = part.indexOf('=');
        return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1)];
      })
      .filter(([key]) => key),
  );
}
export function setSession(res, session, production = true) {
  const flags = `Path=/; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `tipy_access=${session?.access_token || ''}; ${flags}; Max-Age=${session ? Math.max(60, session.expires_in || 3600) : 0}`,
    `tipy_refresh=${session?.refresh_token || ''}; ${flags}; Max-Age=${session ? 2592000 : 0}`,
  ]);
}
export function createHandler({ env = process.env, makeBackend = createBackend } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!['GET', 'POST'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST');
        throw new ApiError(405, 'Phương thức không hỗ trợ.');
      }
      if (req.method === 'POST') {
        if (req.headers.origin !== (env.APP_ORIGIN || 'https://tipys.vercel.app'))
          throw new ApiError(403, 'Nguồn yêu cầu không hợp lệ.');
        if (!req.headers['content-type']?.startsWith('application/json'))
          throw new ApiError(415, 'Yêu cầu cần dùng JSON.');
      }
      let body = req.body || {};
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 16384) throw new ApiError(413, 'Yêu cầu quá lớn.');
        try {
          body = JSON.parse(body);
        } catch {
          throw new ApiError(400, 'JSON chưa hợp lệ.');
        }
      }
      if (Buffer.byteLength(JSON.stringify(body)) > 16384)
        throw new ApiError(413, 'Yêu cầu quá lớn.');
      const action = req.method === 'GET' ? req.query?.action || 'bootstrap' : body.action;
      if (action === 'bootstrap' && !ready(env))
        return res.status(200).json({ configured: false, user: null, games: [] });
      const backend = makeBackend(env),
        cookies = readCookies(req.headers.cookie);
      const production = env.NODE_ENV !== 'development';
      const current = async () => {
        const info = await backend.session(cookies.tipy_access, cookies.tipy_refresh);
        if (info.session) setSession(res, info.session, production);
        return info;
      };
      if (req.method === 'POST' && ['login', 'signup'].includes(action)) {
        const ip =
          req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          'unknown';
        const result = await backend.auth(action, body, ip);
        setSession(res, result.session, production);
        return res.status(200).json({ user: result.profile });
      }
      if (req.method === 'GET' && action === 'bootstrap') {
        let user = null;
        try {
          user = (await current()).profile;
        } catch (error) {
          if (![401, 403].includes(error.status)) throw error;
          setSession(res, null, production);
        }
        const [games, classes] = await Promise.all([
          backend.games(user?.role === 'admin'),
          user ? backend.classes(user) : [],
        ]);
        return res.status(200).json({
          configured: true,
          user,
          games,
          classes,
        });
      }
      const { profile, access } = await current();
      if (req.method === 'GET' && action === 'points')
        return res.status(200).json(await backend.points(profile));
      if (req.method === 'GET' && action === 'quest_class_report')
        return res
          .status(200)
          .json(await backend.questClassReport(profile, { classId: req.query?.classId }));
      if (req.method === 'GET' && action === 'quest_progress')
        return res.status(200).json(await backend.questProgress(profile));
      if (req.method === 'GET' && action === 'classes')
        return res.status(200).json({ classes: await backend.classes(profile) });
      if (req.method === 'GET' && action === 'class_roster')
        return res
          .status(200)
          .json({ userIds: await backend.classRoster(profile, { classId: req.query?.classId }) });
      if (req.method === 'GET' && ['classroom', 'class_posts'].includes(action)) {
        const offset = Number(req.query?.offset || 0);
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
          throw new ApiError(400, 'Trang chưa hợp lệ.');
        return res.status(200).json(
          await backend[action === 'class_posts' ? 'classPosts' : 'classroom'](profile, {
            classId: req.query?.classId,
            offset,
          }),
        );
      }
      if (req.method === 'GET' && action === 'class_file')
        return res
          .status(200)
          .json(await backend.classFile(profile, { attachmentId: req.query?.attachmentId }));
      if (req.method === 'GET' && action === 'avatar')
        return res.status(200).json({ avatar: await backend.avatar(profile) });
      if (req.method === 'GET' && action === 'history')
        return res.status(200).json({
          history: await backend.history(profile, { userId: req.query?.userId }),
        });
      if (req.method === 'GET' && action === 'students')
        return res.status(200).json({ students: await backend.students(profile) });
      if (req.method === 'GET' && action === 'students_page')
        return res.status(200).json(await backend.studentsPage(profile, req.query));
      if (req.method === 'POST' && action === 'logout') {
        await backend.logout(access);
        setSession(res, null, production);
        return res.status(200).json({ ok: true });
      }
      const actions = {
        class_save: 'classSave',
        class_archive: 'classArchive',
        class_member: 'classMember',
        class_members: 'classMembers',
        avatar_save: 'avatarSave',
        class_upload: 'classUpload',
        class_post: 'classPost',
        post_archive: 'postArchive',
        quest_finish: 'questFinish',
        start: 'start',
        progress: 'progress',
        save_game: 'saveGame',
        student_active: 'studentUpdate',
        student_delete: 'studentDelete',
      };
      if (req.method === 'POST' && actions[action])
        return res.status(200).json({ data: await backend[actions[action]](profile, body) });
      throw new ApiError(404, 'Chức năng chưa được hỗ trợ.');
    } catch (error) {
      return res.status(error instanceof ApiError ? error.status : 500).json({
        error:
          error instanceof ApiError
            ? error.message
            : 'Chưa kết nối được máy chủ. Bạn thử lại sau nhé.',
      });
    }
  };
}
export default createHandler();
