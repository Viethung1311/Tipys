/** Live gameplay owns animation and persistence; navigation unmounts it safely. */
import TipyButton from '../../components/TipyButton.jsx';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Keyboard as KeyboardIcon,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Home,
} from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import Keyboard from '../../components/Keyboard.jsx';
import { playRecorder } from '../../game/backend.js';
import useFallingGame from '../../hooks/useFallingGame.js';
import { LEVELS } from '../../game/config.js';
import { accuracy, formatTime } from '../../game/engine.js';
import CompletionScreen from '../../components/CompletionScreen.jsx';
import { enterPlayFullscreen } from '../../components/PlaySurface.jsx';
export default function Game({
  settings,
  onHome,
  onSetup,
  onFinish,
  sound,
  audioOpen,
  onPlayingChange,
  user,
  assessment = null,
  externalPaused = false,
}) {
  const recorder = useRef(null),
    latest = useRef(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [leaving, setLeaving] = useState(false);
  const parentPaused = useRef(false);
  const finished = (state) => {
    if (assessment) {
      assessment.onChange(state, true);
      return false;
    }
    recorder.current?.update(state, 'game_over');
    return onFinish(state);
  };
  const {
    view: s,
    hit,
    pause,
    resume,
    restart,
  } = useFallingGame(
    settings,
    finished,
    (name) => {
      if (!assessment || !['record', 'finish'].includes(name)) sound(name);
    },
    (state) => {
      latest.current = { ...state };
      assessment?.onChange(state);
      recorder.current?.update(state);
    },
    assessment?.initial,
  );
  latest.current = s;
  useEffect(() => {
    if (user && !assessment) recorder.current = playRecorder(user, settings, setSaveMessage);
    const leaving = () => {
      if (latest.current) recorder.current?.abandon(latest.current);
    };
    window.addEventListener('pagehide', leaving);
    return () => {
      window.removeEventListener('pagehide', leaving);
      if (assessment && latest.current) assessment.onChange(latest.current, false, true);
      if (latest.current) recorder.current?.update(latest.current, 'quit');
    };
  }, []);
  const playAgain = () => {
    enterPlayFullscreen();
    recorder.current?.update(latest.current, 'quit');
    if (user) recorder.current = playRecorder(user, settings, setSaveMessage);
    setSaveMessage('');
    restart();
  };
  useEffect(() => {
    onPlayingChange(s.status === 'playing');
  }, [s.status, onPlayingChange]);
  useEffect(() => () => onPlayingChange(false), [onPlayingChange]);
  useEffect(() => {
    if (audioOpen) pause();
  }, [audioOpen, pause]);
  useEffect(() => {
    if (externalPaused) pause();
    else if (parentPaused.current) resume();
    parentPaused.current = externalPaused;
  }, [externalPaused, pause]);
  if (assessment && s.status === 'result')
    return (
      <section className="panel assessment-section-result">
        <h2>Đã kết thúc phần Chữ rơi</h2>
        <p>Phần này đã được giữ lại. Quay về các phần rồi bấm Nộp bài khi sẵn sàng.</p>
        <TipyButton icon={ArrowLeft} onClick={assessment.onBack}>
          Các phần
        </TipyButton>
      </section>
    );
  if (!assessment && s.status === 'result')
    return (
      <CompletionScreen
        title={s.correct > 0 ? 'Bạn đã luyện rất tốt!' : 'Cùng thử lại nhé!'}
        good={s.correct > 0}
        celebrate={s.correct > 0}
        metrics={[
          [s.score, 'điểm'],
          [`${accuracy(s)}%`, 'chính xác'],
          [formatTime(s.elapsed), 'luyện tập'],
        ]}
        onRetry={playAgain}
        retryLabel="Luyện lại"
        onBack={onHome}
      >
        {saveMessage && <p role="alert">Chưa lưu được kết quả: {saveMessage}</p>}
      </CompletionScreen>
    );
  return (
    <main className="game-page">
      {saveMessage && (
        <p role="status" className="account-message">
          Chưa lưu được kết quả: {saveMessage}
        </p>
      )}
      <div className="game-heading">
        <button className="text-button" onClick={pause}>
          <ArrowLeft size={17} /> {assessment ? 'Phần Chữ rơi' : 'Khu luyện tập'}
        </button>
        <span className="tag">
          {settings.ranked ? 'Thi đấu tuần · A–Z · ' : ''}
          {LEVELS[settings.difficulty].icon} {LEVELS[settings.difficulty].name} ·{' '}
          {settings.keys.length} phím
        </span>
      </div>
      <h1 className="play-game-title">Chữ rơi · {LEVELS[settings.difficulty].name}</h1>
      <div className="game-toolbar">
        <button
          className="text-button"
          onClick={() => {
            pause();
            setLeaving(true);
          }}
        >
          <ArrowLeft size={20} />
          Quay lại
        </button>
        <div>
          <small>ĐIỂM CỦA BẠN</small>
          <strong data-testid="score">
            {s.score}
            <span> điểm</span>
          </strong>
        </div>
        <span className="speed-counter">
          Tốc độ {Math.floor(s.score / 500) + 1} · Mốc tiếp: {(Math.floor(s.score / 500) + 1) * 500}
        </span>
        <span className="wrong-counter" data-testid="wrong-counter">
          Sai: {s.wrong}/6
        </span>
        <div className="hearts" aria-label={`Còn ${s.lives} mạng`}>
          {[0, 1, 2].map((n) => (
            <Heart
              key={n}
              fill={n < s.lives ? 'currentColor' : 'none'}
              className={n < s.lives ? '' : 'empty'}
            />
          ))}
        </div>
        <div className="timer">
          <small>THỜI GIAN</small>
          <strong>{formatTime(s.elapsed)}</strong>
        </div>
        <button className="icon-button" aria-label="Tạm dừng" onClick={pause}>
          <Pause />
        </button>
      </div>
      <div
        className={`arena ${s.feedback === 'missed' ? 'missed' : ''}`}
        aria-label="Khu vực chữ rơi"
      >
        <div className="arena-top">
          <span>
            <i /> Luyện tập mỗi ngày, tiến bộ từng phím
          </span>
          <span>+10 / chữ đúng</span>
        </div>
        <div className="lanes">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} />
          ))}
        </div>
        <div className="fall-zone">
          {s.letters.map((l) => (
            <div
              className={`letter color-${l.id % 4}`}
              data-key={l.key}
              key={l.id}
              style={{ left: `${((l.column + 0.5) / 6) * 100}%`, top: `${l.y * 100}%` }}
            >
              {l.key}
            </div>
          ))}
        </div>
        <div className="danger-line">
          <span>Đừng để chữ chạm vạch này nhé!</span>
        </div>
        {s.status === 'countdown' && (
          <div className="countdown" role="status">
            <span>Sẵn sàng nào!</span>
            <strong>{Math.ceil(s.countdown)}</strong>
            <p>Đặt tay lên phím hoặc chạm bàn phím bên dưới</p>
          </div>
        )}
      </div>
      <div className="keyboard-caption">
        <KeyboardIcon size={17} />
        <span>Bấm phím trên máy tính hoặc chạm phím bên dưới</span>
        <b>{s.lastKey || '⌨'}</b>
      </div>
      <Keyboard
        keys={settings.keys}
        visibleKeys={
          settings.keys.length > 8
            ? [...settings.keys.slice(0, 4), ...s.letters.map((letter) => letter.key)]
            : undefined
        }
        onKey={hit}
        lastKey={s.lastKey}
        disabled={s.status !== 'playing'}
      />
      <p className="game-note">
        Gõ đúng +10 điểm <span>•</span> Sai lần thứ 6 sẽ kết thúc <span>•</span> Mỗi 500 điểm tăng
        tốc <span>•</span> Esc để tạm dừng
      </p>
      {s.status === 'paused' && !audioOpen && !leaving && !parentPaused.current && (
        <Modal
          title="Nghỉ một chút nhé ☕"
          description="Chữ và thời gian đã dừng. Tiếp tục khi bạn sẵn sàng."
        >
          <TipyButton variant="play" icon={Play} className="full" onClick={resume}>
            Tiếp tục
          </TipyButton>
          {!assessment && (
            <TipyButton
              variant="play"
              emphasis="secondary"
              icon={RotateCcw}
              className="full"
              onClick={playAgain}
            >
              Chơi lại
            </TipyButton>
          )}
          <button className="text-button centered" onClick={() => setLeaving(true)}>
            <Home size={17} /> Quay lại
          </button>
        </Modal>
      )}
      {leaving && (
        <Modal
          title="Quay lại?"
          description={
            assessment
              ? 'Phần đang làm sẽ được lưu trước khi quay lại các phần.'
              : 'Lượt luyện hiện tại sẽ kết thúc. Bạn muốn quay lại?'
          }
          onClose={() => setLeaving(false)}
        >
          <TipyButton
            emphasis="secondary"
            icon={Play}
            onClick={() => {
              setLeaving(false);
              resume();
            }}
          >
            Làm tiếp
          </TipyButton>
          <TipyButton icon={ArrowLeft} onClick={assessment ? assessment.onBack : onHome}>
            Quay lại
          </TipyButton>
        </Modal>
      )}
    </main>
  );
}
