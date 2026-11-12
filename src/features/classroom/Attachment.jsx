import { useState } from 'react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import { Paperclip } from 'lucide-react';
/** Fetch signed links on demand: private class files are never public bucket URLs. */
export default function Attachment({ file }) {
  const [url, setUrl] = useState(''),
    [previewUrl, setPreviewUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const open = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api('class_file', undefined, { attachmentId: file.attachment_id });
      setUrl(data.url);
      setPreviewUrl(data.previewUrl || data.url);
    } catch (e) {
      setUrl('');
      setPreviewUrl('');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="class-attachment">
      <TipyButton emphasis="secondary" icon={Paperclip} disabled={busy} onClick={open}>
        {busy ? 'Đang mở…' : `📎 ${file.name}`} · {Math.ceil(file.size_bytes / 1024)} KB
      </TipyButton>
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
