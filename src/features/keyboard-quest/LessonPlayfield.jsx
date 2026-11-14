import { Pause, Timer, ArrowLeft } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import './playfield.css';

/** Presentation only; LessonPlayer keeps input, timing, grading and saving for both layouts. */
export default function LessonPlayfield({
  lesson,
  world,
  seconds,
  index,
  paused,
  onPause,
  onBack,
  challenge,
  inputArea,
  controls,
  feedback,
  race,
  pauseDialog,
}) {
  return (
    <section
      className="quest-player quest-playfield"
      aria-label={`Bài ${lesson.stage}: ${lesson.title}`}
    >
      <header className="quest-playfield-header quest-player-top">
        {onBack && (
          <TipyButton emphasis="secondary" icon={ArrowLeft} onClick={onBack}>
            Quay lại
          </TipyButton>
        )}
        <span className="quest-playfield-time">
          <Timer aria-hidden="true" size={22} />
          <span>
            Thời gian{' '}
            <b>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </b>
          </span>
        </span>
        <h1>
          Bài {lesson.stage} · {lesson.title}
        </h1>
        <TipyButton emphasis="secondary" icon={Pause} disabled={paused} onClick={onPause}>
          Tạm dừng
        </TipyButton>
      </header>
      <div className="quest-playfield-progress">
        <span>
          Lượt {index + 1}/{lesson.items.length}
        </span>
        <progress max={lesson.items.length} value={index} aria-label="Tiến độ bài luyện" />
      </div>
      {lesson.description && <p className="quest-playfield-description">{lesson.description}</p>}
      {race}
      {challenge}
      <div className="quest-playfield-bottom">
        <aside className="quest-playfield-guide">
          <img
            src={world.guide.src}
            alt={world.guideName}
            width="240"
            height="280"
            decoding="async"
          />
        </aside>
        <div className="quest-playfield-input">{inputArea}</div>
        <div className="quest-playfield-tools">{controls}</div>
      </div>
      {feedback}
      {pauseDialog}
    </section>
  );
}
