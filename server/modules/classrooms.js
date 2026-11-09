/** Classroom service: server-side authorization precedes every read/write/sign. */
import { randomUUID } from 'node:crypto';
import { ApiError, requireAdmin, fail } from '../errors.js';
import {
  ANIMALS,
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
  return {
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
    async classroom(profile, input) {
      const classroom = await access(profile, input.classId);
      const [members, posts] = await Promise.all([
        db
          .from('class_members')
          .select(
            'user_id,joined_at,profiles!inner(full_name,is_active,student_avatars(animal,accessory,color))',
          )
          .eq('class_id', input.classId)
          .eq('is_active', true)
          .eq('profiles.is_active', true)
          .order('joined_at')
          .limit(300),
        db
          .from('class_posts')
          .select(
            'post_id,title,body,link,created_at,class_attachments(attachment_id,name,mime_type,size_bytes)',
          )
          .eq('class_id', input.classId)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .range(input.offset || 0, (input.offset || 0) + 19),
      ]);
      fail(members.error);
      fail(posts.error);
      return {
        classroom,
        members: members.data.map((m) => ({
          user_id: m.user_id,
          name: m.profiles.full_name,
          avatar: m.profiles.student_avatars || { animal: 'rat', accessory: 'none', color: 'sun' },
        })),
        posts: posts.data,
      };
    },
    async avatarSave(profile, input) {
      const { animal, accessory, color } = input;
      if (
        !ANIMALS.some((x) => x[0] === animal) ||
        !ACCESSORIES.some((x) => x[0] === accessory) ||
        !COLORS.includes(color)
      )
        throw new ApiError(400, 'Nhân vật chưa hợp lệ.');
      await access(profile, input.classId);
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
        path = `${input.classId}/${id}.${file.extension}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      fail(error, 'Chưa chuẩn bị được tải file.');
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
      return { attachmentId: id, signedUrl: data.signedUrl };
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
      const signed = await db.storage.from(BUCKET).createSignedUrl(data.storage_path, 300, {
        download: data.mime_type.startsWith('image/') ? false : data.name,
      });
      fail(signed.error);
      return { url: signed.data.signedUrl, mime: data.mime_type };
    },
  };
}
