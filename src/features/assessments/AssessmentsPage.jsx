import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, RotateCcw, Pause } from 'lucide-react';
import PlaySurface, { enterPlayFullscreen } from '../../components/PlaySurface.jsx';
import CompletionScreen, {
  assessmentSucceeded,
  assessmentCompleted,
} from '../../components/CompletionScreen.jsx';
import { ART as GUARD_ART } from '../keyboard-guard/art.js';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import AssessmentSummary from './AssessmentSummary.jsx';
import { AttemptHistory, availability } from './ResultViews.jsx';
import { assessmentSession, clearAssessmentDraft } from './session.js';
import { createAnswers } from '../keyboard-quest/engine.js';
import { adventureWorld } from '../keyboard-quest/adventure.js';
import { readHub } from '../classroom/hub-cache.js';
import './assessments.css';
const AdminAssessments = lazy(() => import('./AdminAssessments.jsx'));
const LessonPlayer = lazy(() => import('../keyboard-quest/LessonPlayer.jsx'));
const FallingGame = lazy(() => import('../typing/TypingGame.jsx'));
const KeyboardGuard = lazy(() => import('../keyboard-guard/KeyboardGuard.jsx'));
const noop = () => {};
const statusLabel = { not_started: 'Chưa làm', in_progress: 'Đang làm', submitted: 'Đã nộp' };
function Pages({ data, onPage }) {
  return (
    <nav className="assessment-pagination" aria-label="Phân trang bài kiểm tra">
      <span>
        {data.total} bài · Trang {data.page}/{data.pages}
      </span>
      <button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
        Trước
      </button>
      <button disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>
        Sau
      </button>
    </nav>
  );
}

export default function AssessmentsPage({
  user,
  classes = [],
  sound,
  blocked,
  onPlayingChange,
  requestedAssessment,
  classId,
  cache,
}) {
  const [list, setList] = useState(null),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [checking, setChecking] = useState(false);
  const [immersive, setImmersive] = useState(false),
    [closedAtBoundary, setClosedAtBoundary] = useState(false),
    [history, setHistory] = useState(false),
    [celebrate, setCelebrate] = useState(false);
  const celebrated = useRef(new Set());
  const openedRequest = useRef(null);
  const startRequests = useRef(new Map());
  const sending = useRef(false),
    current = useRef({ detail, running });
  current.current = { detail, running, immersive };
  useEffect(() => {
    const updated = ({ detail: change }) => {
      if (change.userId !== user?.user_id || current.current.detail || current.current.running)
        return;
      if (
        change.added?.some(
          (n) => n.kind === 'assessment' && (!classId || n.payload.classId === classId),
        )
      ) {
        if (cache)
          for (const key of cache.keys())
            if (key.startsWith(`${user.user_id}:${classId}:tests:`)) cache.delete(key);
        setRevision((n) => n + 1);
      }
    };
    window.addEventListener('tipy-notifications-updated', updated);
    return () => window.removeEventListener('tipy-notifications-updated', updated);
  }, [user?.user_id, classId, cache]);
  const finished = (row, allowSound = true) => {
    const claim = `tipy-assessment-celebrated:${user?.user_id}:${row.attempt_id}`;
    let claimed = celebrated.current.has(row.attempt_id);
    try {
      claimed ||= sessionStorage.getItem(claim) === '1';
    } catch {}
    if (allowSound && assessmentSucceeded(row) && !claimed) {
      celebrated.current.add(row.attempt_id);
      try {
        sessionStorage.setItem(claim, '1');
      } catch {}
      setCelebrate(true);
      sound?.('record');
    }
    setDetail((old) =>
      old
        ? {
            ...old,
            attempt: row,
            allowedAttempts:
              row.allowedAttempts === undefined ? old.allowedAttempts : row.allowedAttempts,
            serverNow: row.server_now || old.serverNow,
          }
        : old,
    );
    setRunning(false);
    setImmersive(true);
  };
  useEffect(() => {
    let live = true;
    setList(null);
    setDetail(null);
    setRunning(false);
    setImmersive(false);
    setError('');
    setHistory(false);
    setCelebrate(false);
    if (
      user?.role === 'student' &&
      (!requestedAssessment || openedRequest.current === requestedAssessment)
    )
      (cache
        ? readHub(cache, `${user.user_id}:${classId}:tests:${page}:${revision}`, () =>
            api('assessments', undefined, { page, ...(classId && { classId }) }),
          )
        : api('assessments', undefined, { page, ...(classId && { classId }) })
      )
        .then((data) => {
          if (live) setList(data);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [user?.user_id, classId, page, revision]);
  useEffect(() => {
    if (
      user?.role !== 'student' ||
      !requestedAssessment ||
      openedRequest.current === requestedAssessment
    )
      return;
    openedRequest.current = requestedAssessment;
    let live = true;
    setRunning(false);
    setChecking(true);
    setError('');
    setDetail(null);
    api('assessment', undefined, { assessmentId: requestedAssessment.assessmentId })
      .then((value) => {
        if (live) {
          setDetail(value);
          if (value.attempt?.submitted_at) setImmersive(true);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [requestedAssessment, user?.user_id, user?.role]);
  useEffect(() => {
    if (user?.role !== 'student') return;
    let live = true;
    let pending = false;
    const verify = async (background = false) => {
      if (current.current.immersive && background?.type !== 'tipy-class-access-changed') return;
      if (document.hidden || pending) return;
      pending = true;
      if (background !== true) setChecking(true);
      try {
        if (current.current.detail) {
          const assessmentId = current.current.detail.assessment.assessment_id;
          const updated = await api('assessment', undefined, {
            assessmentId,
          });
          if (!live || current.current.detail?.assessment.assessment_id !== assessmentId) return;
          if (
            updated.attempt &&
            current.current.detail?.attempt &&
            updated.attempt.revision < current.current.detail.attempt.revision
          )
            return;
          if (!current.current.running) setDetail(updated);
          else if (updated.attempt?.submitted_at) {
            setDetail(updated);
            setRunning(false);
          }
        } else {
          const updated = await api('assessments', undefined, {
            page,
            ...(classId && { classId }),
          });
          if (live && !current.current.detail) setList(updated);
        }
      } catch (e) {
        if (live && /không có quyền|đăng nhập|Bài kiểm tra đã được xóa/i.test(e.message)) {
          setDetail(null);
          setList(null);
          setHistory(false);
          setRunning(false);
          setError(e.message);
          setImmersive(false);
        } else if (live && !current.current.running) setError(e.message);
      } finally {
        pending = false;
        if (live) setChecking(false);
      }
    };
    window.addEventListener('focus', verify);
    window.addEventListener('tipy-class-access-changed', verify);
    document.addEventListener('visibilitychange', verify);
    // Active attempts already validate access in checkpoints; idle pages refresh on return.
    return () => {
      live = false;
      window.removeEventListener('focus', verify);
      window.removeEventListener('tipy-class-access-changed', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [user?.user_id, user?.role, page]);
  const run = async (task) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e.message);
      if (/không có quyền|đăng nhập|Bài kiểm tra đã được xóa/i.test(e.message)) {
        setDetail(null);
        setHistory(false);
        setRunning(false);
        setList(null);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    setClosedAtBoundary(false);
    const schedule = detail?.assessment.definition.schedule;
    if (schedule?.mode !== 'scheduled' || !detail?.serverNow) return;
    const delay = Date.parse(schedule.closesAt) - Date.parse(detail.serverNow);
    if (delay <= 0) {
      setClosedAtBoundary(true);
      return;
    }
    const end = performance.now() + delay;
    let timer;
    const check = () => {
      const remaining = end - performance.now();
      if (remaining <= 0) setClosedAtBoundary(true);
      else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [detail?.assessment.assessment_id, detail?.serverNow]);
  if (['admin', 'teacher'].includes(user?.role))
    return (
      <main className="assessments-page">
        <Suspense fallback={<Loading label="Đang mở công cụ tạo bài…" />}>
          {user.role === 'teacher' && !classes.length ? (
            <p>Bạn chưa được phân công lớp.</p>
          ) : (
            <AdminAssessments
              key={user.user_id + ':' + classes.map((c) => c.class_id).join(',')}
              classes={classes}
              classId={classId}
              cache={cache}
              ownerId={user.user_id}
            />
          )}
        </Suspense>
      </main>
    );
  const back = () => {
    setImmersive(false);
    setHistory(false);
    setCelebrate(false);
    setDetail(null);
    setRunning(false);
    setRevision((n) => n + 1);
  };
  const remainingAttempts =
    detail?.allowedAttempts === null
      ? null
      : Math.max(0, (detail?.allowedAttempts || 0) - (detail?.attempt?.attempt_number || 0));
  const startAttempt = (selected = detail?.assessment) => {
    if (sending.current || !selected?.assessment_id) return;
    const assessmentId = selected.assessment_id;
    if (!startRequests.current.has(assessmentId))
      startRequests.current.set(assessmentId, crypto.randomUUID());
    enterPlayFullscreen();
    setImmersive(true);
    run(async () => {
      try {
        const { data } = await api('assessment_start', {
          assessmentId,
          requestId: startRequests.current.get(assessmentId),
        });
        startRequests.current.delete(assessmentId);
        if (data.submitted_at) clearAssessmentDraft(user.user_id, assessmentId, data.attempt_id);
        setDetail({
          assessment: data.assessment || { ...selected, definition: data.definition },
          attempt: data,
          allowedAttempts: data.allowedAttempts,
          serverNow: data.server_now,
        });
        setCelebrate(false);
        setRunning(!data.submitted_at);
      } catch (error) {
        setImmersive(Boolean(detail?.attempt?.submitted_at));
        throw error;
      }
    });
  };
  const canRetry =
    detail?.attempt?.submitted_at &&
    !closedAtBoundary &&
    detail.assessment.status === 'published' &&
    !detail.assessment.hidden &&
    availability(detail.assessment.definition.schedule, detail.serverNow) === 'Đang mở' &&
    (detail.allowedAttempts === null || detail.allowedAttempts > detail.attempt.attempt_number);
  return (
    <PlaySurface active={immersive}>
      <main className="assessments-page assessments">
        {!running && !immersive && <h1>Bài kiểm tra</h1>}
        {error && (
          <p role="alert" className="account-error">
            {error}{' '}
            <TipyButton
              emphasis="secondary"
              icon={RotateCcw}
              onClick={() => {
                setError('');
                setRevision((n) => n + 1);
              }}
            >
              Tải lại
            </TipyButton>
          </p>
        )}
        {immersive && busy && !running && !detail?.attempt?.submitted_at ? (
          <Loading label="Đang vào bài kiểm tra…" />
        ) : !user ? (
          <p>Đăng nhập để xem bài thầy cô giao nhé.</p>
        ) : running && detail ? (
          <AssessmentRunner
            key={detail.attempt.attempt_id}
            detail={detail}
            user={user}
            sound={sound}
            blocked={blocked || checking}
            onPlayingChange={onPlayingChange}
            onDone={finished}
            onExit={back}
            onDenied={(message) => {
              setImmersive(false);
              setError(message);
              setDetail(null);
              setList(null);
              setHistory(false);
              setRunning(false);
            }}
          />
        ) : immersive && detail?.attempt?.submitted_at ? (
          <CompletionScreen
            title={
              !assessmentSucceeded(detail.attempt) && assessmentCompleted(detail.attempt)
                ? 'Hoàn thành'
                : undefined
            }
            good={assessmentSucceeded(detail.attempt)}
            celebrate={celebrate}
            background={
              detail.assessment.definition.sections.every((s) => s.type === 'guard')
                ? GUARD_ART.space0.src
                : adventureWorld(
                    detail.assessment.definition.sections.find((s) => s.type === 'quest')
                      ?.items?.[0]?.world || 3,
                  ).background.src
            }
            busy={busy}
            onBack={back}
            scores={detail.attempt.results.map((r) => [
              ['falling', 'guard'].includes(r.type)
                ? r.score + ' điểm'
                : (r.score ?? r.accuracy) + '/100 điểm',
              r.title,
            ])}
            onRetry={canRetry ? () => startAttempt() : undefined}
          />
        ) : detail ? (
          <>
            <TipyButton
              variant="back"
              icon={ArrowLeft}
              emphasis="secondary"
              disabled={busy}
              onClick={back}
            >
              Danh sách
            </TipyButton>
            <AssessmentSummary definition={detail.assessment.definition} student>
              <p>Người giao: {detail.assessment.teacher}</p>
              <p>
                <b>{availability(detail.assessment.definition.schedule, detail.serverNow)}</b>
                {detail.assessment.hidden || detail.assessment.status === 'deleted'
                  ? ' · Đã ẩn, không mở lượt mới'
                  : ''}
              </p>
              <p>
                {remainingAttempts === null
                  ? 'Số lượt còn lại: Không giới hạn'
                  : `Số lượt còn lại: ${remainingAttempts}`}
              </p>
              <TipyButton
                emphasis="secondary"
                onClick={() => setHistory(detail.assessment.assessment_id)}
              >
                Kết quả của em
              </TipyButton>
              {(!detail.attempt?.submitted_at ||
                detail.allowedAttempts === null ||
                detail.allowedAttempts > detail.attempt.attempt_number) && (
                <TipyButton
                  variant="play"
                  icon={Play}
                  loading={busy}
                  disabled={
                    availability(detail.assessment.definition.schedule, detail.serverNow) !==
                      'Đang mở' ||
                    ((detail.assessment.hidden || detail.assessment.status === 'deleted') &&
                      (!detail.attempt || detail.attempt.submitted_at))
                  }
                  onClick={() => startAttempt()}
                >
                  {detail.attempt && !detail.attempt.submitted_at
                    ? 'Tiếp tục'
                    : detail.attempt
                      ? 'Làm lại'
                      : 'Bắt đầu'}
                </TipyButton>
              )}
            </AssessmentSummary>
          </>
        ) : !list ? (
          !error && <Loading label="Đang tải bài kiểm tra…" />
        ) : (
          <>
            {!list.items.length && <p>Chưa có bài kiểm tra nào</p>}
            {list.items.map((exam) => (
              <article className="panel assessment-list-item" key={exam.assessment_id}>
                <h2>{exam.title}</h2>
                {exam.game_titles?.length > 0 && <p>{exam.game_titles.join(' · ')}</p>}
                <p>{exam.description}</p>
                <p>Người giao: {exam.teacher}</p>
                <strong>{statusLabel[exam.attempt_status]}</strong>
                <p>{exam.hidden ? 'Đã ẩn' : availability(exam.schedule, exam.server_now)}</p>
                {exam.attempt_status === 'submitted' && (
                  <TipyButton emphasis="secondary" onClick={() => setHistory(exam.assessment_id)}>
                    Kết quả của em
                  </TipyButton>
                )}
                <TipyButton
                  variant="play"
                  icon={Play}
                  disabled={
                    busy ||
                    availability(exam.schedule, exam.server_now) !== 'Đang mở' ||
                    (exam.hidden && exam.attempt_status !== 'in_progress') ||
                    (exam.attempt_status !== 'in_progress' &&
                      exam.allowedAttempts != null &&
                      exam.attemptNumber >= exam.allowedAttempts)
                  }
                  onClick={() => startAttempt(exam)}
                >
                  {exam.attempt_status === 'in_progress' ? 'Tiếp tục' : 'Bắt đầu'}
                </TipyButton>
              </article>
            ))}
            <Pages data={list} onPage={setPage} />
          </>
        )}
        {history && <AttemptHistory assessmentId={history} onClose={() => setHistory(false)} />}
      </main>
    </PlaySurface>
  );
}

function AssessmentRunner({
  detail,
  user,
  sound,
  blocked,
  onPlayingChange,
  onDone,
  onDenied,
  onExit,
}) {
  const exam = detail.assessment,
    attempt = detail.attempt;
  const [message, setMessage] = useState('Đã giữ trên thiết bị'),
    [failure, setFailure] = useState(false),
    [busy, setBusy] = useState(false),
    [ending, setEnding] = useState(false),
    [paused, setPaused] = useState(false),
    [exiting, setExiting] = useState(false),
    [version, setVersion] = useState(0);
  const live = useRef(true),
    writing = useRef(false);
  const session = useMemo(
    () =>
      assessmentSession(
        exam.assessment_id,
        attempt,
        (text, error = false) => {
          if (!live.current) return;
          setMessage(text);
          setFailure(error);
          if (error && /không có quyền|Đăng nhập|Bài kiểm tra đã được xóa/.test(text))
            onDenied(text);
        },
        api,
        (row) => {
          if (live.current) onDone(row);
        },
        { userId: user.user_id },
      ),
    [attempt.attempt_id],
  );
  const [partId, setPartId] = useState(
    () => exam.definition.sections.find((p) => !session.payload()[p.id]?.done)?.id,
  );
  const finalize = useCallback(async () => {
    if (writing.current) return;
    writing.current = true;
    setEnding(true);
    setBusy(true);
    try {
      await session.flush(true);
    } catch {
      /* The immutable request stays on this device for retry. */
    } finally {
      writing.current = false;
      if (live.current) setBusy(false);
    }
  }, [session]);
  useEffect(() => {
    live.current = true;
    const keep = () => session.keep();
    window.addEventListener('pagehide', keep);
    return () => {
      live.current = false;
      session.stop();
      window.removeEventListener('pagehide', keep);
    };
  }, [session]);
  useEffect(() => {
    if (session.pendingFinal() || !partId) finalize();
  }, [session, partId, finalize]);
  useEffect(() => {
    if (!attempt.deadline) return;
    const deadline =
      performance.now() + Date.parse(attempt.deadline) - Date.parse(detail.serverNow);
    let timer;
    const check = () => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) finalize();
      else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    // The server closes scheduled attempts from its last verified evidence, even if the browser disappears.
    const evidence = setInterval(() => {
      if (!writing.current && !session.pendingFinal()) session.flush().catch(() => {});
    }, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(evidence);
    };
  }, [session, finalize]);
  const savePart = useCallback(
    (id, value) => {
      if (session.payload()[id]?.done) return;
      session.update(id, value);
      if (!value.done || session.pendingFinal()) return;
      const next = exam.definition.sections.find((p) => !session.payload()[p.id]?.done);
      setPartId(next?.id);
      setVersion((v) => v + 1);
    },
    [session, exam],
  );
  const part = exam.definition.sections.find((p) => p.id === partId);
  const lesson = useMemo(
    () =>
      part?.type === 'quest'
        ? {
            id: 'assessment-' + exam.assessment_id,
            stage: 1,
            world: part.items[0].world || 1,
            title: part.title,
            kind: 'text',
            telex: true,
            threshold: 0,
            items: part.items,
            description: 'Làm từng nội dung theo mẫu.',
          }
        : null,
    [part],
  );
  const initial = useMemo(
    () => (part ? structuredClone(session.payload()[part.id] || {}) : {}),
    [part, session],
  );
  const adapter = useMemo(() => {
    if (!part) return null;
    if (part.type === 'guard')
      return {
        section: part,
        attemptId: attempt.attempt_id,
        initial: initial.ticks !== undefined ? initial : undefined,
        onChange: (value) => savePart(part.id, value),
      };
    if (part.type === 'quest') {
      const answers = initial.answers || createAnswers(lesson);
      const update = (rows, seconds) =>
        savePart(part.id, {
          answers: rows,
          seconds,
          done: rows.every((row) => Boolean(row.answer)),
        });
      return {
        answers,
        seconds: initial.seconds || 0,
        onChange: update,
        draft: session.ui(part.id),
        onDraft: (value) => session.setUI(part.id, value),
        session: {
          ready: Promise.resolve(attempt.attempt_id),
          progress(seconds) {
            const current = session.payload()[part.id] || { answers };
            update(current.answers, seconds);
            return Promise.resolve();
          },
          finish(seconds, rows) {
            update(rows, seconds);
            return Promise.resolve({ data: { progress: {} } });
          },
          quit(seconds) {
            const current = session.payload()[part.id] || { answers };
            session.update(part.id, {
              ...current,
              seconds: Math.max(seconds, current.seconds || 0),
            });
            session.keep();
            return Promise.resolve();
          },
        },
      };
    }
    return {
      initial: initial.state,
      onBack: onExit,
      onChange(state, done = false) {
        const { settings, ...snapshot } = state;
        snapshot.spawnIn = Math.max(0, snapshot.spawnIn);
        snapshot.countdown = Math.max(0, snapshot.countdown);
        savePart(part.id, {
          state: snapshot,
          seconds: Math.floor(state.elapsed),
          done: done || state.status === 'result',
        });
      },
    };
  }, [part, initial, lesson, session, savePart]);
  return (
    <section className="assessment-runner" data-version={version} data-part-active={Boolean(part)}>
      <header className="assessment-run-header">
        <TipyButton
          variant="back"
          icon={ArrowLeft}
          emphasis="secondary"
          disabled={busy}
          onClick={() => setExiting(true)}
        >
          Quay lại
        </TipyButton>
        <h1>{exam.definition.title}</h1>
        <TipyButton
          icon={Pause}
          emphasis="secondary"
          disabled={ending}
          onClick={() => setPaused(true)}
        >
          Tạm dừng
        </TipyButton>
      </header>
      <p
        role={failure ? 'alert' : 'status'}
        data-save-state={failure ? 'error' : busy ? 'saving' : 'idle'}
      >
        {message}
        {failure && (
          <TipyButton
            emphasis="secondary"
            disabled={busy}
            onClick={() => (ending ? finalize() : session.flush().catch(() => {}))}
          >
            Thử lại
          </TipyButton>
        )}
      </p>
      {ending || !part ? (
        <Loading label={failure ? 'Chưa lưu được, thử lại' : 'Đang lưu kết quả…'} />
      ) : (
        <div className="assessment-part-content">
          <Suspense fallback={<Loading label="Đang mở phần kiểm tra…" />}>
            {part.type === 'quest' ? (
              <div
                className="adventure-scene quest-play-scene"
                style={{
                  '--adventure-background':
                    'url("' + adventureWorld(lesson.world).background.src + '")',
                }}
              >
                <div className="adventure-content">
                  <LessonPlayer
                    key={part.id}
                    lesson={lesson}
                    world={adventureWorld(lesson.world)}
                    assessment={adapter}
                    immersive
                    externalPaused={paused || exiting}
                    user={user}
                    sound={sound}
                    blocked={blocked || ending || paused || exiting}
                    onPlayingChange={onPlayingChange}
                    onBack={onExit}
                    onSaved={noop}
                  />
                </div>
              </div>
            ) : part.type === 'guard' ? (
              <KeyboardGuard
                key={part.id}
                assessment={adapter}
                session={user}
                externalPaused={blocked || ending || paused || exiting}
                onBack={onExit}
                onPlayingChange={onPlayingChange}
              />
            ) : (
              <FallingGame
                key={part.id}
                settings={{ ...part.settings, targetScore: part.targetScore }}
                assessment={adapter}
                externalPaused={paused || exiting}
                user={user}
                sound={sound}
                audioOpen={blocked || ending || paused || exiting}
                onPlayingChange={onPlayingChange}
                onFinish={() => false}
                onHome={onExit}
                onSetup={onExit}
              />
            )}
          </Suspense>
        </div>
      )}
      {paused && !exiting && (
        <Modal
          title="Tạm dừng"
          description="Nội dung được giữ trên thiết bị. Giờ đóng bài vẫn được áp dụng."
          onClose={() => setPaused(false)}
        >
          <TipyButton variant="play" icon={Play} onClick={() => setPaused(false)}>
            Tiếp tục
          </TipyButton>
        </Modal>
      )}
      {exiting && (
        <Modal
          title="Quay lại danh sách?"
          description="Tiến trình được giữ trên thiết bị này. Giờ đóng bài và số lượt vẫn theo quy định."
          onClose={() => setExiting(false)}
        >
          <TipyButton variant="back" emphasis="secondary" onClick={() => setExiting(false)}>
            Làm tiếp
          </TipyButton>
          <TipyButton
            variant="back"
            icon={ArrowLeft}
            disabled={busy}
            onClick={() => {
              session.keep();
              onExit();
            }}
          >
            Quay lại
          </TipyButton>
        </Modal>
      )}
    </section>
  );
}
