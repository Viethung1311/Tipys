import { useState } from 'react';
import { TEST_CONTENT, TEST_WORLDS, contentMatches } from './content.js';
export default function ContentPicker({ selected, onChange, disabled }) {
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('all');
  const filtered = TEST_CONTENT.filter(
      (item) => contentMatches(item, search) && (topic === 'all' || String(item.world) === topic),
    ),
    chosen = new Set(selected);
  const change = (items, active) => {
    const next = new Set(selected);
    for (const item of items) active ? next.add(item.id) : next.delete(item.id);
    onChange([...next]);
  };
  return (
    <section className="assessment-picker" aria-label="Kho nội dung">
      <h3>Kho nội dung</h3>
      <label>
        Chủ đề
        <select value={topic} disabled={disabled} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">Tất cả chủ đề</option>
          {TEST_WORLDS.map((w) => (
            <option value={w.id} key={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tìm ký tự, từ, câu hoặc bài
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <p role="status">
        Đã chọn {selected.length} mục · {filtered.length} kết quả đang lọc (gồm cả màn thu gọn).
      </p>
      {selected.length > 0 && (
        <details>
          <summary>Danh sách đã chọn ({selected.length})</summary>
          <ol>
            {selected.map((id) => {
              const item = TEST_CONTENT.find((i) => i.id === id);
              return (
                item && (
                  <li key={id}>
                    {item.target === 'Space' ? 'Phím cách' : item.target} · {item.lessonTitle}{' '}
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Bỏ chọn ${item.target} · ${item.lessonTitle}`}
                      onClick={() => change([item], false)}
                    >
                      Bỏ chọn
                    </button>
                  </li>
                )
              );
            })}
          </ol>
        </details>
      )}
      <button
        type="button"
        disabled={disabled || !filtered.length}
        onClick={() => change(filtered, true)}
      >
        Chọn tất cả kết quả đang lọc ({filtered.length})
      </button>
      {!filtered.length && <p>Không tìm thấy nội dung.</p>}
      {TEST_WORLDS.map((world) => {
        const all = TEST_CONTENT.filter((item) => item.world === world.id),
          visible = filtered.filter((item) => item.world === world.id);
        if (!visible.length) return null;
        const lessons = [
          ...new Map(visible.map((item) => [item.lessonId, item.lessonTitle])).entries(),
        ];
        return (
          <details key={world.id} open={search.trim() ? true : undefined}>
            <summary>
              {world.id ? `Màn ${world.id} · ` : ''}
              {world.title} · {all.filter((item) => chosen.has(item.id)).length}/{all.length} đã
              chọn
            </summary>
            <div className="assessment-actions">
              <button type="button" disabled={disabled} onClick={() => change(all, true)}>
                Chọn tất cả trong màn ({all.length})
              </button>
              <button type="button" disabled={disabled} onClick={() => change(all, false)}>
                Bỏ chọn trong màn
              </button>
            </div>
            {lessons.map(([lessonId, title]) => (
              <section key={lessonId}>
                <h4>{title}</h4>
                <div className="assessment-options">
                  {visible
                    .filter((item) => item.lessonId === lessonId)
                    .map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={chosen.has(item.id)}
                          disabled={disabled}
                          onChange={(e) => change([item], e.target.checked)}
                        />
                        <span>
                          {item.prompt ? `${item.prompt} → ` : ''}
                          {item.target === 'Space' ? 'Phím cách' : item.target}
                        </span>
                      </label>
                    ))}
                </div>
              </section>
            ))}
          </details>
        );
      })}
    </section>
  );
}
