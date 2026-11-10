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
        const result = await api('points');
        if (!Number.isFinite(result.points)) throw Error('Invalid points');
        if (live && request === latest) {
          setValue(result.points);
          setError(false);
        }
      } catch {
        if (live && request === latest) setError(true);
      }
    };
    refresh();
    window.addEventListener('tipy-points-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      window.removeEventListener('tipy-points-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.user_id, revision]);
  if (!user) return null;
  return (
    <span
      className="account-points"
      aria-live="polite"
      title="Điểm cao nhất mỗi game + 10 điểm cho mỗi sao tốt nhất của bài học"
    >
      <Star size={20} aria-hidden="true" />
      {error ? (
        <button type="button" onClick={() => setRevision((old) => old + 1)}>
          Tải lại điểm
        </button>
      ) : value === null ? (
        'Đang tải điểm…'
      ) : (
        `Điểm chung: ${value.toLocaleString('vi-VN')}`
      )}
    </span>
  );
}
