import { useState } from 'react';
import { api } from '../../game/backend.js';
/** Fetch signed links on demand: private class files are never public bucket URLs. */
export default function Attachment({ file }) {
  const [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const open = async () => {
    setBusy(true);
    setError('');
    try {
      setUrl((await api('class_file', undefined, { attachmentId: file.attachment_id })).url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="class-attachment">
      <button className="secondary" disabled={busy} onClick={open}>
        {busy ? 'Đang mở…' : `📎 ${file.name}`} · {Math.ceil(file.size_bytes / 1024)} KB
      </button>
      {url && (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Mở / tải tài liệu ↗
          </a>
          {file.mime_type.startsWith('image/') && (
            <img src={url} alt={file.name} loading="lazy" decoding="async" />
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
