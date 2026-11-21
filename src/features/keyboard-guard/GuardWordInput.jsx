import { useEffect, useRef } from 'react';
const messages = {
  empty: 'Gõ từ để bắn',
  correct: 'Tiếp tục gõ…',
  wrong: 'Chưa đúng. Em sửa bằng Backspace nhé.',
  composing: 'Đang ghép dấu…',
  fired: 'Đã bắn!',
  'lost-target': 'Mục tiêu đã qua. Gõ từ khác nhé.',
};
export default function GuardWordInput({ value, feedback, disabled, onValue }) {
  const input = useRef(null),
    composing = useRef(false),
    skip = useRef(null),
    cancelled = useRef(false);
  useEffect(() => {
    if (feedback === 'lost-target' && composing.current) cancelled.current = true;
  }, [feedback]);
  useEffect(() => {
    if (!disabled) input.current?.focus({ preventScroll: true });
  }, [disabled]);
  return (
    <>
      <input
        ref={input}
        aria-label="Gõ từ để bắn"
        value={value}
        disabled={disabled}
        maxLength={80}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Gõ từ ở đây"
        inputMode="text"
        onCompositionStart={() => {
          cancelled.current = false;
          composing.current = true;
        }}
        onCompositionUpdate={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          skip.current = e.currentTarget.value;
          if (cancelled.current) {
            cancelled.current = false;
            onValue('', { composing: false });
            return;
          }
          onValue(e.currentTarget.value, { composing: false });
        }}
        onChange={(e) => {
          if (cancelled.current) return;
          const text = e.currentTarget.value;
          if (!composing.current && skip.current === text) {
            skip.current = null;
            return;
          }
          skip.current = null;
          onValue(text, { composing: composing.current || e.nativeEvent.isComposing });
        }}
        onKeyDown={(e) => {
          if ((e.repeat || e.key === 'Enter') && !e.nativeEvent.isComposing && !composing.current)
            e.preventDefault();
        }}
      />
      <span className="guard-input-feedback" role="status" aria-live="polite">
        {messages[feedback] || messages.empty}
      </span>
    </>
  );
}
