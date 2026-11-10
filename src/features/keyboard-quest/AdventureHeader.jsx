import { ArrowLeft, Map, List, ChevronDown } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import { ADVENTURE_ART } from './adventure.js';

export default function AdventureHeader({
  worldId,
  lesson,
  completed,
  onBack,
  onMap,
  onList,
  onMenu,
  menuOpen,
  busy,
}) {
  return (
    <header className="adventure-header">
      <div>
        <h1>Bé chinh phục bàn phím</h1>
        <p>{completed}/30 bài hoàn thành</p>
      </div>
      <button
        type="button"
        className="adventure-world-switch"
        onClick={onMenu}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={worldId ? `Chọn màn, đang ở màn ${worldId}` : 'Chọn màn'}
      >
        <img src={ADVENTURE_ART.sign.src} alt="" width="168" height="124" decoding="async" />
        <span>
          {worldId ? `Màn ${worldId}` : 'Chọn màn'}
          <ChevronDown size={20} aria-hidden="true" />
        </span>
      </button>
      <nav aria-label="Đường đi hành trình" className="adventure-breadcrumbs">
        <TipyButton emphasis="secondary" icon={ArrowLeft} disabled={busy} onClick={onBack}>
          Gõ chữ
        </TipyButton>
        {worldId && (
          <TipyButton emphasis="secondary" icon={Map} disabled={busy} onClick={onMap}>
            Bản đồ đảo
          </TipyButton>
        )}
        {lesson && (
          <TipyButton emphasis="secondary" icon={List} disabled={busy} onClick={onList}>
            Danh sách bài
          </TipyButton>
        )}
      </nav>
    </header>
  );
}
