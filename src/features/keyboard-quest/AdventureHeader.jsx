import { ArrowLeft, Map, List } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';

export default function AdventureHeader({
  worldId,
  lesson,
  completed,
  onBack,
  onMap,
  onList,
  busy,
}) {
  return (
    <header className="adventure-header">
      <div>
        <h1>Bé chinh phục bàn phím</h1>
        <p>{completed}/30 bài hoàn thành</p>
      </div>
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
