import ValidatedForm from '../../components/ValidatedForm.jsx';
import { useEffect, useRef, useState } from 'react';
import { Plus, Eye, Send, ArrowLeft, Copy, ChartColumn, Save, Trash2 } from 'lucide-react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import ContentPicker from './ContentPicker.jsx';
import AssessmentSummary from './AssessmentSummary.jsx';
import TeacherResults from './ResultViews.jsx';
import Modal from '../../components/Modal.jsx';
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
  schedule: { mode: 'always' },
  repeats: { mode: 'none' },
});
const editOf = (exam) => ({
  assessmentId: exam.assessment_id,
  version: exam.version,
  schedule: { mode: 'always' },
  repeats: { mode: 'none' },
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
        Giao cho lớp: cả thành viên hiện tại và các bạn được thêm sau đều nhận bài. Học sinh cần còn
        trong lớp để mở bài; giao riêng thì được mở độc lập.
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
    [deleting, setDeleting] = useState(null),
    [deleteConfirm, setDeleteConfirm] = useState(''),
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

    setError('');
    setRevision((n) => n + 1);
  };
  const save = () => {
    if (draft.selection.falling && !draft.selection.falling.keys.length) {
      setError('Chọn ít nhất một phím cho Chữ rơi.');
      return;
    }
    return run(async () => {
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
  };
  const requestDelete = (exam) => {
    setError('');
    setDeleteConfirm('');
    setDeleting({ ...exam, title: exam.title || exam.definition.title });
  };
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
        <TeacherResults exam={resultExam} classes={classes} onBack={back} />
      ) : preview ? (
        <>
          <AssessmentSummary definition={preview.definition}>
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
              {preview.status !== 'draft' && (
                <TipyButton
                  icon={ChartColumn}
                  disabled={busy}
                  onClick={() => {
                    setResultExam(preview);
                    setDraft(null);
                    setPreview(null);
                  }}
                >
                  Xem kết quả
                </TipyButton>
              )}
              <TipyButton
                icon={Trash2}
                variant="danger"
                emphasis="secondary"
                disabled={busy}
                onClick={() => requestDelete(preview)}
              >
                Xóa vĩnh viễn
              </TipyButton>
            </div>
          </AssessmentSummary>
        </>
      ) : draft ? (
        <ValidatedForm
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
                data-required-text
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
          <fieldset disabled={busy}>
            <legend>Thời gian và lượt làm</legend>
            <label>
              Thời gian mở bài
              <select
                value={draft.schedule.mode}
                onChange={(e) => field('schedule', { ...draft.schedule, mode: e.target.value })}
              >
                <option value="always">Luôn mở để luyện tập</option>
                <option value="scheduled">Theo lịch</option>
              </select>
            </label>
            <p>Ngày giờ Việt Nam. Luôn mở vẫn giới hạn người nhận và số lượt đã chọn.</p>
            {draft.schedule.mode === 'scheduled' && (
              <div className="assessment-filters">
                <label>
                  Giờ mở
                  <input
                    type="datetime-local"
                    required
                    name="opensAt"
                    value={localVN(draft.schedule.opensAt)}
                    onChange={(e) =>
                      field('schedule', {
                        ...draft.schedule,
                        opensAt: e.target.value
                          ? new Date(e.target.value + '+07:00').toISOString()
                          : '',
                      })
                    }
                  />
                </label>
                <label>
                  Giờ kết thúc
                  <input
                    type="datetime-local"
                    required
                    name="closesAt"
                    data-after="opensAt"
                    value={localVN(draft.schedule.closesAt)}
                    onChange={(e) =>
                      field('schedule', {
                        ...draft.schedule,
                        closesAt: e.target.value
                          ? new Date(e.target.value + '+07:00').toISOString()
                          : '',
                      })
                    }
                  />
                </label>
              </div>
            )}
            <label>
              Làm lại
              <select
                value={draft.repeats.mode}
                onChange={(e) =>
                  field('repeats', { mode: e.target.value, extra: draft.repeats.extra || 1 })
                }
              >
                <option value="none">Không cho làm lại</option>
                <option value="limited">Giới hạn số lần</option>
                <option value="unlimited">Không giới hạn</option>
              </select>
            </label>
            {draft.repeats.mode === 'limited' && (
              <label>
                Được làm thêm N lần sau lần đầu
                <input
                  required
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  value={draft.repeats.extra}
                  onChange={(e) =>
                    field('repeats', { ...draft.repeats, extra: Number(e.target.value) })
                  }
                />
                <span>Tổng lượt: {Number(draft.repeats.extra) + 1}</span>
              </label>
            )}
            <p>Bài đã gửi giữ nguyên lịch và luật. Muốn thay đổi, hãy tạo bản mới.</p>
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
                      ? { difficulty: 'easy', keys: ['A', 'S', 'D', 'F'], targetScore: 100 }
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
                <label>
                  Điểm hoàn thành tốt
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={draft.selection.falling.targetScore ?? ''}
                    onChange={(e) =>
                      field('selection', {
                        ...draft.selection,
                        falling: {
                          ...draft.selection.falling,
                          targetScore: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
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
        </ValidatedForm>
      ) : !list ? (
        !error && <Loading label="Đang tải bài kiểm tra…" />
      ) : (
        <>
          {!list.items.length && <p>Chưa có bài kiểm tra nào</p>}
          {list.items.map((exam) => (
            <article className="panel assessment-list-item" key={exam.assessment_id}>
              <h3>{exam.title}</h3>
              <p>
                {exam.status === 'draft'
                  ? 'Nháp'
                  : exam.status === 'deleted'
                    ? 'Đã xóa / Ẩn'
                    : 'Đã gửi'}{' '}
                · {exam.teacher}
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
                {exam.status !== 'draft' && (
                  <TipyButton
                    icon={ChartColumn}
                    disabled={busy}
                    onClick={() => {
                      setResultExam(exam);
                    }}
                  >
                    Xem kết quả
                  </TipyButton>
                )}
                {
                  <TipyButton
                    icon={Trash2}
                    variant="danger"
                    emphasis="secondary"
                    disabled={busy}
                    onClick={() => requestDelete(exam)}
                  >
                    Xóa vĩnh viễn
                  </TipyButton>
                }
              </div>
            </article>
          ))}
          <TestPagination data={list} onPage={setPage} disabled={busy} />
        </>
      )}
      {deleting && (
        <Modal
          className="assessments"
          title="Xóa vĩnh viễn bài kiểm tra?"
          description={`Bài: ${deleting.title}. Xóa toàn bộ nội dung giao bài, người nhận, lượt làm và kết quả của bài này. Không thể khôi phục. Tài khoản, lớp, kho nội dung và kết quả luyện tập được giữ nguyên.`}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <ValidatedForm
            onSubmit={() => {
              if (deleteConfirm === 'accept')
                return run(async () => {
                  const result = await api('assessment_delete', {
                    assessmentId: deleting.assessment_id,
                    title: deleting.title,
                    confirm: deleteConfirm,
                  });
                  if (!result.data?.deleted || !result.data?.permanent)
                    throw Error('Chưa xác nhận được việc xóa vĩnh viễn. Hãy thử lại.');
                  setDeleting(null);
                  setDraft(null);
                  setPreview(null);
                  setResultExam(null);
                  setList(null);
                  setNotice('Đã xóa vĩnh viễn bài kiểm tra và kết quả liên quan.');
                  setRevision((n) => n + 1);
                });
            }}
          >
            <label className="account-field">
              Nhập accept để xác nhận
              <input
                aria-label="Nhập accept để xác nhận"
                data-confirm="accept"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="assessment-actions">
              <TipyButton emphasis="secondary" disabled={busy} onClick={() => setDeleting(null)}>
                Quay lại
              </TipyButton>
              <TipyButton
                icon={Trash2}
                variant="danger"
                disabled={deleteConfirm !== 'accept'}
                loading={busy}
                loadingLabel="Đang xóa…"
                type="submit"
              >
                Xóa vĩnh viễn
              </TipyButton>
            </div>
          </ValidatedForm>
        </Modal>
      )}
    </section>
  );
}
const localVN = (value) =>
  value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : '';
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
