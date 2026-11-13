import { useEffect, useState } from 'react';
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
  useEffect(() => {
    const refresh = (event) => {
      if (event?.detail?.classIds && !event.detail.classIds.includes(classId)) return;
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
  const rows = (data?.[tab] || []).filter(
    (row) => tab === 'weekly' || Number(row.stars) > 0 || Number(row.completed) > 0,
  );
  return (
    <aside className="panel class-achievements" aria-labelledby="class-top-heading">
      <h2 id="class-top-heading">Top thành tích</h2>
      <div role="tablist" aria-label="Bảng thành tích lớp" className="class-top-tabs">
        {[
          ['lessons', '1. Sao của bạn'],
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
          {tab === 'weekly' && (
            <div className="week-controls">
              <button
                aria-label="Tuần trước"
                onClick={() => setWeek(shiftWeek(data.weekStart, -7))}
              >
                <ChevronLeft />
              </button>
              <span>{weekLabel(data.weekStart)}</span>
              <button
                aria-label="Tuần sau"
                disabled={data.weekStart >= data.currentWeek}
                onClick={() => setWeek(shiftWeek(data.weekStart, 7))}
              >
                <ChevronRight />
              </button>
            </div>
          )}
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
