import { useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, Star } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { companionSay } from '../../characters/companion-speech.js';
import { TEACHER_NAME } from '../../game/teacher.js';
import useNotifications from './useNotifications.js';
import './notifications.css';
const time = (value) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
export default function StudentNotifications({
  user,
  initial,
  home,
  playing,
  blocked,
  companionVisible,
  onOpenChange,
  onView,
}) {
  const { data, loading, error, page, present, retry } = useNotifications(user.user_id, initial);
  const [open, setOpen] = useState(false),
    [dock, setDock] = useState(null);
  const autoShown = useRef(false),
    automatic = useRef(false),
    showing = useRef(new Set()),
    owner = useRef(true);
  useEffect(() => {
    owner.current = true;
    return () => {
      owner.current = false;
    };
  }, []);
  useEffect(() => {
    if (!home) autoShown.current = false;
    if (
      home &&
      !blocked &&
      !playing &&
      !autoShown.current &&
      data?.unread > 0 &&
      data.items.some((n) => !n.presented_at)
    ) {
      autoShown.current = true;
      automatic.current = true;
      setOpen(true);
    }
  }, [home, blocked, playing, data]);
  useEffect(() => {
    onOpenChange(open);
    return () => onOpenChange(false);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (open && data)
      data.items
        .filter((n) => !n.presented_at)
        .forEach((n) => showing.current.add(n.notification_id));
    if (open && automatic.current && data && !data.unread) setOpen(false);
  }, [open, data]);
  useEffect(() => {
    let frame;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const left = 12,
          size = 56,
          gap = 12;
        const obstacles = [
          ...document.querySelectorAll(
            '.tipy-companion,.arena,.quest-playfield,.assessment-runner,.start-row,.quest-back-map',
          ),
        ]
          .map((n) => n.getBoundingClientRect())
          .filter((r) => r.width && r.height && r.bottom > 0 && r.top < innerHeight);
        const tops = [innerHeight - size - gap, ...obstacles.map((r) => r.top - size - gap)].sort(
          (a, b) => b - a,
        );
        const top = tops.find(
          (y) =>
            y >= gap &&
            y + size <= innerHeight - gap &&
            !obstacles.some(
              (r) => left < r.right && left + size > r.left && y < r.bottom && y + size > r.top,
            ),
        );
        setDock(top === undefined ? { position: 'static', margin: 12 } : { left, top });
      });
    };
    place();
    const companion = document.querySelector('.tipy-companion');
    const observer = new MutationObserver(place);
    if (companion) observer.observe(companion, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [playing, companionVisible, home]);
  const close = async () => {
    setOpen(false);
    automatic.current = false;
    const ids = [...showing.current];
    showing.current.clear();
    const anchor = document.querySelector('.tipy-companion');
    const speak =
      companionVisible &&
      !playing &&
      !document.hidden &&
      !!anchor?.getBoundingClientRect().width &&
      getComputedStyle(anchor).visibility !== 'hidden';
    const claimed = [];
    for (let i = 0; i < ids.length; i += 50)
      claimed.push(...(await present(ids.slice(i, i + 50), speak)));
    if (
      !owner.current ||
      !claimed.length ||
      !speak ||
      !document.querySelector('.tipy-companion')?.getBoundingClientRect().width
    )
      return;
    const kinds = new Set(claimed.map((n) => n.kind));
    companionSay(
      kinds.size > 1
        ? 'notification_batch'
        : kinds.has('assessment')
          ? 'notification_assessment'
          : 'notification_gift',
    );
  };
  return (
    <>
      <button
        type="button"
        className="notification-bell"
        style={dock || { visibility: 'hidden' }}
        disabled={playing || blocked}
        aria-label={`Thông báo${data?.unread ? `, ${data.unread} chưa xem` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          automatic.current = false;
          setOpen(true);
          if (!data) retry();
        }}
      >
        <Bell aria-hidden="true" />
        {data?.unread > 0 && (
          <span className="notification-count" aria-hidden="true">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <Modal
          className="notification-dialog"
          title="Thông báo của em"
          description={
            data?.unread ? `Em có ${data.unread} thông báo mới.` : 'Xem lại thông báo từ thầy Hùng.'
          }
          onClose={close}
        >
          {loading && <p role="status">Đang tải thông báo…</p>}
          {error && (
            <p role="alert">
              {error} <button onClick={retry}>Thử lại</button>
            </p>
          )}
          {!loading && !error && !data?.items.length && <p>Em chưa có thông báo mới.</p>}
          <ul className="notification-list">
            {data?.items.map((n) => (
              <li key={n.notification_id} className={!n.presented_at ? 'is-new' : ''}>
                <span className="notification-type">
                  {n.kind === 'assessment' ? (
                    <BookOpen aria-hidden="true" />
                  ) : (
                    <Star aria-hidden="true" />
                  )}
                  {n.presented_at ? 'Đã xem' : 'Mới'}
                </span>
                <h3>
                  {n.kind === 'assessment'
                    ? n.payload.title
                    : `${TEACHER_NAME} tặng em ${n.payload.amount} sao!`}
                </h3>
                {n.kind === 'star_gift' && n.payload.message && <p>{n.payload.message}</p>}
                {n.kind === 'assessment' && (
                  <>
                    <p>
                      {n.payload.schedule?.mode === 'scheduled'
                        ? `Mở lúc ${time(n.payload.schedule.opensAt)}`
                        : 'Bài luôn mở.'}
                    </p>
                    <TipyButton
                      icon={BookOpen}
                      disabled={!n.assessment_id}
                      onClick={() => {
                        close();
                        onView(n.assessment_id);
                      }}
                    >
                      Xem bài
                    </TipyButton>
                    {!n.assessment_id && <p>Bài kiểm tra không còn được mở.</p>}
                  </>
                )}
                <time dateTime={n.created_at}>{time(n.created_at)}</time>
              </li>
            ))}
          </ul>
          {data?.pages > 1 && (
            <nav className="notification-pages" aria-label="Lịch sử thông báo">
              <TipyButton
                emphasis="secondary"
                disabled={loading || data.page === 1}
                onClick={() => page(data.page - 1)}
              >
                Trước
              </TipyButton>
              <span>
                Trang {data.page}/{data.pages}
              </span>
              <TipyButton
                emphasis="secondary"
                disabled={loading || data.page === data.pages}
                onClick={() => page(data.page + 1)}
              >
                Sau
              </TipyButton>
            </nav>
          )}
        </Modal>
      )}
    </>
  );
}
