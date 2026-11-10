import { useState } from 'react';
import { api } from '../../game/backend.js';
/** Fetch signed links on demand: private class files are never public bucket URLs. */
export default function Attachment({ file }) {
  const [url, setUrl] = useState(''),
    [previewUrl, setPreviewUrl] = useState(''),
    [expiresAt, setExpiresAt] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const open = async () => {
    if (url && Date.now() < expiresAt) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('class_file', undefined, { attachmentId: file.attachment_id });
      setUrl(data.url);
      setPreviewUrl(data.previewUrl || data.url);
      setExpiresAt(Date.now() + 240000);
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
            <img
              src={previewUrl}
              alt={file.name}
              loading="lazy"
              decoding="async"
              onError={() => {
                if (previewUrl !== url) setPreviewUrl(url);
              }}
            />
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
