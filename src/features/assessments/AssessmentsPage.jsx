import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Send, RotateCcw, Pause } from 'lucide-react';
import PlaySurface, { enterPlayFullscreen } from '../../components/PlaySurface.jsx';
import CompletionScreen, { assessmentSucceeded } from '../../components/CompletionScreen.jsx';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import AssessmentSummary from './AssessmentSummary.jsx';
import { AttemptHistory, availability } from './ResultViews.jsx';
import { assessmentSession } from './session.js';
import { createAnswers } from '../keyboard-quest/engine.js';
import { adventureWorld } from '../keyboard-quest/adventure.js';
import './assessments.css';
const AdminAssessments = lazy(() => import('./AdminAssessments.jsx'));
const LessonPlayer = lazy(() => import('../keyboard-quest/LessonPlayer.jsx'));
const FallingGame = lazy(() => import('../typing/TypingGame.jsx'));
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
  const sending = useRef(false),
    current = useRef({ detail, running });
  current.current = { detail, running, immersive };
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
      old ? { ...old, attempt: row, serverNow: row.server_now || old.serverNow } : old,
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
      api('assessments', undefined, { page })
        .then((data) => {
          if (live) setList(data);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [user?.user_id, page, revision]);
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
          const updated = await api('assessments', undefined, { page });
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
  if (user?.role === 'admin')
    return (
      <main className="assessments-page">
        <Suspense fallback={<Loading label="Đang mở công cụ tạo bài…" />}>
          <AdminAssessments classes={classes} />
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
  const startAttempt = () => {
    if (sending.current) return;
    enterPlayFullscreen();
    setImmersive(true);
    run(async () => {
      try {
        const response = await api('assessment_start', {
          assessmentId: detail.assessment.assessment_id,
        });
        setDetail((old) => ({
          ...old,
          attempt: response.data,
          serverNow: response.data.server_now || old.serverNow,
        }));
        setCelebrate(false);
        setRunning(!response.data.submitted_at);
      } catch (error) {
        setImmersive(Boolean(detail.attempt?.submitted_at));
        throw error;
      }
    });
  };
  const canRetry =
    detail?.attempt?.submitted_at &&
    !closedAtBoundary &&
    detail.assessment.status === 'published' &&
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
            good={assessmentSucceeded(detail.attempt)}
            celebrate={celebrate}
            background={
              adventureWorld(
                detail.assessment.definition.sections.find((s) => s.type === 'quest')?.items?.[0]
                  ?.world || 3,
              ).background.src
            }
            busy={busy}
            onBack={back}
            onRetry={canRetry ? startAttempt : undefined}
          />
        ) : detail ? (
          <>
            <TipyButton icon={ArrowLeft} emphasis="secondary" disabled={busy} onClick={back}>
              Danh sách
            </TipyButton>
            <AssessmentSummary definition={detail.assessment.definition} student>
              <p>Người giao: {detail.assessment.teacher}</p>
              <p>
                <b>{availability(detail.assessment.definition.schedule, detail.serverNow)}</b>
                {detail.assessment.status === 'deleted' ? ' · Bài đã ẩn, không mở lượt mới' : ''}
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
                  icon={Play}
                  loading={busy}
                  disabled={
                    availability(detail.assessment.definition.schedule, detail.serverNow) !==
                      'Đang mở' ||
                    (detail.assessment.status === 'deleted' &&
                      (!detail.attempt || detail.attempt.submitted_at))
                  }
                  onClick={startAttempt}
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
                <p>{exam.description}</p>
                <p>Người giao: {exam.teacher}</p>
                <strong>{statusLabel[exam.attempt_status]}</strong>
                <p>{availability(exam.schedule, exam.server_now)}</p>
                {exam.attempt_status === 'submitted' && (
                  <TipyButton emphasis="secondary" onClick={() => setHistory(exam.assessment_id)}>
                    Kết quả của em
                  </TipyButton>
                )}
                <TipyButton
                  icon={Play}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const data = await api('assessment', undefined, {
                        assessmentId: exam.assessment_id,
                      });
                      setDetail(data);
                      if (data.attempt?.submitted_at) {
                        setImmersive(true);
                        setCelebrate(false);
                      }
                    })
                  }
                >
                  Xem bài
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
  const [partId, setPartId] = useState(null),
    [message, setMessage] = useState('Đã lưu'),
    [failure, setFailure] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [paused, setPaused] = useState(false),
    [exiting, setExiting] = useState(false);
  const writing = useRef(false),
    live = useRef(true);
  const session = useMemo(
    () =>
      assessmentSession(
        exam.assessment_id,
        attempt,
        (text, error = false) => {
          if (live.current) {
            setMessage(text);
            setFailure(error);
            if (error && /không có quyền|Đăng nhập|Bài kiểm tra đã được xóa/.test(text))
              onDenied(text);
          }
        },
        api,
        (row) => {
          if (live.current) onDone(row);
        },
      ),
    [attempt.attempt_id],
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      session.stop();
      session.flush().catch(() => {});
    };
  }, [session]);
  // Monotonic elapsed time drives the UI; the database independently enforces the deadline.
  useEffect(() => {
    if (!attempt.deadline) return;
    const remaining = Date.parse(attempt.deadline) - Date.parse(detail.serverNow);
    const started = performance.now();
    let pending = false,
      retryAt = 0,
      retryDelay = 1000;
    const timer = setInterval(() => {
      if (!pending && performance.now() >= retryAt && performance.now() - started >= remaining) {
        pending = true;
        setBusy(true);
        session
          .flush(true)
          .catch((e) => {
            setMessage(e.message);
            setFailure(true);
            retryDelay = Math.min(retryDelay * 2, 30000);
            retryAt = performance.now() + retryDelay;
          })
          .finally(() => {
            pending = false;
            setBusy(false);
          });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);
  const part = exam.definition.sections.find((section) => section.id === partId);
  const payload = session.payload();
  const complete = exam.definition.sections.every((section) => payload[section.id]?.done);
  const savePart = useCallback(
    (id, value, schedule = true) => {
      session.update(id, value, schedule);
    },
    [session],
  );
  const leave = async () => {
    try {
      await session.flush();
      setPartId(null);
      setVersion((v) => v + 1);
    } catch {}
  };
  const submit = async () => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      await session.flush(true);
    } catch (e) {
      setMessage(e.message);
      setFailure(true);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const requestSubmit = () => {
    if (complete) submit();
    else setConfirm(true);
  };
  // Each adapter is fixed for the mounted section; its engine never writes to practice endpoints.
  const lesson = useMemo(
    () =>
      part?.type === 'quest'
        ? {
            id: `assessment-${exam.assessment_id}`,
            stage: 1,
            world: part.items[0].world || 1,
            title: part.title,
            kind: 'text',
            telex: true,
            threshold: 0,
            items: part.items,
            description: 'Làm từng nội dung theo mẫu. Bấm Nộp bài khi đã sẵn sàng.',
          }
        : null,
    [part],
  );
  const initial = useMemo(
    () => (part ? structuredClone(session.payload()[part.id] || {}) : null),
    [part, session],
  );
  const adapter = useMemo(() => {
    if (!part) return null;
    if (part.type === 'quest') {
      const answers = initial.answers || createAnswers(lesson);
      const update = (rows, seconds) => {
        savePart(part.id, {
          answers: rows,
          seconds,
          done: rows.every((row) => Boolean(row.answer)),
        });
      };
      let lastSeconds = initial.seconds || 0;
      return {
        answers,
        seconds: lastSeconds,
        onChange: update,
        session: {
          ready: Promise.resolve(attempt.attempt_id),
          progress(seconds) {
            const current = session.payload()[part.id] || { answers };
            const checkpoint = seconds - lastSeconds >= 10;
            savePart(
              part.id,
              {
                answers: current.answers,
                seconds,
                done: current.answers.every((row) => Boolean(row.answer)),
              },
              checkpoint,
            );
            if (!checkpoint) return Promise.resolve();
            lastSeconds = seconds;
            return session.flush();
          },
          async finish(seconds, rows) {
            update(rows, seconds);
            await session.flush();
            return { data: { progress: {} } };
          },
          async quit(seconds) {
            const current = session.payload()[part.id] || { answers };
            update(current.answers, Math.max(seconds, current.seconds || 0));
            await session.flush();
          },
        },
      };
    }
    let signature = [
      Math.floor((initial.state?.elapsed || 0) / 10),
      initial.state?.correct || 0,
      initial.state?.wrong || 0,
      initial.state?.missed || 0,
    ].join(':');
    return {
      initial: initial.state,
      onBack: leave,
      onChange(state, done = false, flush = false) {
        const { settings, ...snapshot } = state;
        // An overdue spawn is immediately eligible; persist 0 while keeping strict server bounds.
        snapshot.spawnIn = Math.max(0, snapshot.spawnIn);
        snapshot.countdown = Math.max(0, snapshot.countdown);
        const next = [
          Math.floor(state.elapsed / 10),
          state.correct,
          state.wrong,
          state.missed,
        ].join(':');
        savePart(
          part.id,
          {
            state: snapshot,
            seconds: Math.floor(state.elapsed),
            done: done || state.status === 'result',
          },
          next !== signature || done || flush,
        );
        signature = next;
        if (flush) session.flush().catch(() => {});
      },
    };
  }, [part, initial, session, lesson]);
  return (
    <section className="assessment-runner" data-version={version} data-part-active={Boolean(part)}>
      <header className="assessment-run-header">
        <TipyButton
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
          disabled={busy}
          onClick={() => setPaused(true)}
        >
          Tạm dừng
        </TipyButton>
        <TipyButton icon={Send} loading={busy} onClick={requestSubmit}>
          Nộp bài
        </TipyButton>
      </header>
      <p
        role={failure ? 'alert' : 'status'}
        data-save-state={failure ? 'error' : message === 'Đã lưu' ? 'idle' : 'saving'}
      >
        {message}
        {failure && (
          <TipyButton emphasis="secondary" onClick={() => session.flush().catch(() => {})}>
            Thử lưu lại
          </TipyButton>
        )}
      </p>
      {failure && (
        <p>
          Chưa lưu được thay đổi. Đừng tải lại khi đang lưu; nếu bài đổi ở tab khác, mở lại bài kiểm
          tra.{' '}
          <TipyButton
            emphasis="secondary"
            onClick={() => onDenied('Mở lại bài để lấy dữ liệu mới nhất đã lưu.')}
          >
            Mở lại bài
          </TipyButton>
        </p>
      )}
      <p>
        Tiến độ: {exam.definition.sections.filter((section) => payload[section.id]?.done).length}/
        {exam.definition.sections.length} phần hoàn thành
      </p>
      {part ? (
        <div className="assessment-part-content">
          <Suspense fallback={<Loading label="Đang mở phần kiểm tra…" />}>
            {part.type === 'quest' ? (
              <div
                className="adventure-scene quest-play-scene"
                style={{
                  '--adventure-background': `url("${adventureWorld(lesson.world).background.src}")`,
                }}
              >
                <div className="adventure-content">
                  <LessonPlayer
                    key={part.id}
                    lesson={lesson}
                    world={adventureWorld(lesson.world)}
                    assessment={adapter}
                    immersive
                    externalPaused={paused || exiting || confirm}
                    user={user}
                    sound={sound}
                    blocked={blocked || confirm || busy || failure || paused || exiting}
                    onPlayingChange={onPlayingChange}
                    onBack={leave}
                    onSaved={noop}
                  />
                </div>
              </div>
            ) : (
              <FallingGame
                key={part.id}
                settings={part.settings}
                assessment={adapter}
                externalPaused={paused || exiting || confirm}
                user={user}
                sound={sound}
                audioOpen={blocked || confirm || busy || failure || paused || exiting}
                onPlayingChange={onPlayingChange}
                onFinish={() => false}
                onHome={leave}
                onSetup={leave}
              />
            )}
          </Suspense>
        </div>
      ) : (
        <div className="assessment-section-list">
          {exam.definition.sections.map((section, index) => (
            <article className="panel" key={section.id}>
              <h2>
                Phần {index + 1} · {section.title}
              </h2>
              <p>
                {payload[section.id]?.done
                  ? 'Đã làm xong'
                  : payload[section.id]
                    ? 'Đang làm'
                    : 'Chưa làm'}
              </p>
              {payload[section.id]?.done ? (
                <p>Phần đã kết thúc, không chơi lại trong lượt chính thức này.</p>
              ) : (
                <TipyButton icon={Play} onClick={() => setPartId(section.id)}>
                  {payload[section.id] ? 'Tiếp tục' : 'Bắt đầu phần'}
                </TipyButton>
              )}
            </article>
          ))}
        </div>
      )}
      {confirm && (
        <Modal
          title="Nộp bài chưa làm hết?"
          description="Một số phần hoặc nội dung chưa hoàn thành. Bạn vẫn muốn nộp bài?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <div className="assessment-actions">
            <TipyButton emphasis="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Làm tiếp
            </TipyButton>
            <TipyButton icon={Send} loading={busy} onClick={submit}>
              Nộp bài
            </TipyButton>
          </div>
        </Modal>
      )}
      {paused && !exiting && (
        <Modal
          title="Tạm dừng"
          description="Nội dung đã giữ nguyên. Giờ đóng bài của thầy cô vẫn được áp dụng."
          onClose={() => setPaused(false)}
        >
          <TipyButton icon={Play} onClick={() => setPaused(false)}>
            Tiếp tục
          </TipyButton>
        </Modal>
      )}
      {exiting && (
        <Modal
          title={part ? 'Quay lại các phần?' : 'Quay lại danh sách?'}
          description="Bài đang làm sẽ được lưu. Giờ đóng bài và số lượt làm vẫn theo quy định của thầy cô."
          onClose={() => {
            if (!busy) setExiting(false);
          }}
        >
          <TipyButton emphasis="secondary" disabled={busy} onClick={() => setExiting(false)}>
            Làm tiếp
          </TipyButton>
          <TipyButton
            icon={ArrowLeft}
            loading={busy}
            onClick={async () => {
              if (writing.current) return;
              writing.current = true;
              setBusy(true);
              try {
                await session.flush();
                if (part) {
                  setPartId(null);
                  setExiting(false);
                  setVersion((v) => v + 1);
                } else onExit();
              } catch (error) {
                setMessage(error.message);
                setFailure(true);
                setExiting(false);
              } finally {
                writing.current = false;
                setBusy(false);
              }
            }}
          >
            Quay lại
          </TipyButton>
        </Modal>
      )}
    </section>
  );
}
