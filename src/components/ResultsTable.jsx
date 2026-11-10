import { resultLabel, resultType, practiceTime } from '../game/results.js';
export default function ResultsTable({ rows }) {
  return (
    <div className="table-scroll" role="region" aria-label="Kết quả luyện tập" tabIndex={0}>
      <table>
        <caption className="sr-only">Kết quả cao nhất và gần nhất đang được giữ lại</caption>
        <thead>
          <tr>
            {[
              'Học sinh',
              'Trò chơi',
              'Kết quả giữ lại',
              'Điểm / chính xác',
              'Thời gian lượt',
              'Tổng luyện tập',
              'Lý do kết thúc',
              'Bắt đầu (VN)',
            ].map((text) => (
              <th key={text}>{text}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.user_id}-${row.game_id}-${row.result_type || row.play_id}`}>
              <td>{row.profiles.full_name}</td>
              <td>{row.games.game_name}</td>
              <td>{resultType(row.result_type)}</td>
              <td>{row.games.game_code === 'keyboard_quest' ? `${row.score}%` : row.score}</td>
              <td>{practiceTime(row.active_seconds)}</td>
              <td>{practiceTime(row.total_active_seconds)}</td>
              <td>{resultLabel(row)}</td>
              <td>
                {new Date(row.started_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty-state">Chưa có kết quả được lưu.</p>}
    </div>
  );
}
