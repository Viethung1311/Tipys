import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import { isPlaySurfaceActive } from '../../components/PlaySurface.jsx';
const keyFor = (id) => `tipy-notifications-pending:${id}`;
const loadPending = (id) => {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(id)) || '[]');
    return Array.isArray(value) ? value.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};
export default function useNotifications(userId, initial) {
  const [data, setData] = useState(initial || null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!initial);
  const pages = useRef(new Map(initial ? [[1, initial]] : [])),
    active = useRef(true),
    generation = useRef(0);
  const revision = useRef(initial?.revision || '');
  const pending = useRef(new Set(loadPending(userId))),
    currentPage = useRef(1),
    source = useRef(null),
    reconnect = useRef(null),
    sending = useRef(false);
  const savePending = () => {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify([...pending.current]));
    } catch {
      /* Database remains the source of truth when storage is unavailable. */
    }
  };
  const masked = (value) => {
    const items = value.items.map((n) =>
      pending.current.has(n.notification_id)
        ? { ...n, presented_at: n.presented_at || 'pending' }
        : n,
    );
    return {
      ...value,
      items,
      unread: Math.max(
        0,
        value.unread -
          value.items.filter((n) => !n.presented_at && pending.current.has(n.notification_id))
            .length,
      ),
    };
  };
  const accept = (value, show = true) => {
    if (!active.current) return;
    if (!value || !Array.isArray(value.items) || !Number.isInteger(value.unread))
      throw Error('Thông báo chưa tải được.');
    if (value.revision && value.revision < revision.current) {
      setLoading(false);
      return;
    }
    if (value.revision) revision.current = value.revision;
    pages.current.set(value.page, value);
    if (pages.current.size > 10) pages.current.delete(pages.current.keys().next().value);
    if (show) {
      currentPage.current = value.page;
      setData(masked(value));
    }
    setLoading(false);
    setError('');
  };
  const page = async (number = 1, force = false) => {
    if (!force && pages.current.has(number)) {
      accept(pages.current.get(number));
      return;
    }
    const version = ++generation.current;
    setLoading(true);
    try {
      const value = await api('notifications', undefined, { page: number });
      if (version === generation.current) accept(value);
    } catch (e) {
      if (active.current && version === generation.current) {
        setError(e.message);
        setLoading(false);
      }
    }
  };
  const present = async (ids, speak) => {
    if (!ids.length || sending.current) return [];
    sending.current = true;
    ids.forEach((id) => pending.current.add(id));
    savePending();
    setData((old) => old && masked(old));
    try {
      const response = await api('notifications_present', { ids, speak });
      if (!active.current) return [];
      ids.forEach((id) => pending.current.delete(id));
      savePending();
      generation.current++;
      pages.current.clear();
      accept(response.data.page);
      try {
        localStorage.setItem(
          'tipy-notifications-presented',
          JSON.stringify({ userId, ids, at: Date.now() }),
        );
      } catch {
        /* Focus refresh covers tabs without storage. */
      }
      return response.data.spoken || [];
    } catch (e) {
      if (active.current) setError(e.message);
      return [];
    } finally {
      sending.current = false;
    }
  };
  useEffect(() => {
    active.current = true;
    let timer;
    const connect = () => {
      if (
        !active.current ||
        document.hidden ||
        source.current ||
        typeof EventSource === 'undefined'
      )
        return;
      const stream = new EventSource('/api/notification-events');
      source.current = stream;
      const stop = () => {
        stream.close();
        if (source.current === stream) source.current = null;
      };
      stream.addEventListener('snapshot', (event) => {
        if (!active.current || source.current !== stream) return;
        try {
          generation.current++;
          pages.current.clear();
          accept(JSON.parse(event.data));
        } catch {
          setError('Chưa tải được thông báo. Em thử lại nhé.');
        }
      });
      stream.addEventListener('renew', () => {
        stop();
        connect();
      });
      const unavailable = () => {
        if (source.current !== stream) return;
        stop();
        if (active.current) {
          setLoading(false);
          setError('Chưa kết nối được thông báo mới. Em có thể thử lại.');
        }
      };
      stream.addEventListener('unavailable', unavailable);
      stream.onerror = unavailable;
    };
    reconnect.current = connect;
    const refresh = (event) => {
      clearTimeout(timer);
      if (document.hidden) {
        source.current?.close();
        source.current = null;
        return;
      }
      if (['focus', 'visibilitychange'].includes(event?.type) && isPlaySurfaceActive()) return;
      if (event?.type === 'tipy-play-ended' && source.current) return;
      timer = setTimeout(() => {
        const ids = [...pending.current].slice(0, 50);
        if (ids.length) present(ids, false);
        if (!source.current && typeof EventSource !== 'undefined') connect();
        else page(1, true);
      }, 150);
    };
    const storage = (event) => {
      if (event.key !== 'tipy-notifications-presented' || !event.newValue) return;
      try {
        const value = JSON.parse(event.newValue);
        if (value.userId !== userId || !Array.isArray(value.ids)) return;
        for (const [number, cached] of pages.current)
          pages.current.set(number, {
            ...cached,
            unread: Math.max(
              0,
              cached.unread -
                cached.items.filter((n) => !n.presented_at && value.ids.includes(n.notification_id))
                  .length,
            ),
            items: cached.items.map((n) =>
              value.ids.includes(n.notification_id) ? { ...n, presented_at: 'another-tab' } : n,
            ),
          });
        const cached = pages.current.get(currentPage.current);
        if (cached) accept(cached);
        page(1, true);
      } catch {
        /* Ignore malformed cross-tab messages. */
      }
    };
    const ids = [...pending.current].slice(0, 50);
    if (ids.length) present(ids, false);
    if (typeof EventSource !== 'undefined') connect();
    else if (!initial) page();
    window.addEventListener('focus', refresh);
    window.addEventListener('tipy-play-ended', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', storage);
    return () => {
      active.current = false;
      generation.current++;
      clearTimeout(timer);
      source.current?.close();
      source.current = null;
      reconnect.current = null;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('tipy-play-ended', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', storage);
      pages.current.clear();
    };
  }, [userId]);
  return {
    data: data && masked(data),
    error,
    loading,
    page,
    present,
    retry: () => {
      page(1, true);
      reconnect.current?.();
    },
  };
}
