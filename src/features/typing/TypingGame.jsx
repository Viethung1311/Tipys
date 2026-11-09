/** Live gameplay owns animation and persistence; navigation unmounts it safely. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Keyboard as KeyboardIcon,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Home,
  Trophy,
} from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import Keyboard from '../../components/Keyboard.jsx';
import { playRecorder } from '../../game/backend.js';
import useFallingGame from '../../hooks/useFallingGame.js';
import { LEVELS, load, recordKey } from '../../game/config.js';
import { accuracy, formatTime } from '../../game/engine.js';
export default function Game({
  settings,
  onHome,
  onSetup,
  onFinish,
  sound,
  audioOpen,
  onPlayingChange,
  user,
}) {
  const recorder = useRef(null),
    latest = useRef(null);
  const [saveMessage, setSaveMessage] = useState('');
  const finished = (state) => {
    recorder.current?.update(state, 'game_over');
    return onFinish(state);
  };
  const {
    view: s,
    hit,
    pause,
    resume,
    restart,
  } = useFallingGame(settings, finished, sound, (state) => {
    latest.current = { ...state };
    recorder.current?.update(state);
  });
  latest.current = s;
  useEffect(() => {
    if (user) recorder.current = playRecorder(user, settings, setSaveMessage);
    const leaving = () => {
      if (latest.current) recorder.current?.abandon(latest.current);
    };
    window.addEventListener('pagehide', leaving);
    return () => {
      window.removeEventListener('pagehide', leaving);
      if (latest.current) recorder.current?.update(latest.current, 'quit');
    };
  }, []);
  const playAgain = () => {
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
  const best = load(recordKey(settings), 0);
  return (
    <main className="game-page">
      {saveMessage && (
        <p role="status" className="account-message">
          Chưa lưu được kết quả: {saveMessage}
        </p>
      )}
      <div className="game-heading">
        <button className="text-button" onClick={pause}>
          <ArrowLeft size={17} /> Khu luyện tập
        </button>
        <span className="tag">
          {LEVELS[settings.difficulty].icon} {LEVELS[settings.difficulty].name} ·{' '}
          {settings.keys.length} phím
        </span>
      </div>
      <div className="game-toolbar">
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
        onKey={hit}
        lastKey={s.lastKey}
        disabled={s.status !== 'playing'}
      />
      <p className="game-note">
        Gõ đúng +10 điểm <span>•</span> Sai lần thứ 6 sẽ kết thúc <span>•</span> Mỗi 500 điểm tăng
        tốc <span>•</span> Esc để tạm dừng
      </p>
      {s.status === 'paused' && !audioOpen && (
        <Modal
          title="Nghỉ một chút nhé ☕"
          description="Chữ và thời gian đã dừng. Tiếp tục khi bạn sẵn sàng."
        >
          <button className="primary full" onClick={resume}>
            <Play size={18} /> Tiếp tục
          </button>
          <button className="secondary full" onClick={playAgain}>
            <RotateCcw size={17} /> Chơi lại
          </button>
          <button className="text-button centered" onClick={onHome}>
            <Home size={17} /> Về trang chủ
          </button>
        </Modal>
      )}
      {s.status === 'result' && !audioOpen && (
        <Modal
          title="Bạn đã làm rất tốt! 🌟"
          description="Kết thúc lượt chơi · Mỗi lần luyện là một lần tiến bộ."
        >
          <p className="end-reason">
            {s.endReason === 'wrong_limit'
              ? 'Bạn đã bấm sai quá 5 lần. Mình thử chậm lại nhé!'
              : 'Luyện tập thêm một chút để giữ được nhiều chữ hơn nhé!'}
          </p>
          <div className="result-score">
            {s.score}
            <span>điểm</span>
          </div>
          <div className="record">
            <Trophy size={16} /> Kỷ lục trên máy này: {Math.max(best, s.score)}
          </div>
          <div className="result-grid">
            {[
              ['Thời gian', formatTime(s.elapsed)],
              ['Độ chính xác', `${accuracy(s)}%`],
              ['Bấm đúng', s.correct],
              ['Bấm sai', s.wrong],
              ['Bỏ lỡ', s.missed],
              ['Độ khó', LEVELS[settings.difficulty].name],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="result-keys">Bộ phím: {[...settings.keys].sort().join(', ')}</p>
          <button className="primary full" onClick={playAgain}>
            <RotateCcw size={18} /> Chơi lại nào
          </button>
          <button className="secondary full" onClick={onSetup}>
            Đổi cài đặt
          </button>
          <button className="text-button centered" onClick={onHome}>
            Về trang chủ
          </button>
        </Modal>
      )}
    </main>
  );
}
