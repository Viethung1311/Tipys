import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import ContentPicker from './ContentPicker.jsx';
import { guardAssessmentDefaults, guardAssessmentError } from '../keyboard-guard/assessment.js';
import { defaultGuardSettings, validGuardSettings } from '../keyboard-guard/settings.js';
import { TEST_CONTENT } from './content.js';

export default function GuardAssessmentEditor({ value, onChange, disabled, onPending }) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const cached = useRef(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const enable = async () => {
    onPending?.(true);
    setLoading(true);
    setError('');
    try {
      const game = cached.current || (await api('guard_config')).game;
      if (!validGuardSettings(game.config)) throw new Error('Chưa đọc được cấu hình game.');
      cached.current = game;
      if (alive.current) onChange(guardAssessmentDefaults(game.config));
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) {
        setLoading(false);
        onPending?.(false);
      }
    }
  };
  const update = (key, next) => onChange({ ...value, [key]: next });
  const items = TEST_CONTENT.filter((i) => value?.ids.includes(i.id));
  const validation = value && guardAssessmentError(value, items);
  return (
    <section className="assessment-section-card" aria-label="Cấu hình bài Vệ binh bàn phím">
      <label>
        <input
          type="checkbox"
          disabled={disabled || loading}
          checked={Boolean(value) || loading}
          onChange={(e) => (e.target.checked ? enable() : onChange(null))}
        />{' '}
        Thêm Vệ binh bàn phím
      </label>
      {loading && <p role="status">Đang đọc cấu hình game…</p>}
      {error && <p role="alert">{error}</p>}
      {value && (
        <fieldset disabled={disabled}>
          <legend>Vệ binh bàn phím · Cấu hình riêng của bài</legend>
          <label>
            Số đợt
            <select
              aria-label="Số đợt"
              value={value.waves.length}
              onChange={(e) => {
                const defaults = guardAssessmentDefaults(
                  cached.current?.config || defaultGuardSettings(),
                );
                update(
                  'waves',
                  Array.from(
                    { length: Number(e.target.value) },
                    (_, i) => value.waves[i] || defaults.waves[i],
                  ),
                );
              }}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} đợt
                </option>
              ))}
            </select>
          </label>
          {value.waves.map((wave, index) => (
            <fieldset key={index}>
              <legend>Đợt {index + 1}</legend>
              {[
                ['totalTargets', 'Số thiên thạch', 1, 100, 1],
                ['speed', 'Tốc độ (%)', 50, 300, 1],
                ['maxActive', 'Tối đa cùng lúc', 1, Math.min(6, wave.totalTargets), 1],
                ['spawnSeconds', 'Khoảng xuất hiện (giây)', 0.5, 10, 0.1],
                ['fps', 'Nhịp hoạt ảnh (FPS)', 6, 24, 1],
              ].map(([key, label, min, max, step]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    required
                    min={min}
                    max={max}
                    step={step}
                    value={wave[key]}
                    onChange={(e) =>
                      update(
                        'waves',
                        value.waves.map((w, i) =>
                          i === index ? { ...w, [key]: Number(e.target.value) } : w,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
          <label>
            Thứ tự nội dung
            <select value={value.order} onChange={(e) => update('order', e.target.value)}>
              <option value="sequential">Tuần tự theo danh sách đã chọn</option>
              <option value="random">Ngẫu nhiên</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={value.repeat}
              onChange={(e) => update('repeat', e.target.checked)}
            />
            Cho phép lặp nội dung
          </label>
          {['passScore', 'goodScore'].map((key) => (
            <label key={key}>
              {key === 'passScore' ? 'Điểm đạt' : 'Điểm hoàn thành tốt'}
              <input
                type="number"
                required
                min="0"
                max={value.waves.reduce((n, w) => n + w.totalTargets, 0) * 10}
                step="1"
                value={value[key]}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </label>
          ))}
          <ContentPicker
            selected={value.ids}
            onChange={(ids) => update('ids', ids)}
            disabled={disabled}
          />
          {validation && <p role="alert">{validation}</p>}
          <p>
            Chỉ áp dụng trong bài kiểm tra này. Nội dung được giao không yêu cầu học sinh mở khóa
            chủ đề ở chế độ tự do.
          </p>
        </fieldset>
      )}
    </section>
  );
}
