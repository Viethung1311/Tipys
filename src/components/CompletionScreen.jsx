import { ArrowLeft, RotateCcw, ChevronRight } from 'lucide-react';
import TipyButton from './TipyButton.jsx';
import { ADVENTURE_ART } from '../features/keyboard-quest/adventure.js';
import '../styles/play-surface.css';

export function assessmentSucceeded(attempt) {
  return Boolean(
    attempt?.submitted_at &&
      attempt.results?.length &&
      attempt.results.every((result) =>
        ['falling', 'guard'].includes(result.type) && result.targetScore != null
          ? result.outcome === 'good'
          : result.completed,
      ),
  );
}
export function assessmentCompleted(attempt) {
  return Boolean(
    attempt?.submitted_at &&
      attempt.results?.length &&
      attempt.results.every((r) =>
        r.type === 'falling' && r.targetScore != null ? r.outcome === 'good' : r.completed,
      ),
  );
}
export default function CompletionScreen({
  title,
  good,
  celebrate = false,
  background,
  metrics = [],
  scores = [],
  children,
  onBack,
  onRetry,
  onNext,
  retryLabel = 'Làm lại',
  busy = false,
}) {
  return (
    <section
      className={`play-result${good && celebrate ? ' play-result--celebrate' : ''}`}
      style={{ '--result-background': `url("${background || ADVENTURE_ART.autumn.src}")` }}
      aria-label="Kết quả lượt chơi"
    >
      <div className="play-result-content">
        <img
          className="play-result-star"
          src="/quest-art/smiling-star.png"
          alt=""
          width="1280"
          height="1280"
        />
        {scores.length > 0 && (
          <div className="play-result-scores">
            {scores.map(([value, label]) => (
              <p key={label}>
                <span>{scores.length > 1 ? `${label}: ` : ''}</span>
                <strong>{value}</strong>
              </p>
            ))}
          </div>
        )}
        <h1>{title || (good ? 'Hoàn thành tốt' : 'Chưa hoàn thành')}</h1>
        {!good && <p>Mình thử lại nhé, mỗi lần luyện là một bước tiến!</p>}
        {metrics.length > 0 && (
          <div className="play-result-metrics">
            {metrics.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
        {children}
        <div className="play-result-actions">
          {onBack && (
            <TipyButton
              variant="back"
              emphasis="secondary"
              icon={ArrowLeft}
              disabled={busy}
              onClick={onBack}
            >
              Quay lại
            </TipyButton>
          )}
          {onRetry && (
            <TipyButton
              emphasis={onNext ? 'secondary' : 'primary'}
              icon={RotateCcw}
              loading={busy}
              onClick={onRetry}
            >
              {retryLabel}
            </TipyButton>
          )}
          {onNext && (
            <TipyButton icon={ChevronRight} disabled={busy} onClick={onNext}>
              Bài tiếp
            </TipyButton>
          )}
        </div>
      </div>
    </section>
  );
}
