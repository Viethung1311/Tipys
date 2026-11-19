import { useEffect, useRef, useState } from 'react';
import { ROWS, physicalKey, virtualKey } from '../game/config.js';
export default function Keyboard({
  keys,
  onKey,
  editing = false,
  disabled = false,
  targetKey,
  textInput = false,
  extraKeys = [],
  shifted = false,
}) {
  const pointer = useRef(null);
  const [pressed, setPressed] = useState('');
  useEffect(() => {
    if (editing) return;
    const down = (event) => {
      if (!event.isComposing)
        setPressed(event.code === 'Space' ? 'Space' : physicalKey(event.code) || event.key);
    };
    const up = () => setPressed('');
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', up);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', up);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [editing]);
  const rows = [
    ...ROWS,
    ...(textInput ? [['Shift', 'Space', 'Backspace', ...extraKeys, 'Enter']] : []),
  ];
  return (
    <div
      className={`keyboard ${editing ? 'picker' : 'touchboard'}`}
      role="region"
      tabIndex={0}
      aria-label={editing ? 'Chọn phím luyện tập' : 'Bàn phím cảm ứng'}
    >
      {rows.map((row, rowIndex) => (
        <div className="key-row" key={rowIndex}>
          {[...row].map((key) => (
            <button
              type="button"
              key={key}
              aria-label={`${editing ? 'Chọn phím' : 'Gõ'} ${key}`}
              aria-pressed={editing ? keys.includes(key) : undefined}
              disabled={disabled || (!editing && !keys.includes(key) && !textInput)}
              className={`key ${keys.includes(key) || textInput ? 'selected' : ''} ${pressed === key ? 'lit' : ''} ${targetKey === key ? 'quest-target-key' : ''}`}
              onPointerDown={(e) => {
                if (!editing) {
                  e.preventDefault();
                  if (e.button === 0) {
                    setPressed(key);
                    pointer.current = { key, at: performance.now() };
                    onKey(key);
                  }
                }
              }}
              onClick={(e) => {
                if (
                  editing ||
                  (e.detail === 0 &&
                    !(pointer.current?.key === key && performance.now() - pointer.current.at < 700))
                )
                  onKey(key);
                pointer.current = null;
              }}
            >
              {key === 'Space'
                ? 'Cách'
                : key === 'Backspace'
                  ? '⌫'
                  : key === 'Enter'
                    ? '↵'
                    : key === 'Shift'
                      ? '⇧'
                      : textInput
                        ? virtualKey(key, shifted)
                        : key}
              <span>{['F', 'J'].includes(key) ? '−' : ''}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
