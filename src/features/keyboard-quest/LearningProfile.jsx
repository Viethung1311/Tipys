import Avatar from '../classroom/Avatar.jsx';
import { findLesson, WORLDS } from './curriculum.js';
import { learningSummary } from './progress.js';
import { practiceTime } from '../../game/results.js';
import TipyButton from '../../components/TipyButton.jsx';
import { Printer } from 'lucide-react';
export default function LearningProfile({ progress, avatar, user }) {
  const summary = learningSummary(progress);
  return (
    <section className="panel quest-profile">
      <h2>Hồ sơ học tập</h2>
      <div className="quest-companion">
        <Avatar value={avatar || {}} name="bạn" />
        <div>
          <h3>Bạn đồng hành</h3>
          <p>
            {summary.stars >= 60
              ? 'Nhà thám hiểm tài ba'
              : summary.stars >= 15
                ? 'Người bạn chăm học'
                : 'Cùng nhau bắt đầu nhé!'}
          </p>
          <p>Đổi nhân vật tại Tài khoản → Nhân vật.</p>
        </div>
      </div>
      <div className="quest-metrics">
        <p>
          <b>{summary.stars} ★</b> sao tốt nhất
        </p>
        {user && (
          <p>
            <b>{summary.awardedStars} ★</b> sao bài học đã nhận
          </p>
        )}
        <p>
          <b>{practiceTime(summary.seconds)}</b> thời gian luyện
        </p>
        <p>
          <b>{summary.accuracy === null ? '—' : summary.accuracy + '%'}</b> chính xác tổng hợp
        </p>
      </div>
      {summary.completed === 30 && (
        <section className="quest-certificate">
          <h3>Chứng nhận chinh phục bàn phím</h3>
          <p>🌟 Chúc mừng {user?.full_name || 'bạn'} đã hoàn thành 30 bài học!</p>
          <p>Zunimo · Học vui mỗi ngày</p>
          <TipyButton icon={Printer} emphasis="secondary" onClick={() => window.print()}>
            In chứng nhận
          </TipyButton>
        </section>
      )}
      <h3>Huy hiệu của mình</h3>
      <ul className="quest-badges">
        {summary.badges.map((badge) => (
          <li key={badge.id} className={badge.earned ? 'earned' : ''}>
            <span aria-hidden="true">{badge.icon}</span>
            <b>{badge.name}</b>
            <span>{badge.earned ? 'Đã nhận' : 'Đang khám phá'}</span>
          </li>
        ))}
      </ul>
      <p>Phím cần ôn: {summary.weakKeys.join(', ') || 'Chưa ghi nhận lỗi vị trí phím.'}</p>
      <p>Telex cần ôn: {summary.weakRules.join(', ') || 'Chưa ghi nhận lỗi dấu.'}</p>

      <>
        <h3>Tiến độ 5 thế giới</h3>
        {summary.worlds.map((world) => (
          <div className="quest-world-progress" key={world.id}>
            <label htmlFor={`world-progress-${world.id}`}>
              {WORLDS.find((item) => item.id === world.id).title} · {world.done}/{world.total}
            </label>
            <progress id={`world-progress-${world.id}`} value={world.done} max={world.total} />
          </div>
        ))}
        <h3>Bài luyện gần đây</h3>
        {summary.recent.length ? (
          <ul>
            {summary.recent.map((row) => (
              <li key={row.lesson_id}>
                {findLesson(row.lesson_id).title} · {row.last_accuracy}% ·{' '}
                {new Date(row.last_played_at).toLocaleDateString('vi-VN')}
              </li>
            ))}
          </ul>
        ) : (
          <p>Hoàn thành một bài để thấy tiến bộ của mình nhé.</p>
        )}
      </>
    </section>
  );
}
