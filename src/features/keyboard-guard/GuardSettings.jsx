import { useRef, useState } from 'react';
import ValidatedForm from '../../components/ValidatedForm.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import {
  defaultGuardSettings,
  loadGuardSettings,
  saveGuardSettings,
  GUARD_LIMITS,
  GUARD_CODE,
  validGuardSettings,
} from './settings.js';
import { api } from '../../game/backend.js';
import { ART } from './art.js';
import { Save, RotateCcw } from 'lucide-react';
import './settings.css';
export default function GuardSettings({
  user,
  initialStage = 1,
  initialWave = 1,
  localOnly = false,
  game,
  onSaved,
}) {
  const [draft, setDraft] = useState(() =>
      localOnly
        ? loadGuardSettings()
        : validGuardSettings(game?.config)
          ? structuredClone(game.config)
          : defaultGuardSettings(),
    ),
    [stage, setStage] = useState(String(initialStage)),
    [wave, setWave] = useState(initialWave - 1),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  if (user?.role !== 'admin') return null;
  const set = (key, value) => {
    setNotice('');
    setError('');
    setDraft((old) => ({ ...old, [key]: value }));
  };
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = localOnly ? loadGuardSettings() : game?.config || defaultGuardSettings();
      const next = {
        ...saved,
        shipPercent: draft.shipPercent,
        meteorPercent: draft.meteorPercent,
        stages: { ...saved.stages, [stage]: structuredClone(draft.stages[stage]) },
      };
      if (!validGuardSettings(next)) throw new Error('Thông số không nằm trong giới hạn cho phép.');
      if (localOnly) saveGuardSettings(next, user);
      else {
        if (!game) throw new Error('Chưa tải được cấu hình game. Hãy tải lại trang.');
        const result = await api('save_game', {
          gameCode: GUARD_CODE,
          engineCode: GUARD_CODE,
          name: game.game_name,
          description: game.description,
          active: game.is_active,
          config: next,
        });
        onSaved?.(result.data);
      }
      setNotice(
        localOnly
          ? 'Đã lưu trên trình duyệt này. Áp dụng từ lượt chơi mới.'
          : 'Đã lưu cấu hình dùng chung. Áp dụng từ lượt chơi mới trên mọi thiết bị.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const current = draft.stages[stage],
    part = current.waves[wave];
  const numberField = (key, label, limits, { perWave = false, divisor = 1, step = 1 } = {}) => {
    const source = perWave ? part : current;
    return (
      <label key={`${perWave ? 'wave' : 'stage'}-${key}`}>
        {label}
        <input
          type="number"
          required
          aria-label={label}
          min={limits[0] / divisor}
          max={limits[1] / divisor}
          step={step}
          value={source[key] === '' ? '' : source[key] / divisor}
          onChange={(e) => {
            const value =
              e.target.value === '' ? '' : Math.round(Number(e.target.value) * divisor * 100) / 100;
            setNotice('');
            setError('');
            setDraft((old) => ({
              ...old,
              stages: {
                ...old.stages,
                [stage]: perWave
                  ? {
                      ...old.stages[stage],
                      waves: old.stages[stage].waves.map((w, i) =>
                        i === wave ? { ...w, [key]: value } : w,
                      ),
                    }
                  : { ...old.stages[stage], [key]: value },
              },
            }));
          }}
        />
      </label>
    );
  };
  return (
    <ValidatedForm className="panel guard-settings" onSubmit={save}>
      <h2>Vệ binh bàn phím{localOnly ? ' · bản local' : ''}</h2>
      <p>
        {localOnly
          ? 'Cấu hình chỉ lưu trên trình duyệt và địa chỉ local này, không gửi lên máy chủ.'
          : 'Cấu hình được lưu dùng chung trên các thiết bị; chỉ Admin được thay đổi.'}{' '}
        Các giá trị chỉ áp dụng từ lượt mới. Kích thước dùng chung cho ba màn.
      </p>
      <label>
        Màn
        <select aria-label="Màn cấu hình" value={stage} onChange={(e) => setStage(e.target.value)}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              Màn {n}
            </option>
          ))}
        </select>
      </label>
      {numberField('speed', 'Tốc độ màn', GUARD_LIMITS.speed, { divisor: 100, step: 0.05 })}
      {numberField('backgroundSpeed', 'Tốc độ nền cơ sở (px/giây)', GUARD_LIMITS.backgroundSpeed)}
      {numberField(
        'transitionSeconds',
        'Thời gian chuyển tốc (giây)',
        GUARD_LIMITS.transitionSeconds,
        { step: 0.05 },
      )}
      <label>
        Đợt
        <select
          aria-label="Đợt cấu hình"
          value={wave}
          onChange={(e) => setWave(Number(e.target.value))}
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n - 1}>
              Đợt {n} · {['Bay thường', 'Boost nhẹ', 'Boost mạnh'][n - 1]}
            </option>
          ))}
        </select>
      </label>
      {numberField('speed', 'Hệ số tốc độ đợt', GUARD_LIMITS.waveSpeed, {
        perWave: true,
        divisor: 100,
        step: 0.05,
      })}
      {numberField('totalTargets', 'Tổng thiên thạch trong đợt', GUARD_LIMITS.totalTargets, {
        perWave: true,
      })}
      {numberField(
        'maxActive',
        'Tối đa cùng lúc',
        [1, Math.min(GUARD_LIMITS.maxActive[1], part.totalTargets || 1)],
        { perWave: true },
      )}
      {numberField('spawnSeconds', 'Khoảng xuất hiện (giây)', GUARD_LIMITS.spawnSeconds, {
        perWave: true,
        step: 0.1,
      })}
      {numberField('fps', 'Nhịp sprite (FPS)', GUARD_LIMITS.fps, { perWave: true })}
      <p aria-live="polite">
        Tốc độ hiệu dụng: {(current.speed / 100).toLocaleString('vi-VN')}× ×{' '}
        {(part.speed / 100).toLocaleString('vi-VN')}× ={' '}
        {((current.speed * part.speed) / 10000).toLocaleString('vi-VN')}×. Nền:{' '}
        {((current.backgroundSpeed * current.speed * part.speed) / 10000).toLocaleString('vi-VN')}{' '}
        px/giây. Tổng màn:{' '}
        {current.waves.reduce((sum, w) => sum + (Number(w.totalTargets) || 0), 0)} thiên thạch.
      </p>
      <p>
        Số lượng và khoảng sinh độc lập với tốc độ. Lưu áp dụng cả ba đợt của màn đang chọn, từ lượt
        mới.
      </p>
      {['shipPercent', 'meteorPercent'].map((key) => (
        <label key={key}>
          {key === 'shipPercent' ? 'Kích thước tàu' : 'Kích thước thiên thạch'}:{' '}
          <output>{draft[key]}%</output>
          <input
            type="range"
            aria-label={key === 'shipPercent' ? 'Kích thước tàu' : 'Kích thước thiên thạch'}
            min={GUARD_LIMITS[key][0]}
            max={GUARD_LIMITS[key][1]}
            step="1"
            value={draft[key]}
            onChange={(e) => set(key, Number(e.target.value))}
          />
        </label>
      ))}
      <div className="guard-size-preview" aria-label="Xem trước kích thước">
        <img
          src={ART.flight2.src}
          alt={`Tàu ${draft.shipPercent}%`}
          style={{ height: `${draft.shipPercent * 1.2}px` }}
        />
        <svg
          role="img"
          aria-label={`Thiên thạch ${draft.meteorPercent}%`}
          viewBox={ART.meteor.crop.join(' ')}
          style={{ height: `${draft.meteorPercent * 0.7}px` }}
        >
          <image href={ART.meteor.src} width="1536" height="1024" />
        </svg>
      </div>
      <p>80% là mặc định mới; 100% bằng kích thước trước lần chỉnh này. Giới hạn 50–120%.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="guard-settings-actions">
        <TipyButton type="submit" icon={Save} loading={busy} disabled={!localOnly && !game}>
          Lưu
        </TipyButton>
        <TipyButton
          emphasis="secondary"
          icon={RotateCcw}
          onClick={() => {
            setDraft((old) => ({
              ...old,
              stages: { ...old.stages, [stage]: defaultGuardSettings().stages[stage] },
            }));
            setError('');
            setNotice('Đã khôi phục màn đang chọn. Bấm Lưu để áp dụng.');
          }}
        >
          Khôi phục mặc định
        </TipyButton>
        <a
          href={localOnly ? '/dev/keyboard-guard' : '/#typing/guard'}
          target="_blank"
          rel="noreferrer"
        >
          Mở bản chơi thử
        </a>
      </div>
    </ValidatedForm>
  );
}
