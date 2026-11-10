import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Save,
} from 'lucide-react';
import Keyboard from '../../components/Keyboard.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import { physicalKey, SUPPORTED_KEYS } from '../../game/config.js';
import { FINGER_HINTS } from './curriculum.js';
import { createAnswers, errorKind, gradeLesson, matchesTarget } from './engine.js';
import { createLessonSession } from './session.js';

export default function LessonPlayer({
  lesson,
  user,
  sound,
  blocked,
  onPlayingChange,
  onBack,
  onSaved,
  nextLesson,
}) {
  const [phase, setPhase] = useState(user ? 'starting' : 'playing'),
    [index, setIndex] = useState(0),
    [value, setValue] = useState(''),
    [feedback, setFeedback] = useState(''),
    [hint, setHint] = useState(true),
    [seconds, setSeconds] = useState(0),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [saved, setSaved] = useState(false),
    [lastKey, setLastKey] = useState('');
  const answers = useRef(createAnswers(lesson)),
    session = useRef(null),
    elapsed = useRef(0),
    tick = useRef(null),
    composing = useRef(false),
    input = useRef(null),
    live = useRef(true);
  const target = lesson.items[index];
  const pause = useCallback(() => setPhase((old) => (old === 'playing' ? 'paused' : old)), []);
  useEffect(() => {
    live.current = true;
    let cancelled = false,
      recording;
    // StrictMode replays effects; do not start an abandoned lesson on the server.
    Promise.resolve().then(() => {
      if (!user || cancelled) return;
      recording = createLessonSession(lesson);
      session.current = recording;
      recording.ready
        .then(() => {
          if (!cancelled) setPhase(document.hidden ? 'paused' : 'playing');
        })
        .catch((error) => {
          if (!cancelled) {
            setSaveError(error.message);
            setPhase('start-error');
          }
        });
    });
    return () => {
      cancelled = true;
      live.current = false;
      recording?.quit(Math.floor(elapsed.current / 1000)).catch(() => {});
    };
  }, [lesson, user]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [pause]);
  useEffect(() => {
    if (blocked) pause();
  }, [blocked, pause, phase]);
  useEffect(() => {
    onPlayingChange(phase === 'playing' && !blocked);
    return () => onPlayingChange(false);
  }, [phase, blocked, onPlayingChange]);
  useEffect(() => {
    if (phase !== 'playing' || blocked) return;
    tick.current = performance.now();
    const update = () => {
      const now = performance.now();
      elapsed.current += now - tick.current;
      tick.current = now;
      setSeconds(Math.floor(elapsed.current / 1000));
    };
    const timer = setInterval(update, 1000);
    return () => {
      clearInterval(timer);
      update();
    };
  }, [phase, blocked]);
  useEffect(() => {
    if (phase === 'playing')
      session.current?.progress(seconds).catch((error) => {
        if (live.current) setSaveError(error.message);
      });
  }, [seconds, phase]);
  const submit = useCallback(
    (answer) => {
      if (phase !== 'playing' || blocked || composing.current || answers.current[index].answer)
        return;
      const row = answers.current[index];
      if (matchesTarget(answer, target.target)) {
        row.answer = target.target;
        setFeedback('Đúng rồi!');
        sound('correct');
        if (index + 1 === lesson.items.length) setPhase('result');
        else {
          setIndex(index + 1);
          setValue('');
          input.current?.focus();
        }
      } else {
        row.errors++;
        row[errorKind(lesson, answer, target.target)]++;
        setFeedback('Thử lại nhé! Nhìn mẫu một lần nữa.');
        sound('wrong');
      }
    },
    [phase, blocked, index, target, lesson, sound],
  );
  useEffect(() => {
    if (lesson.kind !== 'key') return;
    const down = (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing ||
        event.target.closest?.('input,textarea,select,[contenteditable=true]')
      )
        return;
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (event.target.closest?.('button,a') && ['Space', 'Enter'].includes(event.code)) return;
      const key = event.code === 'Space' ? 'Space' : physicalKey(event.code);
      if (!key || phase !== 'playing' || blocked) return;
      event.preventDefault();
      setLastKey(key);
      submit(key);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [lesson, submit, pause, phase, blocked]);
  const grade = phase === 'result' ? gradeLesson(lesson, answers.current) : null;
  const persist = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      let progress;
      if (session.current)
        progress = (
          await session.current.finish(Math.floor(elapsed.current / 1000), answers.current)
        ).data.progress;
      if (!live.current) return;
      onSaved(lesson, gradeLesson(lesson, answers.current), progress);
      setSaved(true);
    } catch (error) {
      if (live.current) setSaveError(error.message);
    } finally {
      if (live.current) setSaving(false);
    }
  }, [lesson, onSaved]);
  useEffect(() => {
    if (phase === 'result') persist();
  }, [phase, persist]);
  const leave = async () => {
    await session.current?.quit(Math.floor(elapsed.current / 1000)).catch(() => {});
    onBack();
  };
  if (phase === 'starting')
    return (
      <section className="panel quest-state" role="status">
        Đang mở bài học…
      </section>
    );
  if (phase === 'start-error')
    return (
      <section className="panel quest-state">
        <h2>Chưa mở được bài</h2>
        <p role="alert">{saveError}</p>
        <TipyButton icon={ArrowLeft} onClick={onBack}>
          Quay lại
        </TipyButton>
      </section>
    );
  if (phase === 'result')
    return (
      <section className="panel quest-result">
        <span className="quest-mascot" aria-hidden="true">
          {grade.completed ? '🌟' : '🌱'}
        </span>
        <h2>Bạn đã luyện rất tốt!</h2>
        <p className="quest-stars" aria-label={`${grade.stars} sao`}>
          {'★'.repeat(grade.stars)}
          {'☆'.repeat(3 - grade.stars)}
        </p>
        <div className="quest-metrics">
          <p>
            <b>{grade.correct}</b> lượt đúng
          </p>
          <p>
            <b>{grade.accuracy}%</b> chính xác
          </p>
          <p>
            <b>{seconds}s</b> luyện tập
          </p>
        </div>
        <p>
          {grade.completed
            ? 'Bạn đã mở thêm một bước trên hành trình!'
            : `Luyện thêm một chút nhé. Bài này cần ${lesson.threshold}% chính xác để mở bước tiếp.`}
        </p>
        {Object.keys(grade.weakKeys).length > 0 && (
          <p>
            Phím cần luyện thêm:{' '}
            {Object.keys(grade.weakKeys)
              .map((k) => (k === 'Space' ? 'Cách' : k))
              .join(', ')}
          </p>
        )}
        {Object.keys(grade.weakRules).length > 0 && (
          <p>Phép Telex cần ôn: {Object.keys(grade.weakRules).join(', ')}</p>
        )}
        <p role="status">
          {saving
            ? 'Đang lưu tiến độ…'
            : saved
              ? user
                ? 'Đã lưu vào tài khoản TIPY.'
                : 'Đã lưu bản chơi thử trên máy này.'
              : ''}
        </p>
        {saveError && (
          <>
            <p role="alert">{saveError}</p>
            <TipyButton icon={Save} loading={saving} onClick={persist}>
              Thử lưu lại
            </TipyButton>
          </>
        )}
        <div className="quest-actions">
          {nextLesson && grade.completed && (
            <TipyButton
              icon={ChevronRight}
              disabled={!saved || saving}
              onClick={() => onBack(nextLesson.id)}
            >
              Bài tiếp
            </TipyButton>
          )}
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            disabled={!saved || saving}
            onClick={() => onBack(lesson.id)}
          >
            Luyện lại
          </TipyButton>
          <TipyButton
            emphasis="secondary"
            icon={ArrowLeft}
            disabled={saving}
            onClick={() => onBack()}
          >
            Bản đồ
          </TipyButton>
        </div>
      </section>
    );
  return (
    <section className="panel quest-player">
      <div className="quest-player-top">
        <span>
          Bài {lesson.stage} · {lesson.title}
        </span>
        <TipyButton emphasis="secondary" icon={Pause} onClick={pause}>
          Tạm dừng
        </TipyButton>
      </div>
      <progress max={lesson.items.length} value={index} aria-label="Tiến độ bài luyện" />
      <p>
        Lượt {index + 1}/{lesson.items.length} · Thời gian {seconds}s
      </p>
      <div className="quest-challenge">
        <span className="quest-mascot" aria-hidden="true">
          {target.image}
        </span>
        <p>{lesson.kind === 'key' ? 'Tìm và bấm phím' : 'Gõ đúng theo mẫu'}</p>
        <h2 className="quest-target">{target.target === 'Space' ? 'Phím cách' : target.target}</h2>
        {hint && (
          <p className="quest-hint">
            {lesson.kind === 'key'
              ? FINGER_HINTS[target.target]
              : target.example
                ? `Telex: ${target.example}`
                : 'Chú ý chữ hoa, khoảng trắng và dấu câu.'}
          </p>
        )}
      </div>
      {lesson.kind === 'text' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!composing.current) submit(value);
          }}
        >
          <label className="quest-input-label">
            Gõ ở đây
            <textarea
              ref={input}
              value={value}
              rows={2}
              maxLength={160}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.isComposing &&
                  !composing.current &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  submit(value);
                }
              }}
            />
          </label>
          <TipyButton type="submit" icon={Check}>
            Kiểm tra
          </TipyButton>
        </form>
      )}
      <p className="quest-feedback" role="status" aria-live="polite">
        {feedback || 'Mình cùng thử nhé!'}
      </p>
      {lesson.kind === 'key' ? (
        <>
          <Keyboard
            keys={[...SUPPORTED_KEYS]}
            lastKey={lastKey}
            targetKey={target.target}
            disabled={phase !== 'playing' || blocked}
            onKey={(key) => {
              setLastKey(key);
              submit(key);
            }}
          />
          <TipyButton variant="play" emphasis="secondary" onClick={() => submit('Space')}>
            Phím cách
          </TipyButton>
        </>
      ) : (
        <p className="quest-hint">
          {lesson.telex
            ? 'Bật Telex trên máy (UniKey/EVKey hoặc bộ gõ của thiết bị), rồi gõ vào ô. Bàn phím cảm ứng của máy cũng dùng được.'
            : 'Dùng bàn phím của máy hoặc chạm vào ô để mở bàn phím cảm ứng.'}
        </p>
      )}
      <div className="quest-actions">
        <TipyButton emphasis="secondary" icon={Lightbulb} onClick={() => setHint(!hint)}>
          {hint ? 'Ẩn gợi ý' : 'Xem gợi ý'}
        </TipyButton>
        <TipyButton emphasis="secondary" icon={ArrowLeft} onClick={leave}>
          Bản đồ
        </TipyButton>
      </div>
      {phase === 'paused' && !blocked && (
        <Modal title="Nghỉ một chút nhé" description="Thời gian luyện đã dừng. Không vội đâu!">
          <TipyButton
            variant="play"
            icon={Play}
            className="full"
            onClick={() => setPhase('playing')}
          >
            Tiếp tục
          </TipyButton>
          <TipyButton emphasis="secondary" icon={ArrowLeft} className="full" onClick={leave}>
            Bản đồ
          </TipyButton>
        </Modal>
      )}
    </section>
  );
}
