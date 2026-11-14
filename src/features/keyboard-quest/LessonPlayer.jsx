import { useCallback, useEffect, useImperativeHandle, useRef, useState, useId } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Save,
  Volume2,
} from 'lucide-react';
import Keyboard from '../../components/Keyboard.jsx';
import LessonPlayfield from './LessonPlayfield.jsx';
import LetterTarget from './LetterTarget.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import { physicalKey, SUPPORTED_KEYS } from '../../game/config.js';
import { FINGER_HINTS } from './curriculum.js';
import { createAnswers, errorKind, gradeLesson, matchesTarget } from './engine.js';
import { createLessonSession } from './session.js';
import { companionSay } from '../../characters/companion-speech.js';
import CompletionScreen from '../../components/CompletionScreen.jsx';

export default function LessonPlayer({
  lesson,
  world = null,
  assessment = null,
  user,
  sound,
  blocked,
  onPlayingChange,
  onBack,
  onSaved,
  nextLesson,
  mode = 'learn',
  previous,
  navigationRef,
  onNavigationLockChange,
  immersive = false,
  externalPaused = false,
}) {
  const formId = useId();
  const [phase, setPhase] = useState(user ? 'starting' : 'playing'),
    [index, setIndex] = useState(() =>
      Math.max(0, assessment?.answers?.findIndex((row) => !row.answer) ?? 0),
    ),
    [value, setValue] = useState(''),
    [feedback, setFeedback] = useState(''),
    [hint, setHint] = useState(true),
    [seconds, setSeconds] = useState(assessment?.seconds || 0),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [saved, setSaved] = useState(false),
    [reward, setReward] = useState(null),
    [lastKey, setLastKey] = useState(''),
    [ime, setIme] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const parentPaused = useRef(false);
  const answers = useRef(
      assessment?.answers ? structuredClone(assessment.answers) : createAnswers(lesson),
    ),
    session = useRef(null),
    elapsed = useRef((assessment?.seconds || 0) * 1000),
    tick = useRef(null),
    composing = useRef(false),
    input = useRef(null),
    live = useRef(true);
  const target = lesson.items[index];
  const greeted = useRef(false),
    previousPhase = useRef(null);
  useEffect(() => {
    if (phase === 'playing' && !blocked && !greeted.current) {
      greeted.current = true;
      companionSay('start');
    }
    if (phase === 'paused' && previousPhase.current !== 'paused') companionSay('rest');
    if (phase === 'result' && previousPhase.current !== 'result') {
      const result = gradeLesson(lesson, answers.current);
      const record = previous && result.accuracy > previous.best_accuracy;
      companionSay(record ? 'record' : result.completed ? 'complete' : 'finish');
    }
    previousPhase.current = phase;
  }, [phase, blocked, lesson, previous]);
  const kind = target.kind || lesson.kind;
  const pause = useCallback(() => setPhase((old) => (old === 'playing' ? 'paused' : old)), []);
  useEffect(() => {
    if (externalPaused) pause();
    else if (parentPaused.current) setPhase((old) => (old === 'paused' ? 'playing' : old));
    parentPaused.current = externalPaused;
  }, [externalPaused, pause]);
  useEffect(() => {
    live.current = true;
    let cancelled = false,
      recording;
    // StrictMode replays effects; do not start an abandoned lesson on the server.
    Promise.resolve().then(() => {
      if (!user || cancelled) return;
      recording = assessment?.session || createLessonSession(lesson);
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
  }, [lesson, user?.user_id]);
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
        companionSay('correct');
        if (index + 1 === lesson.items.length) setPhase('result');
        else {
          setIndex(index + 1);
          setValue('');
          input.current?.focus();
        }
      } else {
        row.errors++;
        row[
          errorKind(
            { ...lesson, kind, telex: assessment ? Boolean(target.telex) : lesson.telex },
            answer,
            target.target,
          )
        ]++;
        setFeedback('Thử lại nhé! Nhìn mẫu một lần nữa.');
        sound('wrong');
        companionSay('wrong');
      }
      assessment?.onChange(
        answers.current.map((item) => ({ ...item })),
        Math.floor(elapsed.current / 1000),
      );
    },
    [phase, blocked, index, target, lesson, sound, kind],
  );
  useEffect(() => {
    if (kind !== 'key') return;
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
  }, [kind, submit, pause, phase, blocked]);
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
      setReward(progress || null);
      onSaved(
        lesson,
        gradeLesson(lesson, answers.current),
        progress,
        Math.floor(elapsed.current / 1000),
      );
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
  const leave = async (destination) => {
    if (phase === 'starting' || (phase === 'result' && (saving || (!saved && !saveError)))) return;
    await session.current?.quit(Math.floor(elapsed.current / 1000)).catch(() => {});
    if (typeof destination === 'function') destination();
    else onBack();
  };
  const requestLeave = () => {
    if (!immersive) return leave();
    pause();
    setLeaving(true);
  };
  // External map navigation uses the same queued quit as the in-lesson Back button.
  useImperativeHandle(navigationRef, () => leave);
  useEffect(() => {
    onNavigationLockChange?.(
      phase === 'starting' || (phase === 'result' && (saving || (!saved && !saveError))),
    );
    return () => onNavigationLockChange?.(false);
  }, [phase, saving, saved, saveError, onNavigationLockChange]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (phase !== 'playing' || blocked) window.speechSynthesis?.cancel();
  }, [phase, blocked]);
  const listen = () => {
    const voice = window.speechSynthesis
      ?.getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('vi'));
    if (!voice || !window.SpeechSynthesisUtterance) {
      setFeedback('Máy chưa có giọng đọc tiếng Việt. Bạn có thể xem gợi ý nhé.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      kind === 'key'
        ? `Bấm phím ${target.target === 'Space' ? 'cách' : target.target}`
        : target.prompt
          ? `Điền chữ còn thiếu trong ${target.prompt.replace('_', ' ... ')}`
          : target.target,
    );
    utterance.voice = voice;
    utterance.lang = 'vi-VN';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
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
    if (assessment)
      return (
        <section className="panel assessment-section-result">
          <h2>Đã hoàn thành phần gõ</h2>
          <p role="status">
            {saving
              ? 'Đang lưu phần làm bài…'
              : saved
                ? 'Đã lưu phần làm bài. Bạn vẫn cần bấm Nộp bài.'
                : ''}
          </p>
          {saveError && <p role="alert">{saveError}</p>}
          {saveError && (
            <TipyButton icon={Save} onClick={persist} loading={saving}>
              Thử lưu lại
            </TipyButton>
          )}
          <TipyButton icon={ArrowLeft} disabled={!saved || saving} onClick={() => onBack()}>
            Các phần
          </TipyButton>
        </section>
      );
  if (phase === 'result' && immersive)
    return (
      <CompletionScreen
        good={grade.completed}
        celebrate={saved && grade.completed}
        background={world?.background.src}
        metrics={[
          [grade.correct, 'lượt đúng'],
          [`${grade.accuracy}%`, 'chính xác'],
          [`${seconds}s`, 'luyện tập'],
        ]}
        busy={saving}
        onRetry={saved ? () => onBack(lesson.id) : undefined}
        retryLabel="Luyện lại"
        onNext={saved && nextLesson && grade.completed ? () => onBack(nextLesson.id) : undefined}
        onBack={() => {
          if (saved || window.confirm('Kết quả chưa lưu được. Bạn vẫn muốn quay lại?')) onBack();
        }}
      >
        <p role="status">
          {saving
            ? 'Đang lưu tiến độ…'
            : saved
              ? user
                ? `Đã lưu vào tài khoản Zunimo. Nhận thêm ${reward?.award_this_play || 0} sao · ${reward?.awarded_stars >= 3 ? 'Đã nhận đủ 3 sao' : reward?.award_this_play > 0 ? `Bài này đã nhận ${reward.awarded_stars}/3 sao` : 'Chưa vượt thành tích cũ'}`
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
      </CompletionScreen>
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
        <p>
          Sao thành tích lần này: {grade.stars}/3 · Tốt nhất:{' '}
          {Math.max(grade.stars, previous?.best_stars || 0)}/3
        </p>
        {saved && (
          <p role="status">
            {!user
              ? 'Chơi thử · Nhận thêm 0 sao tài khoản.'
              : `Nhận thêm ${reward?.award_this_play || 0} sao · ${
                  reward?.awarded_stars >= 3
                    ? 'Đã nhận đủ 3 sao'
                    : reward?.award_this_play > 0
                      ? `Bài này đã nhận ${reward.awarded_stars}/3 sao`
                      : 'Chưa vượt thành tích cũ'
                }`}
          </p>
        )}
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
        {lesson.kind === 'text' && seconds > 0 && (
          <p>
            {Math.round(
              (lesson.items.reduce((n, item) => n + [...item.target].length, 0) * 60) / seconds,
            )}{' '}
            ký tự/phút · Tốc độ chỉ để tham khảo.
          </p>
        )}
        {previous && (
          <p>
            Lần trước: {previous.last_accuracy}% · Tốt nhất: {previous.best_accuracy}% chính xác.
          </p>
        )}
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
                ? 'Đã lưu vào tài khoản Zunimo.'
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
            {world ? 'Danh sách bài' : 'Bản đồ'}
          </TipyButton>
        </div>
      </section>
    );
  const race = mode === 'race' && (
    <div
      className="quest-race"
      aria-label={`Xe của bạn đã đi ${index} trên ${lesson.items.length} chặng`}
    >
      <span style={{ left: `${(index / lesson.items.length) * 85}%` }} aria-hidden="true">
        🏎️
      </span>
      <b aria-hidden="true">🏁</b>
      <p>Mỗi lượt đúng, xe tiến thêm một chặng. Không đếm ngược.</p>
    </div>
  );
  const challenge = (
    <div className="quest-challenge">
      {(!world || (kind !== 'key' && (target.prompt || [...target.target].length > 1))) && (
        <span className="quest-mascot" aria-hidden="true">
          {target.image}
        </span>
      )}
      <p>
        {kind === 'key'
          ? 'Tìm và bấm phím'
          : target.prompt
            ? 'Gõ chữ còn thiếu'
            : 'Gõ đúng theo mẫu'}
      </p>
      <h2 className="quest-target">
        {world ? (
          <LetterTarget value={target.prompt || target.target} />
        ) : (
          target.prompt || (target.target === 'Space' ? 'Phím cách' : target.target)
        )}
      </h2>
      {hint && (
        <p className="quest-hint">
          {kind === 'key'
            ? FINGER_HINTS[target.target]
            : target.example
              ? `Telex: ${target.example}`
              : 'Chú ý chữ hoa, khoảng trắng và dấu câu.'}
        </p>
      )}
    </div>
  );
  const inputForm = kind === 'text' && (
    <form
      id={world ? formId : undefined}
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
          disabled={phase !== 'playing' || blocked}
          onCompositionStart={() => {
            composing.current = true;
            setIme(true);
          }}
          onCompositionUpdate={() => {
            composing.current = true;
            setIme(true);
          }}
          onCompositionEnd={() => {
            composing.current = false;
            setIme(false);
          }}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            setLastKey(event.key === ' ' ? 'Cách' : event.key);
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.isComposing &&
              !event.nativeEvent.isComposing &&
              !composing.current &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              submit(value);
            }
          }}
        />
      </label>
      {!world && (
        <TipyButton type="submit" icon={Check} disabled={ime || phase !== 'playing' || blocked}>
          Kiểm tra
        </TipyButton>
      )}
    </form>
  );
  const feedbackContent = (
    <>
      <p className="quest-feedback" role="status" aria-live="polite">
        {ime ? 'Đang ghép dấu…' : feedback || 'Mình cùng thử nhé!'}
      </p>
      {lastKey && <p className="quest-hint">Vừa bấm: {lastKey}</p>}
    </>
  );
  const inputArea =
    kind === 'key' ? (
      <>
        <Keyboard
          keys={
            immersive
              ? [
                  ...new Set([
                    ...lesson.items
                      .map((item) => item.target)
                      .filter((key) => SUPPORTED_KEYS.has(key)),
                    'A',
                    'S',
                    'F',
                    'J',
                  ]),
                ]
              : [...SUPPORTED_KEYS]
          }
          lastKey={lastKey}
          targetKey={world && !hint ? undefined : target.target}
          disabled={phase !== 'playing' || blocked}
          onKey={(key) => {
            setLastKey(key);
            submit(key);
          }}
        />
        <TipyButton
          variant="play"
          emphasis="secondary"
          className={
            world
              ? 'quest-space-key' + (hint && target.target === 'Space' ? ' quest-target-key' : '')
              : undefined
          }
          disabled={world ? phase !== 'playing' || blocked : undefined}
          onClick={() => {
            if (world) setLastKey('Space');
            submit('Space');
          }}
        >
          Phím cách
        </TipyButton>
      </>
    ) : (
      <p className="quest-hint">
        {lesson.telex
          ? 'Bật Telex trên máy (UniKey/EVKey hoặc bộ gõ của thiết bị), rồi gõ vào ô. Bàn phím cảm ứng của máy cũng dùng được.'
          : 'Dùng bàn phím của máy hoặc chạm vào ô để mở bàn phím cảm ứng.'}
      </p>
    );
  const tools = (
    <div className="quest-actions">
      <TipyButton
        emphasis="secondary"
        icon={Volume2}
        onClick={listen}
        disabled={phase !== 'playing' || blocked}
      >
        Nghe mẫu
      </TipyButton>
      <TipyButton emphasis="secondary" icon={Lightbulb} onClick={() => setHint(!hint)}>
        {hint ? 'Ẩn gợi ý' : world ? 'Hiện gợi ý' : 'Xem gợi ý'}
      </TipyButton>
      {world && kind === 'text' && (
        <TipyButton
          type="submit"
          form={formId}
          icon={Check}
          disabled={ime || phase !== 'playing' || blocked}
        >
          Kiểm tra
        </TipyButton>
      )}
      {!world && (
        <TipyButton emphasis="secondary" icon={ArrowLeft} onClick={leave}>
          Bản đồ
        </TipyButton>
      )}
    </div>
  );
  const pauseDialog = (
    <>
      {phase === 'paused' && !blocked && !leaving && !parentPaused.current && (
        <Modal title="Nghỉ một chút nhé" description="Thời gian luyện đã dừng. Không vội đâu!">
          <TipyButton
            variant="play"
            icon={Play}
            className="full"
            onClick={() => setPhase('playing')}
          >
            Tiếp tục
          </TipyButton>
          <TipyButton emphasis="secondary" icon={ArrowLeft} className="full" onClick={requestLeave}>
            {immersive ? 'Quay lại' : 'Bản đồ'}
          </TipyButton>
        </Modal>
      )}
      {leaving && (
        <Modal
          title="Quay lại?"
          description={
            assessment
              ? 'Phần đang làm sẽ được lưu.'
              : 'Lượt luyện hiện tại sẽ kết thúc và thời gian đã luyện được giữ.'
          }
          onClose={() => setLeaving(false)}
        >
          <TipyButton
            emphasis="secondary"
            icon={Play}
            onClick={() => {
              setLeaving(false);
              setPhase('playing');
            }}
          >
            Làm tiếp
          </TipyButton>
          <TipyButton icon={ArrowLeft} onClick={() => leave()}>
            Quay lại
          </TipyButton>
        </Modal>
      )}
    </>
  );
  if (world)
    return (
      <LessonPlayfield
        lesson={lesson}
        world={world}
        seconds={seconds}
        index={index}
        paused={phase !== 'playing' || blocked}
        onPause={pause}
        onBack={immersive && !assessment ? requestLeave : undefined}
        race={race}
        challenge={challenge}
        inputArea={
          kind === 'key' ? (
            inputArea
          ) : (
            <>
              {inputForm}
              {inputArea}
            </>
          )
        }
        controls={tools}
        feedback={feedbackContent}
        pauseDialog={pauseDialog}
      />
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
      {lesson.description && <p>{lesson.description}</p>}
      {race}
      {challenge}
      {inputForm}
      {feedbackContent}
      {inputArea}
      {tools}
      {pauseDialog}
    </section>
  );
}
