import { useEffect, useRef, useState } from 'react';
import { Check, Lock, Play } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import { isUnlocked } from './curriculum.js';
import { ADVENTURE_ART, ADVENTURE_WORLDS, adventureWorld, worldProgress } from './adventure.js';
import AdventureScene from './AdventureScene.jsx';
import TelexGuide from './TelexGuide.jsx';

/** Only visible map guides load; scene backgrounds are not mounted on the island map. */
function MapGuide({ world, viewport, ready }) {
  const image = useRef(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: viewport.current, rootMargin: '40px' },
    );
    observer.observe(image.current);
    return () => observer.disconnect();
  }, [ready, viewport]);
  return (
    <img
      ref={image}
      className="adventure-map-guide"
      src={visible ? world.guide.src : undefined}
      alt=""
      width="140"
      height="140"
      decoding="async"
    />
  );
}

export default function WorldMap({ worldId, onChooseWorld, progress, onOpen, mode, onModeChange }) {
  const world = adventureWorld(worldId),
    [detailId, setDetailId] = useState(null),
    [ready, setReady] = useState(false),
    [imageError, setImageError] = useState(false),
    [retry, setRetry] = useState(0);
  const viewport = useRef(null),
    heading = useRef(null),
    previousWorld = useRef(worldId);
  useEffect(() => {
    if (worldId !== null || previousWorld.current !== worldId) heading.current?.focus();
    previousWorld.current = worldId;
  }, [worldId]);
  if (world) {
    const status = worldProgress(world.id, progress);
    return (
      <AdventureScene world={world}>
        <section className="adventure-world-lessons" aria-labelledby="quest-map-heading">
          <h2 id="quest-map-heading" tabIndex={-1} ref={heading}>
            Màn {world.id} · {world.title}
          </h2>
          <p>
            {world.description} · {status.completed}/{status.total} bài hoàn thành
          </p>
          <div className="quest-world-controls">
            <label>
              Kiểu chơi
              <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
                <option value="learn">Cùng học</option>
                <option value="race">Đua xe một mình</option>
              </select>
            </label>
          </div>
          {world.id === 4 && <TelexGuide />}
          <div className="quest-lessons">
            {status.lessons.map((lesson) => {
              const unlocked = isUnlocked(lesson, progress),
                row = progress.find((item) => item.lesson_id === lesson.id);
              return (
                <article className="quest-lesson" key={lesson.id}>
                  <h3>{lesson.title}</h3>
                  <p>
                    {lesson.demo ? 'Bài trải nghiệm · mở sẵn' : `Bước ${lesson.stage}`} ·{' '}
                    {row?.completed
                      ? `${row.best_stars} sao`
                      : unlocked
                        ? 'Sẵn sàng'
                        : 'Hoàn thành bài trước'}
                  </p>
                  <TipyButton
                    icon={unlocked ? Play : Lock}
                    disabled={!unlocked}
                    emphasis={row?.completed ? 'secondary' : undefined}
                    onClick={() => onOpen(lesson.id)}
                  >
                    {unlocked ? (row?.completed ? 'Luyện lại' : 'Vào học') : 'Chưa mở'}
                  </TipyButton>
                </article>
              );
            })}
          </div>
        </section>
      </AdventureScene>
    );
  }
  const detail = adventureWorld(detailId),
    detailStatus = detail && worldProgress(detailId, progress);
  return (
    <section className="adventure-island" aria-labelledby="quest-map-heading">
      <h2 className="sr-only" id="quest-map-heading" tabIndex={-1} ref={heading}>
        Bản đồ phiêu lưu năm màn
      </h2>
      <p className="adventure-map-help">
        Bấm nhân vật để khám phá. Vuốt ngang để xem hết đảo, hoặc dùng Chọn màn.
      </p>
      <div
        className="adventure-map-viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="Bản đồ đảo, có thể cuộn ngang"
      >
        <div className="adventure-map">
          <img
            key={retry}
            className="adventure-map-image"
            src={ADVENTURE_ART.island.src}
            alt="Đảo phiêu lưu với đường đi qua năm màn từ rừng xanh đến vùng tuyết"
            width="1672"
            height="941"
            fetchPriority="high"
            onLoad={() => {
              setReady(true);
              setImageError(false);
            }}
            onError={() => setImageError(true)}
          />
          {!ready && !imageError && (
            <div className="adventure-map-loading">
              <Loading label="Đang mở bản đồ đảo…" />
            </div>
          )}
          {imageError && (
            <div className="adventure-map-loading">
              <p role="alert">Chưa tải được bản đồ.</p>
              <TipyButton
                onClick={() => {
                  setImageError(false);
                  setRetry((value) => value + 1);
                }}
              >
                Thử lại
              </TipyButton>
            </div>
          )}
          {ADVENTURE_WORLDS.map((item) => {
            const status = worldProgress(item.id, progress),
              Icon = status.state === 'completed' ? Check : status.state === 'locked' ? Lock : Play;
            return (
              <button
                type="button"
                key={item.id}
                data-world-id={item.id}
                className={`adventure-map-target is-${status.state}`}
                style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
                aria-label={`Màn ${item.id}: ${item.title} · ${status.label} · ${status.completed}/${status.total} bài`}
                onClick={() => setDetailId(item.id)}
              >
                <MapGuide world={item} viewport={viewport} ready={ready} />
                <span className="adventure-map-indicator">
                  <Icon size={18} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="adventure-map-legend">
        <span>
          <Play size={18} aria-hidden="true" />
          Đang mở
        </span>
        <span>
          <Lock size={18} aria-hidden="true" />
          Chưa mở
        </span>
        <span>
          <Check size={18} aria-hidden="true" />
          Đã hoàn thành
        </span>
      </div>
      {detail && (
        <Modal
          title={`Màn ${detail.id} · ${detail.title}`}
          description={detail.description}
          onClose={() => setDetailId(null)}
          className="adventure-detail-dialog"
        >
          <img
            className="adventure-detail-guide"
            src={detail.guide.src}
            alt={detail.guideName}
            width="160"
            height="180"
            decoding="async"
          />
          <p>
            <strong>{detailStatus.label}</strong> · {detailStatus.completed}/{detailStatus.total}{' '}
            bài hoàn thành
          </p>
          <progress
            value={detailStatus.completed}
            max={detailStatus.total}
            aria-label="Tiến độ màn"
          />
          {detailStatus.state === 'locked' && (
            <p>Hoàn thành bài trước để mở các bài trong màn này.</p>
          )}
          <TipyButton
            variant="play"
            icon={detailStatus.state === 'locked' ? Lock : Play}
            disabled={detailStatus.state === 'locked'}
            onClick={() => {
              setDetailId(null);
              onChooseWorld(detail.id);
            }}
          >
            Bắt đầu
          </TipyButton>
        </Modal>
      )}
    </section>
  );
}
