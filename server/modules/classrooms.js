import { CHARACTERS, normalizeAvatar } from '../../src/characters/catalog.js';
/** Classroom service: server-side authorization precedes every read/write/sign. */
import { randomUUID } from 'node:crypto';
import { ApiError, requireAdmin, fail } from '../errors.js';
import { QUEST_CODE, findLesson } from '../../src/features/keyboard-quest/curriculum.js';
import { learningSummary } from '../../src/features/keyboard-quest/progress.js';
import { accountPoints } from '../../src/game/points.js';
import {
  ACCESSORIES,
  COLORS,
  FILE_TYPES,
  MAX_FILE_BYTES,
} from '../../src/features/classroom/constants.js';
const BUCKET = 'tipy-classroom';
export function uuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new ApiError(400, 'Mã dữ liệu chưa hợp lệ.');
  return value;
}
export function text(value, max, label, required = true) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max)
    throw new ApiError(400, `${label}: tối đa ${max} ký tự.`);
  return result;
}
export function safeLink(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, 'Link chưa hợp lệ.');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    value.length > 2000
  )
    throw new ApiError(400, 'Chỉ dùng link http hoặc https.');
  return url.href;
}
export function validateFile(input) {
  const name = text(input.name, 180, 'Tên file'),
    extension = name.split('.').pop().toLowerCase(),
    mime = FILE_TYPES[extension];
  if (
    !mime ||
    input.mime !== mime ||
    !Number.isInteger(input.size) ||
    input.size < 1 ||
    input.size > MAX_FILE_BYTES
  )
    throw new ApiError(400, 'File tối đa 5 MB: PNG, JPG, WEBP, PDF, TXT, DOCX, XLSX hoặc PPTX.');
  return { name, mime, extension, size: input.size };
}
/** Only rows already scoped by class membership may enter the class achievement list. */
export function classMembersView(rows) {
  return rows.map((row) => {
    const stats = row.profiles.player_game_stats || [];
    return {
      user_id: row.user_id,
      name: row.profiles.full_name,
      avatar: normalizeAvatar(row.profiles.student_avatars),
      best_score: accountPoints(stats, row.profiles.player_lesson_progress || []),
      total_active_seconds: stats.reduce((sum, s) => sum + Number(s.total_active_seconds || 0), 0),
    };
  });
}
export function classTop(members) {
  return members
    .filter((m) => m.best_score > 0)
    .sort(
      (a, b) =>
        b.best_score - a.best_score ||
        b.total_active_seconds - a.total_active_seconds ||
        a.user_id.localeCompare(b.user_id),
    )
    .slice(0, 10)
    .map((m, index) => ({ ...m, rank: index + 1 }));
}
export function createClassrooms(db) {
  const access = async (profile, classId, adminOnly = false) => {
    uuid(classId);
    if (adminOnly) requireAdmin(profile);
    const result = await db
      .from('classes')
      .select('*')
      .eq('class_id', classId)
      .is('archived_at', null)
      .maybeSingle();
    fail(result.error);
    if (!result.data) throw new ApiError(404, 'Lớp không còn mở.');
    if (profile.role !== 'admin') {
      const member = await db
        .from('class_members')
        .select('user_id')
        .eq('class_id', classId)
        .eq('user_id', profile.user_id)
        .eq('is_active', true)
        .maybeSingle();
      fail(member.error);
      if (!member.data) throw new ApiError(403, 'Bạn chưa được thêm vào lớp này.');
    }
    return result.data;
  };
  const postsQuery = (input) =>
    db
      .from('class_posts')
      .select(
        'post_id,title,body,link,created_at,class_attachments(attachment_id,name,mime_type,size_bytes)',
      )
      .eq('class_id', input.classId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(input.offset || 0, (input.offset || 0) + 19);
  return {
    async classDeletions(profile) {
      requireAdmin(profile);
      const { data, error } = await db
        .from('class_deletions')
        .select('class_id,name')
        .neq('paths', '{}')
        .order('deleted_at');
      fail(error);
      return data;
    },
    async classDelete(profile, input) {
      requireAdmin(profile);
      const classId = uuid(input.classId);
      if (
        typeof input.confirmName !== 'string' ||
        !input.confirmName ||
        input.confirmName.length > 100
      )
        throw new ApiError(400, 'Nhập đúng tên lớp để xác nhận.');
      const { data, error } = await db.rpc('tipy_delete_class', {
        p_actor: profile.user_id,
        p_class: classId,
        p_name: input.confirmName,
      });
      const deletionErrors = [
        'Hãy lưu trữ lớp trước khi xóa vĩnh viễn.',
        'Tên xác nhận chưa đúng.',
        'Có tệp liên kết chéo lớp; cần kiểm tra trước khi xóa.',
        'Không tìm thấy lớp.',
      ];
      fail(
        error,
        deletionErrors.includes(error?.message)
          ? error.message
          : 'Chưa xác nhận được trạng thái xóa. Hãy thử lại an toàn để kiểm tra và tiếp tục dọn tệp.',
      );
      // The transaction leaves a durable receipt before any Storage request.
      const paths = data.paths.slice(0, 100);
      let remaining = data.paths.length;
      try {
        if (paths.length) {
          const removed = await db.storage.from(BUCKET).remove(paths);
          if (removed.error) throw removed.error;
          const ack = await db.rpc('tipy_ack_class_files', {
            p_actor: profile.user_id,
            p_class: classId,
            p_paths: paths,
          });
          if (ack.error) throw ack.error;
          remaining = ack.data;
        }
      } catch {
        return {
          deleted: true,
          cleanupPending: true,
          remaining,
          message: 'Lớp đã xóa khỏi database. Chưa xác nhận dọn hết tệp; hãy thử lại.',
        };
      }
      return {
        deleted: true,
        cleanupPending: remaining > 0,
        remaining,
        message: remaining
          ? 'Lớp đã xóa. Còn tệp cần dọn, hãy tiếp tục.'
          : 'Đã xóa vĩnh viễn lớp. Tệp còn được nơi khác sử dụng được giữ lại.',
      };
    },
    async classes(profile) {
      if (profile.role === 'admin') {
        const { data, error } = await db
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        fail(error);
        return data;
      }
      const { data, error } = await db
        .from('class_members')
        .select('classes!inner(*)')
        .eq('user_id', profile.user_id)
        .eq('is_active', true)
        .is('classes.archived_at', null)
        .limit(200);
      fail(error);
      return data.map((row) => row.classes);
    },
    async classSave(profile, input) {
      requireAdmin(profile);
      const name = text(input.name, 100, 'Tên lớp');
      const values = { name };
      if (!input.classId) values.created_by = profile.user_id;
      const query = input.classId
        ? db.from('classes').update(values).eq('class_id', uuid(input.classId))
        : db.from('classes').insert(values);
      const { data, error } = await query.select().single();
      fail(error);
      return data;
    },
    async classArchive(profile, input) {
      requireAdmin(profile);
      if (typeof input.archived !== 'boolean') throw new ApiError(400, 'Trạng thái chưa hợp lệ.');
      const { data, error } = await db
        .from('classes')
        .update({ archived_at: input.archived ? new Date().toISOString() : null })
        .eq('class_id', uuid(input.classId))
        .select()
        .single();
      fail(error);
      return data;
    },
    // One validation query and one atomic upsert for the whole selection.
    async classMembers(profile, input) {
      requireAdmin(profile);
      const ids = input.userIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 200 ||
        new Set(ids).size !== ids.length ||
        typeof input.active !== 'boolean'
      )
        throw new ApiError(400, 'Chọn từ 1 đến 200 học sinh, không trùng nhau.');
      ids.forEach(uuid);
      await access(profile, input.classId, true);
      let query = db.from('profiles').select('user_id').in('user_id', ids).eq('role', 'student');
      if (input.active) query = query.eq('is_active', true);
      const students = await query;
      fail(students.error);
      if (students.data.length !== ids.length)
        throw new ApiError(
          400,
          'Danh sách có tài khoản không hợp lệ hoặc đã khóa. Chưa thay đổi thành viên nào.',
        );
      const { data, error } = await db
        .from('class_members')
        .upsert(
          ids.map((userId) => ({
            class_id: input.classId,
            user_id: userId,
            is_active: input.active,
          })),
          { onConflict: 'class_id,user_id' },
        )
        .select('user_id,is_active');
      fail(error);
      return {
        classId: input.classId,
        active: input.active,
        userIds: data.map((row) => row.user_id),
      };
    },
    async classRoster(profile, input) {
      await access(profile, input.classId, true);
      const { data, error } = await db
        .from('class_members')
        .select('user_id')
        .eq('class_id', input.classId)
        .eq('is_active', true)
        .limit(1000);
      fail(error);
      return data.map((row) => row.user_id);
    },
    async classMember(profile, input) {
      await access(profile, input.classId, true);
      uuid(input.userId);
      if (typeof input.active !== 'boolean') throw new ApiError(400, 'Trạng thái chưa hợp lệ.');
      const student = await db
        .from('profiles')
        .select('user_id')
        .eq('user_id', input.userId)
        .eq('role', 'student')
        .maybeSingle();
      fail(student.error);
      if (!student.data) throw new ApiError(400, 'Chọn một tài khoản học sinh.');
      const { data, error } = await db
        .from('class_members')
        .upsert(
          { class_id: input.classId, user_id: input.userId, is_active: input.active },
          { onConflict: 'class_id,user_id' },
        )
        .select()
        .single();
      fail(error);
      return data;
    },
    async classPosts(profile, input) {
      await access(profile, input.classId);
      const posts = await postsQuery(input);
      fail(posts.error);
      return { posts: posts.data };
    },
    async questClassReport(profile, input) {
      await access(profile, input.classId, true);
      // Embed the bounded per-student rows to avoid N+1 reads and REST's top-level row cap.
      const result = await db
        .from('class_members')
        .select(
          'user_id,profiles!inner(full_name,is_active,player_lesson_progress(lesson_id,completed,best_stars,last_accuracy,correct_count,wrong_count,total_active_seconds,weak_keys,weak_rules,last_played_at,games(game_code)))',
        )
        .eq('class_id', input.classId)
        .eq('is_active', true)
        .eq('profiles.is_active', true)
        .limit(300);
      fail(result.error);
      return {
        students: result.data.map((member) => {
          const rows = (member.profiles.player_lesson_progress || []).filter(
            (row) => row.games?.game_code === QUEST_CODE && findLesson(row.lesson_id),
          );
          const summary = learningSummary(rows);
          const weakest = (key) =>
            Object.entries(
              rows.reduce((all, row) => {
                for (const [id, count] of Object.entries(row[key] || {}))
                  all[id] = (all[id] || 0) + count;
                return all;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([key]) => key);
          return {
            user_id: member.user_id,
            name: member.profiles.full_name,
            completed: summary.completed,
            accuracy: summary.accuracy,
            seconds: summary.seconds,
            worlds: summary.worlds,
            weakKeys: weakest('weak_keys'),
            weakRules: weakest('weak_rules'),
            lastPlayed: summary.recent[0]?.last_played_at || null,
          };
        }),
      };
    },
    async classroom(profile, input) {
      const classroom = await access(profile, input.classId);
      const [members, posts] = await Promise.all([
        db
          .from('class_members')
          .select(
            'user_id,joined_at,profiles!inner(full_name,is_active,student_avatars(animal,accessory,color),player_game_stats(total_active_seconds,best_score:best_play->score,games(game_code)),player_lesson_progress(lesson_id,best_stars,games(game_code)))',
          )
          .eq('class_id', input.classId)
          .eq('is_active', true)
          .eq('profiles.is_active', true)
          .order('joined_at')
          .limit(300),
        postsQuery(input),
      ]);
      fail(members.error);
      fail(posts.error);
      const visibleMembers = classMembersView(members.data);
      return {
        classroom,
        members: visibleMembers,
        achievements: classTop(visibleMembers),
        posts: posts.data,
      };
    },
    async avatar(profile) {
      const { data, error } = await db
        .from('student_avatars')
        .select('animal,accessory,color')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      fail(error);
      return normalizeAvatar(data);
    },
    async avatarSave(profile, input) {
      const { animal, accessory, color } = input;
      if (
        !CHARACTERS.some((x) => x.id === animal) ||
        !ACCESSORIES.some((x) => x[0] === accessory) ||
        !COLORS.includes(color)
      )
        throw new ApiError(400, 'Nhân vật chưa hợp lệ.');
      // Identity is taken exclusively from the authenticated session, never the request.
      const { data, error } = await db
        .from('student_avatars')
        .upsert({ user_id: profile.user_id, animal, accessory, color })
        .select()
        .single();
      fail(error);
      return data;
    },
    async classUpload(profile, input) {
      await access(profile, input.classId, true);
      const file = validateFile(input),
        id = randomUUID(),
        path = `${input.classId}/${id}${input.preview === true && file.mime.startsWith('image/') ? '.previewable' : ''}.${file.extension}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      fail(error, 'Chưa chuẩn bị được tải file.');
      let previewSignedUrl;
      if (path.includes('.previewable.')) {
        const preview = await db.storage.from(BUCKET).createSignedUploadUrl(path + '.webp');
        fail(preview.error, 'Chưa chuẩn bị được ảnh xem trước.');
        previewSignedUrl = preview.data.signedUrl;
      }
      const saved = await db.from('class_attachments').insert({
        attachment_id: id,
        class_id: input.classId,
        uploaded_by: profile.user_id,
        storage_path: path,
        name: file.name,
        mime_type: file.mime,
        size_bytes: file.size,
      });
      fail(saved.error);
      return { attachmentId: id, signedUrl: data.signedUrl, previewSignedUrl };
    },
    async classPost(profile, input) {
      await access(profile, input.classId, true);
      const files = input.files || [];
      if (!Array.isArray(files) || files.length > 3 || new Set(files).size !== files.length)
        throw new ApiError(400, 'Mỗi bài tối đa 3 file.');
      files.forEach(uuid);
      const { data, error } = await db.rpc('tipy_publish_post', {
        p_admin: profile.user_id,
        p_class: input.classId,
        p_title: text(input.title, 160, 'Tiêu đề'),
        p_body: text(input.body, 10000, 'Nội dung', false),
        p_link: safeLink(input.link),
        p_files: files,
      });
      fail(error, 'Chưa đăng được bài. Kiểm tra file đã tải xong và thử lại.');
      return { post_id: data };
    },
    async postArchive(profile, input) {
      requireAdmin(profile);
      const { data, error } = await db
        .from('class_posts')
        .update({ archived_at: new Date().toISOString() })
        .eq('post_id', uuid(input.postId))
        .select('post_id')
        .single();
      fail(error);
      return data;
    },
    async classFile(profile, input) {
      const { data, error } = await db
        .from('class_attachments')
        .select('*,class_posts!inner(archived_at)')
        .eq('attachment_id', uuid(input.attachmentId))
        .not('post_id', 'is', null)
        .single();
      fail(error, 'Không tìm thấy tài liệu.');
      await access(profile, data.class_id);
      if (data.class_posts.archived_at) throw new ApiError(404, 'Bài đã được gỡ.');
      const [signed, preview] = await Promise.all([
        db.storage.from(BUCKET).createSignedUrl(data.storage_path, 300, {
          download: data.mime_type.startsWith('image/') ? false : data.name,
        }),
        data.storage_path.includes('.previewable.') && data.mime_type.startsWith('image/')
          ? db.storage.from(BUCKET).createSignedUrl(data.storage_path + '.webp', 300)
          : null,
      ]);
      fail(signed.error);
      return {
        url: signed.data.signedUrl,
        previewUrl: preview?.error ? undefined : preview?.data?.signedUrl,
        mime: data.mime_type,
      };
    },
  };
}
