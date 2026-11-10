import Avatar from './Avatar.jsx';
import { practiceTime } from '../../game/results.js';
/** Class-scoped achievements; never fetch a global student ranking. */
export default function ClassAchievements({ rows = [], user, avatarOverride }) {
  return (
    <aside className="panel class-achievements" aria-labelledby="class-top-heading">
      <span className="eyebrow">MỖI NGÀY MỘT TIẾN BỘ</span>
      <h2 id="class-top-heading">🏆 Top thành tích</h2>
      <p>Điểm chung của các bạn trong lớp.</p>
      {rows.length ? (
        <ol className="class-top-list">
          {rows.map((row) => (
            <li key={row.user_id} className={row.user_id === user.user_id ? 'is-you' : ''}>
              <span className="class-rank">
                {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
              </span>
              <Avatar
                value={row.user_id === user.user_id ? avatarOverride || row.avatar : row.avatar}
                name={row.name}
              />
              <div>
                <b>
                  {row.name}
                  {row.user_id === user.user_id ? ' · Bạn' : ''}
                </b>
                <small>Luyện {practiceTime(row.total_active_seconds)}</small>
              </div>
              <strong>
                {row.best_score.toLocaleString('vi-VN')}
                <small>điểm</small>
              </strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="class-top-empty">
          <span aria-hidden="true">🌱</span>
          <p>Cùng hoàn thành lượt luyện đầu tiên để ghi dấu thành tích của lớp nhé!</p>
        </div>
      )}
    </aside>
  );
}
