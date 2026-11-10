import { useEffect, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import { api } from '../../game/backend.js';
import { practiceTime } from '../../game/results.js';
import '../../styles/quest-report.css';
export default function ClassQuestReport({ classId }) {
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [request, setRequest] = useState(0);
  useEffect(() => {
    if (!request) return;
    let live = true;
    setBusy(true);
    setError('');
    api('quest_class_report', undefined, { classId })
      .then((result) => {
        if (live) setData(result.students);
      })
      .catch((failure) => {
        if (live) setError(failure.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [classId, request]);
  return (
    <section className="panel quest-teacher-report">
      <h2>Tiến độ học bàn phím</h2>
      <p>Chỉ giáo viên xem được. Dữ liệu thuộc các thành viên đang hoạt động trong lớp.</p>
      <TipyButton
        emphasis="secondary"
        icon={ChartNoAxesCombined}
        loading={busy}
        onClick={() => setRequest((value) => value + 1)}
      >
        {data ? 'Làm mới' : 'Xem tiến độ'}
      </TipyButton>
      {error && <p role="alert">{error}</p>}
      {data && (
        <div className="report-scroll" role="region" aria-label="Tiến độ học sinh" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Hoàn thành</th>
                <th>Chính xác</th>
                <th>Thời gian luyện</th>
                <th>Cần ôn</th>
                <th>Gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {data.map((student) => (
                <tr key={student.user_id}>
                  <th scope="row">{student.name}</th>
                  <td>{student.completed}/30</td>
                  <td>{student.accuracy === null ? 'Chưa luyện' : student.accuracy + '%'}</td>
                  <td>{practiceTime(student.seconds)}</td>
                  <td>
                    Phím: {student.weakKeys.join(', ') || '—'}
                    <br />
                    Telex: {student.weakRules.join(', ') || '—'}
                  </td>
                  <td>
                    {student.lastPlayed
                      ? new Date(student.lastPlayed).toLocaleDateString('vi-VN')
                      : 'Chưa luyện'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && <p>Lớp chưa có học sinh.</p>}
        </div>
      )}
    </section>
  );
}
