import { ROWS } from '../game/config.js';
export default function Keyboard({ keys, onKey, editing = false, lastKey, disabled = false }) {
  return (
    <div
      className={`keyboard ${editing ? 'picker' : 'touchboard'}`}
      aria-label={editing ? 'Chọn phím luyện tập' : 'Bàn phím cảm ứng'}
    >
      {ROWS.map((row) => (
        <div className="key-row" key={row}>
          {[...row].map((key) => (
            <button
              type="button"
              key={key}
              aria-label={`${editing ? 'Chọn phím' : 'Gõ'} ${key}`}
              aria-pressed={editing ? keys.includes(key) : undefined}
              disabled={disabled || (!editing && !keys.includes(key))}
              className={`key ${keys.includes(key) ? 'selected' : ''} ${lastKey === key ? 'lit' : ''}`}
              onPointerDown={(e) => {
                if (!editing) {
                  e.preventDefault();
                  if (e.button === 0) onKey(key);
                }
              }}
              onClick={(e) => {
                if (editing || e.detail === 0) onKey(key);
              }}
            >
              {key}
              <span>{['F', 'J'].includes(key) ? '−' : ''}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
