import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Send, RotateCcw } from 'lucide-react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import AssessmentSummary, { SectionResults } from './AssessmentSummary.jsx';
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

export default function AssessmentsPage({ user, classes = [], sound, blocked, onPlayingChange }) {
  const [list, setList] = useState(null),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [checking, setChecking] = useState(false);
  const sending = useRef(false),
    current = useRef({ detail, running });
  current.current = { detail, running };
  const load = useCallback(async () => {
    if (!user || user.role === 'admin') return;
    const data = await api('assessments', undefined, { page });
    setList(data);
  }, [user?.user_id, page]);
  useEffect(() => {
    let live = true;
    setList(null);
    setDetail(null);
    setRunning(false);
    setError('');
    if (user?.role === 'student')
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
    if (user?.role !== 'student') return;
    let live = true;
    const verify = async () => {
      if (document.hidden) return;
      setChecking(true);
      try {
        if (current.current.detail) {
          await api('assessment', undefined, {
            assessmentId: current.current.detail.assessment.assessment_id,
          });
        } else await load();
      } catch (e) {
        if (live) {
          setDetail(null);
          setRunning(false);
          setError(e.message);
        }
      } finally {
        if (live) setChecking(false);
      }
    };
    window.addEventListener('focus', verify);
    window.addEventListener('tipy-class-access-changed', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      live = false;
      window.removeEventListener('focus', verify);
      window.removeEventListener('tipy-class-access-changed', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [load, user?.role]);
  const run = async (task) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e.message);
      if (/không có quyền|đăng nhập/i.test(e.message)) {
        setDetail(null);
        setRunning(false);
        setList(null);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  if (user?.role === 'admin')
    return (
      <main className="assessments-page">
        <Suspense fallback={<Loading label="Đang mở công cụ tạo bài…" />}>
          <AdminAssessments classes={classes} />
        </Suspense>
      </main>
    );
  const back = () => {
    setDetail(null);
    setRunning(false);
    setRevision((n) => n + 1);
  };
  return (
    <main className="assessments-page assessments">
      {!running && <h1>Bài kiểm tra</h1>}
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
      {!user ? (
        <p>Đăng nhập để xem bài thầy cô giao nhé.</p>
      ) : running && detail ? (
        <AssessmentRunner
          key={detail.attempt.attempt_id}
          detail={detail}
          user={user}
          sound={sound}
          blocked={blocked || checking}
          onPlayingChange={onPlayingChange}
          onDone={(row) => {
            setDetail((old) => ({ ...old, attempt: row }));
            setRunning(false);
          }}
          onDenied={(message) => {
            setError(message);
            setDetail(null);
            setRunning(false);
          }}
        />
      ) : detail ? (
        <>
          <TipyButton icon={ArrowLeft} emphasis="secondary" disabled={busy} onClick={back}>
            Danh sách
          </TipyButton>
          <AssessmentSummary definition={detail.assessment.definition} student />
          <p>Người giao: {detail.assessment.teacher}</p>
          {detail.attempt?.submitted_at ? (
            <>
              <h3>Đã nộp bài</h3>
              <p>Thời gian làm: {detail.attempt.active_seconds} giây</p>
              <SectionResults results={detail.attempt.results} />
            </>
          ) : null}
          {(!detail.attempt?.submitted_at ||
            detail.allowedAttempts > detail.attempt.attempt_number) && (
            <TipyButton
              icon={Play}
              loading={busy}
              onClick={() =>
                run(async () => {
                  const response = await api('assessment_start', {
                    assessmentId: detail.assessment.assessment_id,
                  });
                  setDetail((old) => ({ ...old, attempt: response.data }));
                  setRunning(true);
                })
              }
            >
              {detail.attempt && !detail.attempt.submitted_at ? 'Tiếp tục' : 'Bắt đầu'}
            </TipyButton>
          )}
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
              <TipyButton
                icon={Play}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const data = await api('assessment', undefined, {
                      assessmentId: exam.assessment_id,
                    });
                    setDetail(data);
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
    </main>
  );
}

function AssessmentRunner({ detail, user, sound, blocked, onPlayingChange, onDone, onDenied }) {
  const exam = detail.assessment,
    attempt = detail.attempt;
  const [partId, setPartId] = useState(null),
    [message, setMessage] = useState('Đã lưu'),
    [failure, setFailure] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const writing = useRef(false),
    live = useRef(true);
  const session = useMemo(
    () =>
      assessmentSession(exam.assessment_id, attempt, (text, error = false) => {
        if (live.current) {
          setMessage(text);
          setFailure(error);
          if (error && /không có quyền|Đăng nhập/.test(text)) onDenied(text);
        }
      }),
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
      const row = await session.flush(true);
      onDone(row);
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
    let signature = '';
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
          state.status,
        ].join(':');
        savePart(
          part.id,
          {
            state: snapshot,
            seconds: Math.floor(state.elapsed),
            done: done || state.status === 'result',
          },
          next !== signature || flush,
        );
        signature = next;
        if (flush) session.flush().catch(() => {});
      },
    };
  }, [part, initial, session, lesson]);
  return (
    <section className="assessment-runner" data-version={version}>
      <header className="assessment-run-header">
        <h1>{exam.definition.title}</h1>
        <TipyButton icon={Send} loading={busy} onClick={requestSubmit}>
          Nộp bài
        </TipyButton>
      </header>
      <p role={failure ? 'alert' : 'status'}>
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
        <>
          <TipyButton icon={ArrowLeft} emphasis="secondary" disabled={busy} onClick={leave}>
            Các phần
          </TipyButton>
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
                    user={user}
                    sound={sound}
                    blocked={blocked || confirm || busy || failure}
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
                user={user}
                sound={sound}
                audioOpen={blocked || confirm || busy || failure}
                onPlayingChange={onPlayingChange}
                onFinish={() => false}
                onHome={leave}
                onSetup={leave}
              />
            )}
          </Suspense>
        </>
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
    </section>
  );
}
