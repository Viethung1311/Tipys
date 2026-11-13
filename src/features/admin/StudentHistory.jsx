import useStudentsPage from './useStudentsPage.js';
import Pagination from './Pagination.jsx';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { api, clearApiCache } from '../../game/backend.js';
import { practiceTime } from '../../game/results.js';
import ResultsTable from '../../components/ResultsTable.jsx';
import Loading from '../../components/Loading.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import StudentActionDialog from './StudentActionDialog.jsx';

/** Only existing best/latest snapshots are available, not a per-play timeline. */
export default function StudentHistory({
  students,
  studentId,
  onStudentChange,
  catalog = [],
  onReset,
}) {
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [gameId, setGameId] = useState('');
  const [resetting, setResetting] = useState(false),
    [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const { data: choices, loading: finding, error: choiceError } = useStudentsPage({ page, search });
  const selected = useRef(null);
  const student =
    [...students, ...(choices?.students || [])].find((row) => row.user_id === studentId) ||
    (selected.current?.user_id === studentId ? selected.current : null);
  selected.current = student;
  const options = [
    ...new Map(
      [...(student ? [student] : []), ...(choices?.students || students)].map((row) => [
        row.user_id,
        row,
      ]),
    ).values(),
  ];
  useEffect(() => {
    if (!studentId || !student) return;
    let live = true;
    setLoading(true);
    setError('');
    setResult(null);
    api('history', undefined, { userId: studentId })
      .then((data) => {
        if (live) setResult({ userId: studentId, rows: data.history });
      })
      .catch((error) => {
        if (live) setError(error.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [studentId, !!student, revision]);
  const rows = result?.userId === studentId ? result.rows : [];
  const games = [...new Map(rows.map((row) => [row.game_id, row.games.game_name])).entries()];
  const resetGames = catalog.length
    ? catalog
    : games.map(([game_id, game_name]) => ({ game_id, game_name }));
  return (
    <section className="panel student-history" aria-labelledby="student-history-heading">
      <h2 id="student-history-heading">Lịch sử chơi của học sinh</h2>
      <p className="muted">
        Chỉ giữ kết quả cao nhất và gần nhất cho mỗi trò chơi. Một lượt trùng cả hai chỉ hiện một
        dòng. Không có lịch sử chi tiết từng lượt.
      </p>
      <div className="history-filters">
        <label>
          Tìm học sinh
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {finding && <p role="status">Đang tìm học sinh…</p>}
        {choiceError && <p role="alert">{choiceError}</p>}
        {choices && <Pagination {...choices} onPage={setPage} disabled={finding} />}
        <label>
          Chọn học sinh
          <select
            value={studentId}
            onChange={(event) => {
              onStudentChange(event.target.value);
              setGameId('');
            }}
          >
            <option value="">Chọn học sinh…</option>
            {options.map((item) => (
              <option key={item.user_id} value={item.user_id}>
                {item.full_name} · {item.username}
                {item.is_active ? '' : ' · Đã khóa'}
              </option>
            ))}
          </select>
        </label>
        {student && (
          <label>
            Trò chơi
            <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
              <option value="">Tất cả trò chơi</option>
              {games.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {student && (
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            loading={loading}
            loadingLabel="Đang tải…"
            onClick={() => {
              clearApiCache();
              setRevision((value) => value + 1);
            }}
          >
            Làm mới kết quả
          </TipyButton>
        )}
        {student && (
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            disabled={loading || !resetGames.length}
            onClick={() => {
              setNotice('');
              setResetting(true);
            }}
          >
            Làm lại từ đầu
          </TipyButton>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {!students.length ? (
        <p className="empty-state">Chưa có học sinh.</p>
      ) : !student ? (
        <p className="empty-state">Chọn một học sinh để xem kết quả luyện tập.</p>
      ) : (
        <>
          <div className="history-summary">
            <strong>{student.full_name}</strong>
            <span>
              Tổng thời gian luyện: <b>{practiceTime(student.total_active_seconds)}</b>
            </span>
            <span>
              Tổng lượt: <b>{student.total_plays}</b>
            </span>
          </div>
          {loading ? (
            <Loading label="Đang tải kết quả…" />
          ) : error ? (
            <div className="account-error" role="alert">
              {error}
              <TipyButton
                emphasis="secondary"
                icon={RotateCcw}
                onClick={() => setRevision((value) => value + 1)}
              >
                Thử lại
              </TipyButton>
            </div>
          ) : result?.userId === studentId ? (
            <ResultsTable rows={gameId ? rows.filter((row) => row.game_id === gameId) : rows} />
          ) : null}
        </>
      )}
      {resetting && student && (
        <StudentActionDialog
          kind="reset"
          student={student}
          games={resetGames}
          initialGameId={gameId}
          onClose={() => setResetting(false)}
          onDone={(data) => {
            setResetting(false);
            setResult(null);
            setRevision((n) => n + 1);
            setNotice(
              `Đã đặt lại trò chơi. Thu hồi ${data.revokedStars} sao bài học; giữ nguyên thời gian luyện tích lũy.`,
            );
            onReset?.(student.user_id, data);
          }}
        />
      )}
    </section>
  );
}
