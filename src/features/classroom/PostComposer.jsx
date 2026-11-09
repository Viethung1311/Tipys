import { useState } from 'react';
import { api } from '../../game/backend.js';
import { FILE_TYPES, MAX_FILE_BYTES } from './constants.js';
import Loading from '../../components/Loading.jsx';
/** Upload directly to private Storage using a server-authorized, scoped URL. */
export default function PostComposer({ classId, onPosted }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form),
      files = [...form.elements.files.files];
    setBusy(true);
    setError('');
    try {
      if (files.length > 3) throw Error('Mỗi bài tối đa 3 file.');
      const ids = [];
      for (const file of files) {
        const mime = FILE_TYPES[file.name.split('.').pop().toLowerCase()];
        if (!mime || file.size < 1 || file.size > MAX_FILE_BYTES)
          throw Error('Chọn file hợp lệ tối đa 5 MB.');
        const signed = (
          await api('class_upload', { classId, name: file.name, mime, size: file.size })
        ).data;
        const upload = new FormData();
        upload.append('cacheControl', '3600');
        upload.append('', new File([file], file.name, { type: mime }));
        const response = await fetch(signed.signedUrl, { method: 'PUT', body: upload });
        if (!response.ok) throw Error('Tải file chưa xong. Bạn thử lại nhé.');
        ids.push(signed.attachmentId);
      }
      await api('class_post', {
        classId,
        title: values.get('title'),
        body: values.get('body'),
        link: values.get('link'),
        files: ids,
      });
      form.reset();
      await onPosted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel class-composer">
      <h2>✏️ Gửi bài cho lớp</h2>
      <form className="account-form" onSubmit={submit}>
        <label>
          Tiêu đề
          <input name="title" required maxLength={160} />
        </label>
        <label>
          Nội dung
          <textarea name="body" rows={4} maxLength={10000} />
        </label>
        <label>
          Link bài học
          <input name="link" type="url" placeholder="https://…" maxLength={2000} />
        </label>
        <label>
          Ảnh hoặc tài liệu
          <input
            name="files"
            type="file"
            multiple
            accept={Object.keys(FILE_TYPES)
              .map((x) => '.' + x)
              .join(',')}
          />
        </label>
        <p className="muted">
          Tối đa 3 file/bài, 5 MB/file. Ảnh, PDF, TXT, Word, Excel, PowerPoint.
        </p>
        <button className="primary" disabled={busy}>
          Đăng bài cho lớp
        </button>
      </form>
      {busy && <Loading label="Đang tải file và đăng bài…" />}
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
    </section>
  );
}
