import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import { HubPages } from './ClassroomPage.jsx';
import { invalidateHub, readHub } from './hub-cache.js';
export default function ClassNotifications({ user, classId, cache, active, onView }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState('');
  const prefix = `${user.user_id}:${classId}:notifications:`,
    seen = useRef(new Set()),
    lastRevision = useRef('');
  useEffect(() => {
    let live = true;
    setError('');
    readHub(cache, prefix + page, () => api('class_notifications', undefined, { classId, page }))
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [classId, page, revision]);
  useEffect(() => {
    const update = ({ detail }) => {
      if (detail.userId !== user.user_id || detail.revision === lastRevision.current) return;
      lastRevision.current = detail.revision;
      invalidateHub(cache, prefix);
      setRevision((n) => n + 1);
    };
    window.addEventListener('tipy-notifications-updated', update);
    return () => window.removeEventListener('tipy-notifications-updated', update);
  }, [classId]);
  useEffect(() => {
    if (active && data)
      for (const n of data.items) if (!n.presented_at) seen.current.add(n.notification_id);
  }, [active, data]);
  useEffect(() => {
    if (active) return;
    const ids = [...seen.current];
    if (!ids.length) return;
    seen.current.clear();
    let live = true;
    (async () => {
      for (let offset = 0; offset < ids.length; offset += 50)
        await api('notifications_present', { ids: ids.slice(offset, offset + 50), speak: false });
    })()
      .then(() => {
        invalidateHub(cache, prefix);
        if (live)
          setData(
            (old) =>
              old && {
                ...old,
                items: old.items.map((n) =>
                  ids.includes(n.notification_id)
                    ? { ...n, presented_at: new Date().toISOString() }
                    : n,
                ),
              },
          );
        window.dispatchEvent(new Event('tipy-notifications-refresh'));
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [active]);
  return (
    <>
      <h2>Thông báo</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error ? (
        <Loading />
      ) : !data?.items.length ? (
        <p>Em chưa có thông báo mới.</p>
      ) : (
        <>
          <ul className="notification-list">
            {data.items.map((n) => (
              <li key={n.notification_id} data-kind={n.kind}>
                <small>
                  {n.presented_at ? 'Đã xem' : 'Mới'} ·{' '}
                  {new Date(n.created_at).toLocaleString('vi-VN')}
                </small>
                <h3>
                  {n.kind === 'star_gift'
                    ? `${n.payload.teacher} tặng em ${n.payload.amount} sao!`
                    : n.kind === 'post'
                      ? `Có tin nhắn từ ${n.payload.teacher}`
                      : n.payload.title}
                </h3>
                {n.kind === 'post' && <p>{n.payload.title}</p>}
                {n.payload.message && <p>{n.payload.message}</p>}
                {n.kind === 'assessment' && n.payload.schedule?.opensAt && (
                  <p>Mở lúc {new Date(n.payload.schedule.opensAt).toLocaleString('vi-VN')}</p>
                )}
                {n.kind !== 'star_gift' && (
                  <TipyButton onClick={() => onView(n)}>
                    {n.kind === 'post' ? 'Xem tin nhắn' : 'Xem bài'}
                  </TipyButton>
                )}
              </li>
            ))}
          </ul>
          <HubPages data={data} onPage={setPage} />
        </>
      )}
    </>
  );
}
