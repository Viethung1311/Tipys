import { LEVELS } from '../../game/config.js';
export default function AssessmentSummary({ definition, student = false }) {
  const total = definition.sections.reduce(
    (n, section) =>
      n + (section.type === 'quest' ? section.items.length : section.settings.keys.length),
    0,
  );
  return (
    <div className="assessment-summary">
      <h2>{definition.title}</h2>
      <p>{definition.description || 'Cùng thử sức nhé!'}</p>
      <h3>Cách chơi</h3>
      <p>{definition.instructions || 'Làm từng phần, sau đó bấm Nộp bài.'}</p>
      {!student && (
        <>
          <h3>Nơi nhận</h3>
          <p>{definition.targetNames?.join(', ') || 'Chưa chọn nơi nhận'}</p>
        </>
      )}
      <p>
        Tổng mục đã chọn: <b>{total}</b>
      </p>
      {definition.sections.map((section) => (
        <section className="assessment-section-card" key={section.id}>
          <h3>{section.title}</h3>
          {section.type === 'falling' ? (
            <>
              <p>
                Mức {LEVELS[section.settings.difficulty].name} · {section.settings.keys.length} phím
              </p>
              <p>Bộ phím: {section.settings.keys.join(' · ')}</p>
              <p>Gõ đúng +10 điểm. Mất 3 mạng hoặc sai lần thứ 6 sẽ kết thúc phần này.</p>
            </>
          ) : (
            <>
              <p>{section.items.length} nội dung · Gõ theo mẫu, giữ đúng dấu và khoảng trắng.</p>
              <details>
                <summary>Xem nội dung đã chọn</summary>
                <ol>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      {item.prompt ? `${item.prompt} → ` : ''}
                      {item.target === 'Space' ? 'Phím cách' : item.target}
                      <small> · {item.lessonTitle}</small>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </section>
      ))}
      {!definition.sections.length && <p>Chưa chọn nội dung. Chỉnh sửa trước khi gửi nhé.</p>}
      <p className="muted">
        Kết quả kiểm tra lưu riêng, không cộng sao hoặc điểm xếp hạng luyện tập.
      </p>
    </div>
  );
}

export function SectionResults({ results = [] }) {
  return (
    <div className="assessment-results">
      {results.map((result) => (
        <section key={result.id}>
          <h4>{result.title}</h4>
          <p>
            {result.completed ? 'Hoàn thành phần' : 'Chưa hoàn thành phần'} · {result.seconds} giây
          </p>
          <p>
            {result.correct} đúng · {result.wrong} sai · {result.accuracy}% chính xác
          </p>
          {result.type === 'falling' ? (
            <p>
              {result.score} điểm · {result.missed} chữ bỏ lỡ
            </p>
          ) : (
            <p>
              Đã làm {result.answered}/{result.total} mục
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
