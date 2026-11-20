import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Gamepad2,
  Play,
  RotateCcw,
  Save,
  Send,
  Star,
  StarOff,
  Trash2,
  X,
} from 'lucide-react';
import TipyButton from '../components/TipyButton.jsx';
import Keyboard from '../components/Keyboard.jsx';
import ValidatedForm from '../components/ValidatedForm.jsx';
import '../styles/button-preview.css';

const samples = [
  ['Chơi', 'play', Gamepad2, '073616 · 073650', 'Xanh ngọc · hoạt động chơi'],
  ['Cộng sao', 'reward', Star, '073521 · 073524', 'Cam · cộng sao, icon ngôi sao'],
  ['Xóa', 'danger', Trash2, '073541 · 073721', 'Đỏ nhạt, chữ đỏ · thao tác nguy hiểm'],
  ['Bắt đầu', 'assessment', Play, '073616', 'Xanh ngọc · kiểm tra và tiếp tục'],
  ['Tiếp tục', 'play', Play, '073650', 'Xanh ngọc · trở lại lượt đang làm'],
  ['Làm lại', 'learn', RotateCcw, '073707 · 073711', 'Cam · thử lại và luyện lại'],
  ['Quay lại', 'back', ArrowLeft, '073635 · 073711', 'Trắng, viền cam · điều hướng phụ'],
  ['Tin nhắn', 'message', Send, '073603 · 073606', 'Cam nhạt · khu vực tin nhắn'],
  ['Kiểm tra', 'assessment', Play, '073616 · 073718', 'Xanh ngọc · làm bài'],
  ['Thông báo', 'notification', Bell, '073620', 'Xanh nhạt · thông báo'],
  ['Trừ sao', 'deduct', StarOff, '073529 · 073535', 'Trắng, viền cam · điều chỉnh sao'],
  ['Gửi bài', 'learn', Send, '073603 · 073606', 'Cam · xuất bản nội dung'],
  ['Lưu', 'learn', Save, '073718', 'Cam · lưu thay đổi'],
  ['Hủy', 'back', X, '073650 · 073721', 'Trắng, viền cam · hành động phụ'],
];
export default function ButtonPreview() {
  const [state, setState] = useState('normal'),
    [busy, setBusy] = useState(''),
    [feedback, setFeedback] = useState('Sẵn sàng thử nút. Không kết nối dữ liệu thật.'),
    [count, setCount] = useState(0);
  const [tab, setTab] = useState('Tin nhắn'),
    [sound, setSound] = useState(true),
    [keys, setKeys] = useState(['A', 'S']);
  const [draft, setDraft] = useState(''),
    [files, setFiles] = useState([]),
    [previews, setPreviews] = useState([]),
    [error, setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const next = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach((image) => URL.revokeObjectURL(image.url));
  }, [files]);
  const simulate = (label) => {
    if (timer.current) return;
    setBusy(label);
    setCount((value) => value + 1);
    setFeedback(`Đang mô phỏng: ${label}…`);
    timer.current = setTimeout(() => {
      timer.current = null;
      setBusy('');
      setFeedback(`Đã thử “${label}”. Không gửi request nghiệp vụ.`);
    }, 800);
  };
  return (
    <main className="button-preview">
      <header className="button-preview-heading">
        <div>
          <span className="eyebrow">ZUNIMO · BẢN DUYỆT LOCAL</span>
          <h1>Một bộ nút, nhiều niềm vui</h1>
          <p>Thử màu, cảm giác nhấn và thao tác bàn phím trước khi áp dụng production.</p>
        </div>
        <a className="text-button" href="/">
          ← Về website
        </a>
      </header>
      <section className="panel preview-intro">
        <div>
          <h2>Cùng thử một lượt nhé!</h2>
          <p>
            Font Nunito hiện tại, nút bo tròn, viền rõ và bóng nhấn nhẹ. Màu được chọn theo hành
            động.
          </p>
        </div>
        <div className="preview-actions">
          <TipyButton
            variant="play"
            icon={Play}
            onClick={() => simulate('Bắt đầu chơi')}
            loading={busy === 'Bắt đầu chơi'}
          >
            Bắt đầu chơi
          </TipyButton>
          <TipyButton variant="back" onClick={() => simulate('Quay lại')}>
            Quay lại
          </TipyButton>
        </div>
      </section>
      <section className="panel preview-toolbar" aria-label="Điều khiển bản thử">
        <label>
          Trạng thái minh họa
          <select value={state} onChange={(event) => setState(event.target.value)}>
            {[
              ['normal', 'Bình thường'],
              ['hover', 'Hover'],
              ['pressed', 'Đang nhấn'],
              ['focus', 'Focus'],
              ['loading', 'Đang xử lý'],
              ['disabled', 'Vô hiệu hóa'],
            ].map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p role="status" aria-live="polite">
          {feedback} <strong>{count} lần thử · 0 request nghiệp vụ</strong>
        </p>
      </section>
      <section className="preview-grid" aria-label="Các mẫu nút Zunimo">
        {samples.map(([label, variant, Icon, source, description]) => (
          <article className="panel preview-sample" key={label}>
            <h2>{label}</h2>
            <p>{description}</p>
            <TipyButton
              variant={variant}
              icon={Icon}
              data-preview-state={state}
              disabled={state === 'disabled'}
              loading={state === 'loading' || busy === label}
              loadingLabel="Đang xử lý…"
              onClick={() => simulate(label)}
            >
              {label}
            </TipyButton>
            <div className="preview-actions">
              <TipyButton
                variant={variant}
                icon={Icon}
                size="compact"
                onClick={() => simulate(label + ' gọn')}
              >
                {label}
              </TipyButton>
              <TipyButton
                variant={variant}
                icon={Icon}
                iconOnly
                onClick={() => simulate(label + ' icon')}
              >
                {label}
              </TipyButton>
            </div>
            <small>Ảnh nguồn: {source} · cỡ 56 / 48 / icon 48 px</small>
          </article>
        ))}
      </section>
      <section className="panel preview-controls">
        <h2>Tab, switch và bàn phím</h2>
        <p>Giữ ngữ nghĩa và cách nhập hiện có. Chỉ đổi trạng thái trên thiết bị này.</p>
        <nav className="preview-actions account-tabs" aria-label="Các phần mẫu">
          {['Thông báo', 'Kiểm tra', 'Tin nhắn'].map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={tab === label}
              className={tab === label ? 'active' : ''}
              onClick={() => setTab(label)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="preview-actions">
          <button
            type="button"
            className={sound ? 'audio-switch on' : 'audio-switch'}
            role="switch"
            aria-checked={sound}
            aria-label="Âm thanh mẫu"
            onClick={() => setSound((value) => !value)}
          >
            <span />
          </button>
          <span>Âm thanh mẫu: {sound ? 'Bật' : 'Tắt'} · không phát âm thanh</span>
          <TipyButton icon={X} iconOnly variant="back" onClick={() => simulate('Đóng')}>
            Đóng
          </TipyButton>
        </div>
        <Keyboard
          keys={keys}
          editing
          onKey={(key) =>
            setKeys((old) =>
              old.includes(key) ? old.filter((item) => item !== key) : [...old, key],
            )
          }
        />
      </section>
      <section className="panel">
        <h2>Thử form và chọn ảnh</h2>
        <p>Nhập nội dung rồi chọn/hủy ảnh. Enter chỉ mô phỏng gửi, không upload.</p>
        <ValidatedForm
          className="account-form preview-form"
          onSubmit={() => simulate('Gửi form mẫu')}
        >
          <label>
            Nội dung đang soạn
            <input
              required
              data-required-text
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập một câu rồi thử chọn ảnh"
            />
          </label>
          <label>
            Ảnh xem trước
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const selected = [...event.target.files];
                event.target.value = '';
                if (!selected.length) return;
                if (
                  selected.length > 3 ||
                  selected.some(
                    (file) => file.size > 5 * 1024 * 1024 || !file.type.startsWith('image/'),
                  )
                ) {
                  setError('Chọn tối đa 3 ảnh, mỗi ảnh không quá 5 MB.');
                  return;
                }
                setError('');
                setFiles(selected);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          <div className="preview-images">
            {previews.map((image) => (
              <img key={image.url} src={image.url} alt={image.name} />
            ))}
          </div>
          <div className="preview-actions">
            <TipyButton type="submit" icon={Send} loading={busy === 'Gửi form mẫu'}>
              Gửi bài mẫu
            </TipyButton>
            <TipyButton type="button" variant="back" onClick={() => setFiles([])}>
              Xóa ảnh mẫu
            </TipyButton>
          </div>
        </ValidatedForm>
      </section>
      <section className="panel">
        <h2>Tên dài và nhiều nút</h2>
        <div className="preview-actions">
          <TipyButton variant="assessment" onClick={() => simulate('Bài kiểm tra dài')}>
            Bắt đầu bài kiểm tra luyện gõ tiếng Việt
          </TipyButton>
          <TipyButton variant="learn" icon={Check} onClick={() => simulate('Lưu')}>
            Lưu thay đổi
          </TipyButton>
          <TipyButton variant="back" onClick={() => simulate('Hủy')}>
            Hủy
          </TipyButton>
          <TipyButton variant="danger" onClick={() => simulate('Xóa mẫu')}>
            Xóa
          </TipyButton>
        </div>
      </section>
      <footer>
        <p>
          Nguồn: 33 ảnh trong Documents/Codex/Sources. Màu và mẫu chính lấy từ ảnh; hover, focus và
          độ lún bổ sung theo chuẩn Zunimo. Chưa triển khai production.
        </p>
      </footer>
    </main>
  );
}
