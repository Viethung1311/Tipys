import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { weekLabel } from '../../game/week-label.js';
const shiftWeek = (date, days) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export default function ClassAchievements({ classId, user, avatarOverride }) {
  const [tab, setTab] = useState('lessons'),
    [week, setWeek] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const cache = useRef(new Map());
  const receivedAt = useRef(0);
  useEffect(() => {
    const refresh = (event) => {
      if (event?.detail?.classIds && !event.detail.classIds.includes(classId)) return;
      cache.current.clear();
      setRevision((n) => n + 1);
    };
    const visible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('tipy-points-changed', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('tipy-points-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [classId]);
  useEffect(() => {
    let live = true;
    const key = `${classId}:${week || 'current'}`;
    const cached = cache.current.get(key);
    if (cached && performance.now() - cached.at < 30000) {
      receivedAt.current = cached.at;
      setData(cached.value);
      setError('');
      return;
    }
    setData(null);
    setError('');
    api('class_stars', undefined, { classId, ...(week ? { week } : {}) })
      .then((value) => {
        if (
          !Array.isArray(value.lessons) ||
          !Array.isArray(value.weekly) ||
          !Number.isInteger(value.memberCount)
        )
          throw Error('Chưa tải được thành tích. Bạn thử lại nhé.');
        if (live) {
          receivedAt.current = performance.now();
          if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value);
          cache.current.set(key, { value, at: receivedAt.current });
          setData(value);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [classId, week, revision]);
  useEffect(() => {
    if (!data?.nextWeekAt || !data.serverNow) return;
    const remaining =
      Date.parse(data.nextWeekAt) -
      Date.parse(data.serverNow) -
      (performance.now() - receivedAt.current);
    if (!Number.isFinite(remaining)) return;
    const timer = setTimeout(
      () => {
        cache.current.clear();
        setRevision((value) => value + 1);
      },
      Math.max(0, remaining) + 50,
    );
    return () => clearTimeout(timer);
  }, [data, classId, week]);
  const rows = data?.[tab] || [];
  return (
    <aside className="panel class-achievements" aria-labelledby="class-top-heading">
      <h2 id="class-top-heading">Top thành tích</h2>
      <div role="tablist" aria-label="Bảng thành tích lớp" className="class-top-tabs">
        {[
          ['lessons', 'Sao trong lớp tuần này'],
          ['weekly', '2. Chữ rơi · Khó'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              const next = id === 'lessons' ? 'weekly' : 'lessons';
              setTab(next);
              event.currentTarget.parentElement
                .querySelectorAll('button')
                [next === 'lessons' ? 0 : 1].focus();
            }}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert">
          {error}{' '}
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            onClick={() => setRevision((n) => n + 1)}
          >
            Thử lại
          </TipyButton>
        </p>
      ) : !data ? (
        <p role="status">Đang tải thành tích…</p>
      ) : (
        <>
          <div className="week-controls">
            <button aria-label="Tuần trước" onClick={() => setWeek(shiftWeek(data.weekStart, -7))}>
              <ChevronLeft />
            </button>
            <span>{weekLabel(data.weekStart)}</span>
            <button
              aria-label="Tuần sau"
              disabled={data.weekStart >= data.currentWeek}
              onClick={() => {
                const next = shiftWeek(data.weekStart, 7);
                setWeek(next === data.currentWeek ? null : next);
              }}
            >
              <ChevronRight />
            </button>
          </div>
          {rows.length ? (
            <ol className="class-top-list">
              {rows.map((row, index) => (
                <li key={row.user_id} className={row.user_id === user.user_id ? 'is-you' : ''}>
                  <span className="class-rank">{index + 1}</span>
                  <Avatar
                    value={
                      row.user_id === user.user_id
                        ? avatarOverride || { animal: row.animal }
                        : { animal: row.animal }
                    }
                    name={row.name}
                  />
                  <b>
                    {row.name}
                    {row.user_id === user.user_id ? ' · Bạn' : ''}
                  </b>
                  <strong>
                    {Number(tab === 'lessons' ? row.stars : row.score).toLocaleString('vi-VN')}
                    <small>{tab === 'lessons' ? 'sao' : 'điểm'}</small>
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="class-top-empty">
              {data.memberCount === 0 ? 'Chưa có học sinh' : 'Chưa có thành tích'}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
