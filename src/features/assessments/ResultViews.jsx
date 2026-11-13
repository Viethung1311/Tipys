import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, RotateCcw } from 'lucide-react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import { SectionResults } from './AssessmentSummary.jsx';

import { dateVN, duration } from './format.js';
export { dateVN, duration } from './format.js';
export function availability(schedule, serverNow) {
  if (schedule?.mode !== 'scheduled') return 'Đang mở';
  const now = Date.parse(serverNow);
  return now < Date.parse(schedule.opensAt)
    ? 'Chưa đến giờ'
    : now >= Date.parse(schedule.closesAt)
      ? 'Đã kết thúc'
      : 'Đang mở';
}
export function Scores({ results = [] }) {
  return results.length
    ? results.map((r) => (
        <div key={r.id}>
          {r.title}:{' '}
          {r.type === 'falling'
            ? `${r.score} điểm`
            : `${r.correct}/${r.total} mục · ${r.accuracy}%`}
        </div>
      ))
    : '—';
}
export function Outcome({ results = [] }) {
  return results
    .filter((r) => r.type === 'falling' && r.targetScore != null)
    .map((r) => (
      <div key={r.id}>
        {r.outcome === 'good' ? 'Hoàn thành tốt' : 'Cần luyện thêm'} · {r.score}/{r.targetScore}{' '}
        điểm
      </div>
    ));
}
export function BestResults({ results = [], field = 'summary' }) {
  if (!results.length) return '—';
  return results.map((r) => (
    <div key={r.id}>
      {results.length > 1 && <strong>{r.title}: </strong>}
      {field === 'time' ? (
        duration(results.length > 1 ? (r.seconds ?? r.active_seconds) : r.active_seconds)
      ) : field === 'date' ? (
        dateVN(r.submitted_at)
      ) : field === 'outcome' ? (
        <>
          <span>{r.completed ? 'Hoàn thành phần' : 'Chưa hoàn thành phần'}</span>
          <Outcome results={[r]} />
        </>
      ) : (
        <>
          <Scores results={[r]} />
          <p>
            Lượt {r.attempt_number} ·{' '}
            {duration(results.length > 1 ? (r.seconds ?? r.active_seconds) : r.active_seconds)} ·{' '}
            {dateVN(r.submitted_at)}
          </p>
          <SectionResults results={[r]} />
          <Outcome results={[r]} />
        </>
      )}
    </div>
  ));
}
export function ResultBanner({ attempt, celebrate = false }) {
  if (!attempt?.submitted_at) return null;
  const good = attempt.results?.some((r) => r.outcome === 'good');
  return (
    <section
      className={`assessment-outcome ${good ? 'assessment-outcome--good' : ''} ${celebrate && good ? 'assessment-congratulations' : ''}`}
    >
      <h2>
        {good
          ? 'Hoàn thành tốt'
          : attempt.results?.some((r) => r.targetScore != null)
            ? 'Cần luyện thêm'
            : 'Đã nộp bài'}
      </h2>
      <Outcome results={attempt.results} />
      {!good && <p>Mỗi lần luyện là thêm tiến bộ. Cố lên nhé!</p>}
      {attempt.closed_reason === 'deadline' && <p>Đã hết giờ. Kết quả được chốt từ phần đã lưu.</p>}
      <p>
        Thời gian làm: {duration(attempt.active_seconds)} · Nộp lúc {dateVN(attempt.submitted_at)}
      </p>
      <SectionResults results={attempt.results} />
    </section>
  );
}
export function AttemptHistory({ assessmentId, student, onClose }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api('assessment_attempts', undefined, {
      assessmentId,
      page,
      ...(student ? { userId: student.user_id } : {}),
    })
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [assessmentId, student?.user_id, page, retry]);
  return (
    <Modal
      className="assessments"
      title={student ? `Kết quả · ${student.full_name}` : 'Kết quả của em'}
      description="Kết quả tốt nhất được xét riêng từng phần, không cộng các thang điểm. Lịch sử từng lượt nằm trong Chi tiết bên dưới."
      onClose={onClose}
    >
      {error ? (
        <p role="alert">
          {error} <TipyButton onClick={() => setRetry((n) => n + 1)}>Thử lại</TipyButton>
        </p>
      ) : !data ? (
        <Loading label="Đang tải kết quả…" />
      ) : (
        <>
          {data.best_sections?.length > 0 && (
            <section>
              <h3>Kết quả tốt nhất</h3>
              <BestResults results={data.best_sections} />
            </section>
          )}
          {!data.items.length && <p>Chưa làm</p>}
          <h3>Chi tiết từng lượt</h3>
          {data.items.map((a, i) => (
            <details key={a.attempt_id} open={i === 0}>
              <summary>
                Lượt {a.attempt_number} · {a.submitted_at ? 'Đã nộp' : 'Đang làm'}
                {page === 1 && i === 0 ? ' · Gần nhất' : ''}
              </summary>
              <p>
                {duration(a.active_seconds)} · {dateVN(a.submitted_at)}
              </p>
              <Outcome results={a.submitted_at ? a.results : []} />
              <SectionResults results={a.results} />
            </details>
          ))}
          <ResultPages data={data} onPage={setPage} />
        </>
      )}
    </Modal>
  );
}
export function ResultPages({ data, onPage, disabled }) {
  const pages = Array.from(
    { length: Math.min(7, data.pages) },
    (_, i) => Math.min(Math.max(1, data.page - 3), Math.max(1, data.pages - 6)) + i,
  );
  return (
    <nav className="assessment-pagination" aria-label="Phân trang kết quả">
      <span>
        {data.total} mục · Trang {data.page}/{data.pages}
      </span>
      <button disabled={disabled || data.page <= 1} onClick={() => onPage(data.page - 1)}>
        Trước
      </button>
      {pages.map((p) => (
        <button
          key={p}
          aria-current={p === data.page ? 'page' : undefined}
          disabled={disabled}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button disabled={disabled || data.page >= data.pages} onClick={() => onPage(data.page + 1)}>
        Sau
      </button>
    </nav>
  );
}
export default function TeacherResults({ exam, classes, onBack }) {
  const [filters, setFilters] = useState({
      search: '',
      classId: 'all',
      status: 'all',
      sort: 'name',
      page: 1,
    }),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [student, setStudent] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    const timer = setTimeout(
      () =>
        api('assessment_results', undefined, { assessmentId: exam.assessment_id, ...filters })
          .then((v) => {
            if (live) setData(v);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [exam.assessment_id, filters, retry]);
  const filter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const retake = async (row) => {
    if (busy) return;
    setBusy(true);
    try {
      await api('assessment_retake', {
        assessmentId: exam.assessment_id,
        userId: row.user_id,
        attemptId: row.latest.attempt_id,
      });
      setRetry((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <TipyButton icon={ArrowLeft} emphasis="secondary" onClick={onBack}>
        Danh sách
      </TipyButton>
      <h3>Kết quả: {exam.title || exam.definition?.title}</h3>
      <p>
        Mỗi học sinh một hàng. Kết quả tốt nhất xét riêng từng phần đã nộp; bằng điểm giữ lượt đạt
        trước. Điểm, thời gian, ngày nộp và kết quả hoàn thành của mỗi phần thuộc cùng lượt. Không
        cộng các thang điểm. Cột Lượt hiện tại vẫn cho biết lượt đang làm. Sắp xếp điểm theo Chữ rơi
        nếu có, nếu không theo phần đầu; sắp xếp thời gian và ngày nộp theo phần đầu.
      </p>
      <div className="assessment-filters">
        <label>
          Tìm học sinh
          <input
            type="search"
            value={filters.search}
            onChange={(e) => filter('search', e.target.value)}
          />
        </label>
        <label>
          Lớp
          <select
            aria-label="Lớp"
            value={filters.classId}
            onChange={(e) => filter('classId', e.target.value)}
          >
            <option value="all">Tất cả lớp</option>
            {classes
              .filter((c) => !c.archived_at)
              .map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Trạng thái"
            value={filters.status}
            onChange={(e) => filter('status', e.target.value)}
          >
            {[
              ['all', 'Tất cả'],
              ['not_started', 'Chưa làm'],
              ['in_progress', 'Đang làm'],
              ['submitted', 'Đã nộp'],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sắp xếp
          <select
            aria-label="Sắp xếp"
            value={filters.sort}
            onChange={(e) => filter('sort', e.target.value)}
          >
            {[
              ['name', 'Tên học sinh'],
              ['score_desc', 'Điểm cao trước'],
              ['score_asc', 'Điểm thấp trước'],
              ['time_asc', 'Thời gian ngắn trước'],
              ['time_desc', 'Thời gian dài trước'],
              ['submitted_desc', 'Nộp gần nhất'],
              ['submitted_asc', 'Nộp sớm nhất'],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>Sắp xếp điểm theo phần Chữ rơi; nếu không có Chữ rơi, dùng độ chính xác phần gõ chữ.</p>
      {error ? (
        <p role="alert">
          {error} <TipyButton onClick={() => setRetry((n) => n + 1)}>Thử lại</TipyButton>
        </p>
      ) : !data ? (
        <Loading label="Đang tải kết quả…" />
      ) : (
        <>
          {!data.items.length ? (
            <p>Chưa có học sinh phù hợp.</p>
          ) : (
            <div className="assessment-table-scroll" tabIndex={0} aria-label="Bảng kết quả">
              <table className="assessment-table">
                <thead>
                  <tr>
                    {[
                      'STT',
                      'Học sinh',
                      'Lớp',
                      'Lượt hiện tại',
                      'Kết quả tốt nhất',
                      'Thời gian',
                      'Thời điểm nộp',
                      'Số lượt',
                      'Kết quả',
                      'Thao tác',
                    ].map((t) => (
                      <th key={t} scope="col">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.user_id}>
                      <td>{row.row_number}</td>
                      <td>
                        {row.full_name}
                        <small>{row.username}</small>
                      </td>
                      <td>{row.classes.map((c) => c.name).join(', ') || 'Chưa có lớp'}</td>
                      <td>
                        {
                          { not_started: 'Chưa làm', in_progress: 'Đang làm', submitted: 'Đã nộp' }[
                            row.attempt_status
                          ]
                        }
                      </td>
                      <td>
                        <Scores results={row.best_sections} />
                      </td>
                      <td>
                        <BestResults results={row.best_sections} field="time" />
                      </td>
                      <td>
                        <BestResults results={row.best_sections} field="date" />
                      </td>
                      <td>{row.attempt_count}</td>
                      <td>
                        <BestResults results={row.best_sections} field="outcome" />
                      </td>
                      <td>
                        <TipyButton icon={Eye} emphasis="secondary" onClick={() => setStudent(row)}>
                          Chi tiết
                        </TipyButton>
                        {row.latest?.submitted_at &&
                          (row.allowed_attempts > row.latest.attempt_number ? (
                            <span>Đã cho làm lại</span>
                          ) : (
                            <TipyButton
                              emphasis="secondary"
                              disabled={busy}
                              onClick={() => retake(row)}
                              icon={RotateCcw}
                            >
                              Cho làm lại
                            </TipyButton>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ResultPages
            data={data}
            onPage={(page) => setFilters((f) => ({ ...f, page }))}
            disabled={busy}
          />
        </>
      )}
      {student && (
        <AttemptHistory
          assessmentId={exam.assessment_id}
          student={student}
          onClose={() => setStudent(null)}
        />
      )}
    </section>
  );
}
