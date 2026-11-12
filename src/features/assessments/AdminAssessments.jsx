import { useEffect, useRef, useState } from 'react';
import { Plus, Eye, Send, ArrowLeft, Copy, ChartColumn, Save } from 'lucide-react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import ContentPicker from './ContentPicker.jsx';
import AssessmentSummary, { SectionResults } from './AssessmentSummary.jsx';
import useStudentsPage from '../admin/useStudentsPage.js';
import Pagination from '../admin/Pagination.jsx';
import { LEVELS, PRESETS, SUPPORTED_KEYS } from '../../game/config.js';
import '../admin/students.css';
import './assessments.css';
const empty = () => ({
  assessmentId: crypto.randomUUID(),
  version: 0,
  title: '',
  description: '',
  instructions: '',
  targets: { classIds: [], userIds: [] },
  selection: { questIds: [], falling: null },
});
const editOf = (exam) => ({
  assessmentId: exam.assessment_id,
  version: exam.version,
  ...exam.definition,
});
function Recipients({ draft, setDraft, classes, busy }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState('');
  const { data, loading, error } = useStudentsPage({
    page,
    search,
    classFilter: 'all',
    sort: 'desc',
  });
  const choose = (key, id, active) =>
    setDraft((old) => ({
      ...old,
      targets: {
        ...old.targets,
        [key]: active
          ? [...new Set([...old.targets[key], id])]
          : old.targets[key].filter((value) => value !== id),
      },
    }));
  return (
    <fieldset disabled={busy}>
      <legend>Nơi nhận bài</legend>
      <p>
        Lớp: giao cho các thành viên hiện có lúc gửi. Học sinh cần còn trong lớp để mở bài; chọn
        riêng học sinh thì vẫn được mở độc lập.
      </p>
      <div className="assessment-options">
        {classes
          .filter((c) => !c.archived_at)
          .map((c) => (
            <label key={c.class_id}>
              <input
                type="checkbox"
                checked={draft.targets.classIds.includes(c.class_id)}
                onChange={(e) => choose('classIds', c.class_id, e.target.checked)}
              />
              {c.name}
            </label>
          ))}
      </div>
      {!classes.some((c) => !c.archived_at) && <p>Chưa có lớp đang hoạt động.</p>}
      <label>
        Tìm học sinh nhận riêng
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <p>Đã chọn riêng {draft.targets.userIds.length} học sinh, giữ lựa chọn khi đổi trang.</p>
      {loading ? (
        <Loading label="Đang tải học sinh…" />
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <div className="assessment-options">
            {data?.students.map((student) => (
              <label key={student.user_id}>
                <input
                  type="checkbox"
                  checked={draft.targets.userIds.includes(student.user_id)}
                  onChange={(e) => choose('userIds', student.user_id, e.target.checked)}
                />
                {student.full_name} · {student.username}
              </label>
            ))}
          </div>
          {data && <Pagination {...data} onPage={setPage} disabled={busy} />}
        </>
      )}
    </fieldset>
  );
}
export default function AdminAssessments({ classes = [] }) {
  const [list, setList] = useState(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [draft, setDraft] = useState(null),
    [preview, setPreview] = useState(null),
    [resultExam, setResultExam] = useState(null),
    [results, setResults] = useState(null),
    [resultPage, setResultPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const pending = useRef(null),
    sending = useRef(false);
  useEffect(() => {
    let live = true;
    setList(null);
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
  }, [page, revision]);
  useEffect(() => {
    if (!resultExam) return;
    let live = true;
    setResults(null);
    api('assessment_results', undefined, {
      assessmentId: resultExam.assessment_id,
      page: resultPage,
    })
      .then((data) => {
        if (live) setResults(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [resultExam, resultPage, revision]);
  const run = async (task) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const field = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const back = () => {
    setDraft(null);
    setPreview(null);
    setResultExam(null);
    setResults(null);
    setError('');
    setRevision((n) => n + 1);
  };
  const save = () =>
    run(async () => {
      const serialized = JSON.stringify(draft);
      if (pending.current?.serialized !== serialized)
        pending.current = { serialized, requestId: crypto.randomUUID() };
      const response = await api('assessment_save', {
        ...draft,
        requestId: pending.current.requestId,
      });
      setDraft(editOf(response.data));
      setPreview(response.data);
      pending.current = null;
    });
  const open = (exam) =>
    run(async () => {
      const data = await api('assessment', undefined, { assessmentId: exam.assessment_id });
      setPreview(data.assessment);
      setDraft(editOf(data.assessment));
    });
  return (
    <section className="assessments admin-assessments">
      <div className="section-heading">
        <h2>Bài kiểm tra</h2>
        {!draft && !resultExam && (
          <TipyButton
            icon={Plus}
            onClick={() => {
              setDraft(empty());
              setError('');
            }}
          >
            Tạo mới
          </TipyButton>
        )}
      </div>
      {error && (
        <p className="account-error" role="alert">
          {error}{' '}
          <TipyButton
            emphasis="secondary"
            onClick={() => {
              setError('');
              setRevision((n) => n + 1);
            }}
          >
            Tải lại
          </TipyButton>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {resultExam ? (
        <>
          <TipyButton icon={ArrowLeft} emphasis="secondary" onClick={back}>
            Danh sách
          </TipyButton>
          <h3>Kết quả: {resultExam.title || resultExam.definition?.title}</h3>
          {!results ? (
            !error && <Loading label="Đang tải kết quả…" />
          ) : (
            <>
              {!results.items.length && <p>Chưa có học sinh.</p>}
              {results.items.map((student) => (
                <article className="panel" key={student.user_id}>
                  <h3>
                    {student.full_name} · {student.username}
                  </h3>
                  {!student.attempts.length ? (
                    <p>Chưa làm</p>
                  ) : (
                    student.attempts.map((attempt) => (
                      <details key={attempt.attempt_id} open={attempt === student.attempts[0]}>
                        <summary>
                          Lượt {attempt.attempt_number} ·{' '}
                          {attempt.submitted_at ? 'Đã nộp' : 'Đang làm'} · {attempt.active_seconds}{' '}
                          giây
                        </summary>
                        {attempt.submitted_at && (
                          <p>Nộp lúc {new Date(attempt.submitted_at).toLocaleString('vi-VN')}</p>
                        )}
                        <SectionResults results={attempt.results} />
                      </details>
                    ))
                  )}
                  {student.attempts[0]?.submitted_at &&
                    (student.allowed_attempts > student.attempts[0].attempt_number ? (
                      <p>Đã cho làm lại</p>
                    ) : (
                      <TipyButton
                        emphasis="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api('assessment_retake', {
                              assessmentId: resultExam.assessment_id,
                              userId: student.user_id,
                              attemptId: student.attempts[0].attempt_id,
                            });
                            setNotice(`Đã cho ${student.full_name} làm lại.`);
                            setRevision((n) => n + 1);
                          })
                        }
                      >
                        Cho làm lại
                      </TipyButton>
                    ))}
                </article>
              ))}
              <TestPagination data={results} onPage={setResultPage} disabled={busy} />
            </>
          )}
        </>
      ) : preview ? (
        <>
          <AssessmentSummary definition={preview.definition} />
          <div className="assessment-actions">
            <TipyButton icon={ArrowLeft} emphasis="secondary" disabled={busy} onClick={back}>
              Danh sách
            </TipyButton>
            {preview.status === 'draft' ? (
              <>
                <TipyButton
                  icon={Save}
                  emphasis="secondary"
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  Chỉnh sửa
                </TipyButton>
                <TipyButton
                  icon={Send}
                  loading={busy}
                  disabled={
                    !preview.definition.sections.length ||
                    (!preview.definition.targets.classIds.length &&
                      !preview.definition.targets.userIds.length)
                  }
                  onClick={() =>
                    run(async () => {
                      const response = await api('assessment_publish', {
                        assessmentId: preview.assessment_id,
                        version: preview.version,
                      });
                      setPreview(response.data);
                      setNotice('Đã gửi bài kiểm tra cho học sinh.');
                    })
                  }
                >
                  Gửi bài
                </TipyButton>
              </>
            ) : (
              <TipyButton
                icon={Copy}
                onClick={() => {
                  setDraft({
                    ...editOf(preview),
                    assessmentId: crypto.randomUUID(),
                    version: 0,
                    title: `${preview.definition.title.slice(0, 88)} (bản mới)`,
                  });
                  setPreview(null);
                }}
              >
                Tạo bản mới
              </TipyButton>
            )}
          </div>
        </>
      ) : draft ? (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset disabled={busy}>
            <legend>Thông tin bài</legend>
            <label>
              Tên bài kiểm tra
              <input
                required
                maxLength={100}
                value={draft.title}
                onChange={(e) => field('title', e.target.value)}
              />
            </label>
            <label>
              Giới thiệu
              <textarea
                maxLength={1000}
                rows={3}
                value={draft.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </label>
            <label>
              Cách chơi
              <textarea
                maxLength={2000}
                rows={3}
                value={draft.instructions}
                onChange={(e) => field('instructions', e.target.value)}
              />
            </label>
          </fieldset>
          <Recipients draft={draft} setDraft={setDraft} classes={classes} busy={busy} />
          <fieldset disabled={busy}>
            <legend>Các phần chơi</legend>
            <label className="assessment-check">
              <input
                type="checkbox"
                checked={Boolean(draft.selection.falling)}
                onChange={(e) =>
                  field('selection', {
                    ...draft.selection,
                    falling: e.target.checked
                      ? { difficulty: 'easy', keys: ['A', 'S', 'D', 'F'] }
                      : null,
                  })
                }
              />
              Thêm phần Chữ rơi
            </label>
            {draft.selection.falling && (
              <>
                <label>
                  Độ khó
                  <select
                    value={draft.selection.falling.difficulty}
                    onChange={(e) =>
                      field('selection', {
                        ...draft.selection,
                        falling: { ...draft.selection.falling, difficulty: e.target.value },
                      })
                    }
                  >
                    {Object.entries(LEVELS).map(([key, level]) => (
                      <option value={key} key={key}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>Chữ rơi dùng phím đơn: A–Z, số và dấu câu; không dùng từ/câu dài.</p>
                <div className="assessment-actions">
                  {Object.entries(PRESETS).map(([name, keys]) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() =>
                        field('selection', {
                          ...draft.selection,
                          falling: { ...draft.selection.falling, keys },
                        })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="assessment-options">
                  {[...SUPPORTED_KEYS].map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={draft.selection.falling.keys.includes(key)}
                        onChange={(e) =>
                          field('selection', {
                            ...draft.selection,
                            falling: {
                              ...draft.selection.falling,
                              keys: e.target.checked
                                ? [...draft.selection.falling.keys, key]
                                : draft.selection.falling.keys.filter((k) => k !== key),
                            },
                          })
                        }
                      />
                      {key}
                    </label>
                  ))}
                </div>
              </>
            )}
            <ContentPicker
              selected={draft.selection.questIds}
              disabled={busy}
              onChange={(questIds) => field('selection', { ...draft.selection, questIds })}
            />
          </fieldset>
          <div className="assessment-actions">
            <TipyButton emphasis="secondary" icon={ArrowLeft} disabled={busy} onClick={back}>
              Danh sách
            </TipyButton>
            <TipyButton type="submit" icon={Eye} loading={busy} loadingLabel="Đang lưu nháp…">
              Xem trước
            </TipyButton>
          </div>
        </form>
      ) : !list ? (
        !error && <Loading label="Đang tải bài kiểm tra…" />
      ) : (
        <>
          {!list.items.length && <p>Chưa có bài kiểm tra nào</p>}
          {list.items.map((exam) => (
            <article className="panel assessment-list-item" key={exam.assessment_id}>
              <h3>{exam.title}</h3>
              <p>
                {exam.status === 'draft' ? 'Nháp' : 'Đã gửi'} · {exam.teacher}
              </p>
              <p>{exam.description}</p>
              <div className="assessment-actions">
                <TipyButton
                  icon={Eye}
                  emphasis="secondary"
                  disabled={busy}
                  onClick={() => open(exam)}
                >
                  {exam.status === 'draft' ? 'Sửa / Xem trước' : 'Xem bài'}
                </TipyButton>
                {exam.status === 'published' && (
                  <TipyButton
                    icon={ChartColumn}
                    disabled={busy}
                    onClick={() => {
                      setResultPage(1);
                      setResultExam(exam);
                    }}
                  >
                    Xem kết quả
                  </TipyButton>
                )}
              </div>
            </article>
          ))}
          <TestPagination data={list} onPage={setPage} disabled={busy} />
        </>
      )}
    </section>
  );
}
export function TestPagination({ data, onPage, disabled }) {
  return (
    <nav className="assessment-pagination" aria-label="Phân trang bài kiểm tra">
      <span>
        {data.total} mục · Trang {data.page}/{data.pages}
      </span>
      <button disabled={disabled || data.page <= 1} onClick={() => onPage(data.page - 1)}>
        Trước
      </button>
      <button disabled={disabled || data.page >= data.pages} onClick={() => onPage(data.page + 1)}>
        Sau
      </button>
    </nav>
  );
}
