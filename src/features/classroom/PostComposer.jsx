import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import { imagePreview } from './image.js';
import { FILE_TYPES, MAX_FILE_BYTES } from './constants.js';
import TipyButton from '../../components/TipyButton.jsx';
import { Send } from 'lucide-react';

const EMPTY = { title: '', body: '', link: '' };
function previewLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
/** Admin-only editor (parent + API enforce role). Preview stays local until Publish. */
export default function PostComposer({ classId, onPosted }) {
  const [fields, setFields] = useState(EMPTY),
    [files, setFiles] = useState([]),
    [previews, setPreviews] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => {
    const images = files
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        name: file.name,
        url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null,
      }));
    setPreviews(images);
    return () => {
      for (const image of images) if (image.url) URL.revokeObjectURL(image.url);
    };
  }, [files]);
  const change = (e) => setFields((previous) => ({ ...previous, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    const form = e.currentTarget,
      snapshot = { ...fields },
      uploads = [...files];
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      if (uploads.length > 3) throw Error('Mỗi bài tối đa 3 file.');
      for (const file of uploads) {
        const mime = FILE_TYPES[file.name.split('.').pop().toLowerCase()];
        if (!mime || file.size < 1 || file.size > MAX_FILE_BYTES)
          throw Error('Chọn file hợp lệ tối đa 5 MB.');
      }
      const results = await Promise.allSettled(
        uploads.map(async (file) => {
          const mime = FILE_TYPES[file.name.split('.').pop().toLowerCase()];
          const preview = await imagePreview(file);
          const signed = (
            await api('class_upload', {
              classId,
              name: file.name,
              mime,
              size: file.size,
              preview: Boolean(preview),
            })
          ).data;
          const put = async (url, value, type) => {
            const upload = new FormData();
            upload.append('cacheControl', '3600');
            upload.append('', new File([value], value.name, { type }));
            const response = await fetch(url, { method: 'PUT', body: upload });
            if (!response.ok) throw Error('Tải file chưa xong. Bạn thử lại nhé.');
          };
          await put(signed.signedUrl, file, mime);
          if (preview) await put(signed.previewSignedUrl, preview, 'image/webp');
          return signed.attachmentId;
        }),
      );
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
      const ids = results.map((result) => result.value);
      await api('class_post', { classId, ...snapshot, files: ids });
      form.reset();
      setFields(EMPTY);
      setFiles([]);
      await onPosted();
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const link = previewLink(fields.link);
  return (
    <section className="panel class-composer">
      <div className="composer-heading">
        <div>
          <span className="eyebrow">GÓC GIÁO VIÊN</span>
          <h2>✏️ Gửi bài cho lớp</h2>
        </div>
        <span className="teacher-only-badge">Chỉ giáo viên</span>
      </div>
      <div className="composer-layout">
        <form className="account-form composer-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Tiêu đề
              <input name="title" required maxLength={160} value={fields.title} onChange={change} />
            </label>
            <label>
              Nội dung
              <textarea
                name="body"
                rows={5}
                maxLength={10000}
                value={fields.body}
                onChange={change}
              />
            </label>
            <label>
              Link bài học
              <input
                name="link"
                type="url"
                placeholder="https://…"
                maxLength={2000}
                value={fields.link}
                onChange={change}
              />
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
                onChange={(e) => setFiles([...e.target.files])}
              />
            </label>
            <p className="muted">
              Tối đa 3 file/bài, 5 MB/file. Ảnh, PDF, TXT, Word, Excel, PowerPoint.
            </p>
            <TipyButton
              className="full"
              type="submit"
              icon={Send}
              loading={busy}
              loadingLabel="Đang đăng bài…"
            >
              {busy ? 'Đang đăng bài…' : 'Đăng bài cho lớp'}
            </TipyButton>
          </fieldset>
        </form>
        <aside className="composer-preview" aria-label="Xem trước bài đăng">
          <span className="preview-eyebrow">XEM TRƯỚC BÀI ĐĂNG</span>
          <article className="preview-paper">
            <small>👩‍🏫 Giáo viên TIPY · Bản nháp</small>
            <h3>{fields.title || 'Tiêu đề bài học'}</h3>
            <p>{fields.body || 'Nội dung bài học sẽ hiện ở đây khi bạn nhập.'}</p>
            {fields.link &&
              (link ? (
                <a href={link} target="_blank" rel="noopener noreferrer">
                  🔗 {fields.link}
                </a>
              ) : (
                <span className="preview-invalid">Nhập link http hoặc https để xem trước.</span>
              ))}
            {previews.map((image, index) => (
              <div key={index} className="preview-image">
                {image.url ? (
                  <img src={image.url} alt={`Xem trước ${image.name}`} />
                ) : (
                  <span>🖼 {image.name}</span>
                )}
              </div>
            ))}
            {files
              .filter((file) => !file.type.startsWith('image/'))
              .map((file, index) => (
                <div className="preview-file" key={index}>
                  📎 {file.name}
                </div>
              ))}
            {!files.length && (
              <div className="preview-placeholder">
                <span aria-hidden="true">🖼</span>
                <p>Ảnh và tài liệu bạn chọn sẽ xuất hiện tại đây.</p>
              </div>
            )}
          </article>
          <small>Học sinh chỉ thấy bài sau khi giáo viên bấm Đăng.</small>
        </aside>
      </div>
      {busy && (
        <p role="status" className="roster-pending">
          Đang tải file và đăng bài…
        </p>
      )}
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
    </section>
  );
}
