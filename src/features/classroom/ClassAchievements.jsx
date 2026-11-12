import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
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
    let live = true;
    setData(null);
    setError('');
    api('class_stars', undefined, { classId, ...(week ? { week } : {}) })
      .then((value) => {
        if (live) {
          setData(value);
          window.dispatchEvent(new Event('tipy-points-changed'));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [classId, week, revision]);
  const rows = data?.[tab] || [];
  return (
    <aside className="panel class-achievements" aria-labelledby="class-top-heading">
      <h2 id="class-top-heading">Top thành tích</h2>
      <div role="tablist" aria-label="Bảng thành tích lớp" className="class-top-tabs">
        {[
          ['lessons', '1. Vượt ải'],
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
          {tab === 'weekly' ? (
            <>
              <div className="week-controls">
                <button
                  aria-label="Tuần trước"
                  onClick={() => setWeek(shiftWeek(data.weekStart, -7))}
                >
                  <ChevronLeft />
                </button>
                <span>
                  {data.weekStart} → {data.weekEnd}
                  <small>Thứ Hai 00:00 · Asia/Ho_Chi_Minh</small>
                </span>
                <button
                  aria-label="Tuần sau"
                  disabled={data.weekStart >= data.currentWeek}
                  onClick={() => setWeek(shiftWeek(data.weekStart, 7))}
                >
                  <ChevronRight />
                </button>
              </div>
              <p>{data.rule} · Kết quả tốt nhất trong tuần</p>
              <p>
                {data.closure?.winnerId
                  ? data.weekly?.some((row) => row.user_id === data.closure.winnerId)
                    ? 'Đã chốt · Người nhận thưởng có nhãn Đã thưởng 5 sao'
                    : 'Đã chốt · Người nhận 5 sao không còn trong danh sách lớp'
                  : data.closure
                    ? 'Đã chốt · Không có bạn đủ điều kiện nhận thưởng'
                    : data.weekStart < data.currentWeek
                      ? rows.length
                        ? 'Đang chờ chốt thưởng'
                        : 'Tuần này không có lượt hợp lệ, không thưởng'
                      : 'Tuần đang diễn ra · Hạng nhất sau khi chốt nhận 5 sao'}
              </p>
            </>
          ) : (
            <p>Sao bài học đã nhận, không gồm thưởng Chữ rơi.</p>
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
                  <div>
                    <b>
                      {row.name}
                      {row.user_id === user.user_id ? ' · Bạn' : ''}
                    </b>
                    <small>
                      {tab === 'lessons'
                        ? `${row.completed} bài hoàn thành`
                        : `Chính xác ${Number(row.accuracy).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`}
                    </small>
                    {data.closure?.winnerId === row.user_id && tab === 'weekly' && (
                      <small>Đã thưởng 5 sao</small>
                    )}
                  </div>
                  <strong>
                    {Number(tab === 'lessons' ? row.stars : row.score).toLocaleString('vi-VN')}
                    <small>{tab === 'lessons' ? 'sao' : 'điểm'}</small>
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="class-top-empty">
              {tab === 'lessons'
                ? 'Chưa có thành viên hoặc sao bài học.'
                : 'Chưa có lượt Chữ rơi · Khó hợp lệ trong tuần này.'}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
