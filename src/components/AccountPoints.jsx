import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../game/backend.js';
import '../styles/account-points.css';
export default function AccountPoints({ user }) {
  const [value, setValue] = useState(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true,
      latest = 0;
    setValue(null);
    setError(false);
    const refresh = async () => {
      const request = ++latest;
      try {
        const result = await api('stars');
        if (!Number.isFinite(result.stars)) throw Error('Invalid stars');
        if (live && request === latest) {
          setValue(result.stars);
          setError(false);
        }
      } catch {
        if (live && request === latest) setError(true);
      }
    };
    refresh();
    window.addEventListener('tipy-points-changed', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
    return () => {
      live = false;
      window.removeEventListener('tipy-points-changed', refresh);
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [user?.user_id, revision]);
  if (!user) return null;
  return (
    <span
      className="account-points"
      aria-live="polite"
      title="Sao thưởng bài học lần đầu và thưởng Chữ rơi theo tuần"
    >
      <Star size={20} aria-hidden="true" />
      {error ? (
        <button type="button" onClick={() => setRevision((old) => old + 1)}>
          Tải lại sao
        </button>
      ) : value === null ? (
        'Đang tải sao…'
      ) : (
        `Sao của bạn: ${value.toLocaleString('vi-VN')}`
      )}
    </span>
  );
}
