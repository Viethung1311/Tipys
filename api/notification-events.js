import { createBackend } from '../server/backend.js';
import { readCookies, setSession } from './tipy.js';
export const maxDuration = 300;

/** Cookie-authenticated SSE keeps Auth tokens and the Realtime service client on the server. */
export function createNotificationEvents({
  makeBackend = createBackend,
  env = process.env,
  lifetime = 240000,
  heartbeat = 25000,
} = {}) {
  return async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Chỉ hỗ trợ GET.' });
    let stop,
      timer,
      ping,
      endTimer,
      closed = false,
      loading = false,
      dirty = false;
    let finish;
    const completion = new Promise((resolve) => {
      finish = resolve;
    });
    const end = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      clearTimeout(endTimer);
      clearInterval(ping);
      req.off?.('aborted', end);
      res.off?.('close', end);
      Promise.resolve(stop?.())
        .catch(() => {})
        .finally(finish);
      if (!res.writableEnded && !res.destroyed) res.end();
    };
    req.on?.('aborted', end);
    res.on?.('close', end);
    try {
      const backend = makeBackend(env),
        cookies = readCookies(req.headers.cookie);
      const { profile, session } = await backend.session(cookies.tipy_access, cookies.tipy_refresh);
      if (closed) return;
      if (profile.role !== 'student')
        return res.status(403).json({ error: 'Chỉ dành cho học sinh.' });
      if (session) setSession(res, session);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      const send = (event, data) => {
        if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const snapshot = async () => {
        if (closed) return;
        if (loading) {
          dirty = true;
          return;
        }
        loading = true;
        try {
          send('snapshot', await backend.notifications(profile));
        } catch {
          send('unavailable', {});
          end();
        } finally {
          loading = false;
          if (dirty) {
            dirty = false;
            schedule();
          }
        }
      };
      const schedule = () => {
        if (closed) return;
        clearTimeout(timer);
        timer = setTimeout(snapshot, 150);
      };
      stop = backend.watchNotifications(profile, schedule, (status) => {
        if (status === 'SUBSCRIBED') schedule();
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          send('unavailable', {});
          end();
        }
      });
      if (closed) {
        await stop();
        return;
      }
      ping = setInterval(() => {
        if (!closed) res.write(': keep-alive\n\n');
      }, heartbeat);
      endTimer = setTimeout(() => {
        send('renew', {});
        end();
      }, lifetime);
      return await completion;
    } catch (error) {
      if (res.headersSent) end();
      else res.status(error.status || 503).json({ error: 'Chưa kết nối được thông báo.' });
    }
  };
}
export default createNotificationEvents();
