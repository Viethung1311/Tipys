import { Check } from 'lucide-react';
import TipyButton from './TipyButton.jsx';
import Modal from './Modal.jsx';
export default function AudioSettings({ preferences, onChange, onClose }) {
  const change = (key, value) => onChange((previous) => ({ ...previous, [key]: value }));
  return (
    <Modal
      className="tipy-scrollbar-hidden"
      title="Âm thanh vui nhộn 🎵"
      description="Điều chỉnh riêng hiệu ứng và nhạc nền. Chọn âm lượng vừa đủ nghe cho lớp học."
    >
      <div data-audio-control className="audio-settings">
        {[
          ['effects', 'Hiệu ứng', 'Click, đếm ngược, pop và những lời chúc mừng.'],
          ['music', 'Nhạc nền', 'Giai điệu nhẹ, không lời. Chỉ phát khi đang chơi.'],
        ].map(([id, title, description]) => (
          <section className="audio-channel" key={id}>
            <div className="audio-channel-heading">
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label={title}
                aria-checked={preferences[id + 'Enabled']}
                className={preferences[id + 'Enabled'] ? 'audio-switch on' : 'audio-switch'}
                onClick={() => change(id + 'Enabled', !preferences[id + 'Enabled'])}
              >
                <span />
              </button>
            </div>
            <label className="volume-label" htmlFor={id + '-volume'}>
              Âm lượng {title.toLowerCase()}{' '}
              <output>{Math.round(preferences[id + 'Volume'] * 100)}%</output>
            </label>
            <input
              id={id + '-volume'}
              type="range"
              min="0"
              max="100"
              value={Math.round(preferences[id + 'Volume'] * 100)}
              onChange={(event) => change(id + 'Volume', Number(event.target.value) / 100)}
            />
          </section>
        ))}
      </div>
      <p className="audio-note">Nhạc nền tắt mặc định. Cài đặt được lưu trên trình duyệt này.</p>
      <TipyButton icon={Check} className="full" onClick={onClose}>
        Xong rồi
      </TipyButton>
    </Modal>
  );
}
