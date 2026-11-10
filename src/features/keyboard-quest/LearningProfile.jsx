import Avatar from '../classroom/Avatar.jsx';
import { findLesson, WORLDS } from './curriculum.js';
import { learningSummary } from './progress.js';
import { practiceTime } from '../../game/results.js';
import TipyButton from '../../components/TipyButton.jsx';
import { Printer, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../game/backend.js';
export default function LearningProfile({
  progress,
  avatar,
  collection = false,
  user,
  onAvatarChanged,
}) {
  const summary = learningSummary(progress);
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState('');
  const wear = async (accessory) => {
    setBusy(accessory);
    setMessage('');
    try {
      const value = { animal: avatar?.animal || 'rat', color: avatar?.color || 'sun', accessory };
      const saved = user ? (await api('avatar_save', value)).data : value;
      onAvatarChanged(saved);
      setMessage(
        user ? 'Đã lưu nhân vật vào tài khoản.' : 'Đã đổi nhân vật trong lần chơi thử này.',
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="panel quest-profile">
      <h2>{collection ? 'Kho báu của mình' : 'Hồ sơ học tập'}</h2>
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
        <p>
          <b>{summary.coins}</b> xu đã kiếm
        </p>
        <p>
          <b>{practiceTime(summary.seconds)}</b> thời gian luyện
        </p>
        <p>
          <b>{summary.accuracy === null ? '—' : summary.accuracy + '%'}</b> chính xác tổng hợp
        </p>
      </div>
      <p>
        Xu được tính từ sao tốt nhất. Luyện lại không cộng xu trùng; đủ mốc sao sẽ tự mở sticker.
      </p>
      {summary.completed === 30 && (
        <section className="quest-certificate">
          <h3>Chứng nhận chinh phục bàn phím</h3>
          <p>🌟 Chúc mừng {user?.full_name || 'bạn'} đã hoàn thành 30 bài học!</p>
          <p>TIPY STEM · Học vui mỗi ngày</p>
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
      {collection ? (
        <>
          <h3>Bộ sưu tập sticker</h3>
          <ul className="quest-badges">
            {[
              ['⭐', 'Ngôi sao', 3, 'star'],
              ['🌸', 'Bông hoa', 15, 'flower'],
              ['📘', 'Quyển sách', 30, 'book'],
              ['👑', 'Vương miện', 60, 'crown'],
            ].map(([icon, name, stars, accessory]) => (
              <li key={name} className={summary.stars >= stars ? 'earned' : ''}>
                <span aria-hidden="true">{icon}</span>
                <b>{name}</b>
                <span>{summary.stars >= stars ? 'Đã mở' : `Cần ${stars} sao`}</span>
                <TipyButton
                  emphasis="secondary"
                  icon={Sparkles}
                  disabled={summary.stars < stars || Boolean(busy)}
                  loading={busy === accessory}
                  onClick={() => wear(accessory)}
                >
                  {avatar?.accessory === accessory ? 'Đeo lại' : 'Đeo'}
                </TipyButton>
              </li>
            ))}
          </ul>
        </>
      ) : (
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
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
