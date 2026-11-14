import { ArrowLeft, RotateCcw, ChevronRight } from 'lucide-react';
import TipyButton from './TipyButton.jsx';
import { ADVENTURE_ART } from '../features/keyboard-quest/adventure.js';
import '../styles/play-surface.css';

export function assessmentSucceeded(attempt) {
  return Boolean(
    attempt?.submitted_at &&
      attempt.results?.length &&
      attempt.results.every((result) =>
        result.type === 'falling' && result.targetScore != null
          ? result.outcome === 'good'
          : result.completed,
      ),
  );
}
export default function CompletionScreen({
  title,
  good,
  celebrate = false,
  background,
  metrics = [],
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
          {onNext && (
            <TipyButton icon={ChevronRight} disabled={busy} onClick={onNext}>
              Bài tiếp
            </TipyButton>
          )}
          {onRetry && (
            <TipyButton emphasis="secondary" icon={RotateCcw} loading={busy} onClick={onRetry}>
              {retryLabel}
            </TipyButton>
          )}
          {onBack && (
            <TipyButton icon={ArrowLeft} disabled={busy} onClick={onBack}>
              Quay lại
            </TipyButton>
          )}
        </div>
      </div>
    </section>
  );
}
