import { ArrowLeft, Heart, Check, Sparkles } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import Keyboard from '../../components/Keyboard.jsx';
import { PRESETS, LEVELS } from '../../game/config.js';
export default function Setup({ settings, setSettings, onStart, onHome }) {
  const activePreset = Object.entries(PRESETS).find(
    ([, keys]) => [...keys].sort().join('') === [...settings.keys].sort().join(''),
  )?.[0];
  const toggle = (key) =>
    setSettings({
      ...settings,
      keys: settings.keys.includes(key)
        ? settings.keys.filter((k) => k !== key)
        : [...settings.keys, key],
    });
  const left = settings.keys.some((k) => 'QWERTASDFGZXCVB'.includes(k)),
    right = settings.keys.some((k) => 'YUIOPHJKLNM'.includes(k));
  return (
    <main className="setup-page">
      <button className="text-button" onClick={onHome}>
        <ArrowLeft size={17} /> Về kho trò chơi
      </button>
      <div className="page-title">
        <span className="eyebrow">SẴN SÀNG KHÁM PHÁ</span>
        <h1>
          Chọn thử thách của bạn<span>.</span>
        </h1>
        <p>Một chút tùy chỉnh, một hành trình thật vui.</p>
      </div>
      <div className="setup-grid">
        <section className="panel">
          <h2>
            <span className="step">01</span> Chọn độ khó
          </h2>
          <div className="difficulty-options">
            {Object.entries(LEVELS).map(([id, level]) => (
              <button
                key={id}
                className={`difficulty ${settings.difficulty === id ? 'active' : ''}`}
                aria-pressed={settings.difficulty === id}
                onClick={() => setSettings({ ...settings, difficulty: id })}
              >
                <span className="plant">{level.icon}</span>
                <span>
                  <b>{level.name}</b>
                  <small>{level.description}</small>
                </span>
                {settings.difficulty === id && <Check size={19} />}
              </button>
            ))}
          </div>
          <div className="tip">
            <Sparkles size={20} />
            <p>
              Mới bắt đầu? Chọn <b>Dễ</b> và 4 phím để làm quen nhé!
            </p>
          </div>
        </section>
        <section className="panel key-panel">
          <h2>
            <span className="step">02</span> Chọn bộ phím
          </h2>
          <p className="muted">Chọn nhanh một bộ, hoặc chạm từng phím để tùy chỉnh.</p>
          <div className="presets">
            {Object.entries(PRESETS).map(([name, keys]) => (
              <button
                key={name}
                className={activePreset === name ? 'active' : ''}
                onClick={() => setSettings({ ...settings, keys: [...keys] })}
              >
                {name}
              </button>
            ))}
          </div>
          <Keyboard keys={settings.keys} onKey={toggle} editing />
          <p className="muted">Vuốt ngang bàn phím để xem đủ phím.</p>
          <div className="selection-info">
            <span>
              {activePreset || 'Tùy chỉnh'} · <b>Đã chọn: {settings.keys.length} phím</b>
            </span>
            <button onClick={() => setSettings({ ...settings, keys: [] })}>Bỏ chọn tất cả</button>
          </div>
          {settings.keys.length > 0 && (!left || !right) && (
            <p className="balance-tip">
              Gợi ý: chọn thêm phím bên {left ? 'phải' : 'trái'} để luyện cả hai tay.
            </p>
          )}
          <div className="start-row">
            <span>
              <Heart size={17} fill="currentColor" /> 3 mạng <i>·</i> +10 điểm / chữ
            </span>
            <TipyButton variant="play" onClick={onStart} disabled={!settings.keys.length}>
              Bắt đầu chơi
            </TipyButton>
          </div>
          {!settings.keys.length && (
            <p role="status" className="balance-tip">
              Hãy chọn ít nhất một phím để bắt đầu.
            </p>
          )}
        </section>
      </div>
      <div className="how-strip">
        <b>Cách chơi thật đơn giản</b>
        <span>① Nhìn chữ đang rơi</span>
        <span>② Gõ hoặc chạm phím tương ứng</span>
        <span>③ Giữ chữ khỏi vạch đáy</span>
      </div>
    </main>
  );
}
