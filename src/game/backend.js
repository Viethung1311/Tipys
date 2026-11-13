const pendingReads = new Map();
const readCache = new Map();
let identity = null,
  epoch = 0,
  readVersion = 0;
const adminReads = new Set([
  'students_page',
  'history',
  'assessment_results',
  'assessment_attempts',
]);
export function clearApiCache() {
  readCache.clear();
  pendingReads.clear();
  readVersion++;
}
export function setApiIdentity(user) {
  const next = user ? `${user.user_id}:${user.role}` : null;
  if (identity !== next) {
    identity = next;
    epoch++;
    clearApiCache();
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', clearApiCache);
  document.addEventListener('visibilitychange', clearApiCache);
  window.addEventListener('tipy-class-access-changed', clearApiCache);
  window.addEventListener('tipy-points-changed', clearApiCache);
  window.addEventListener('storage', (event) => {
    if (event.key !== 'tipy-stars-changed' || !event.newValue) return;
    try {
      window.dispatchEvent(
        new CustomEvent('tipy-points-changed', { detail: JSON.parse(event.newValue) }),
      );
    } catch {
      /* Ignore malformed data from other tabs. */
    }
  });
}
export function api(action, body, params = {}) {
  if (body) {
    if (['login', 'signup', 'logout'].includes(action)) {
      epoch++;
      identity = null;
    }
    clearApiCache();
    return request(action, body, params);
  }
  const key = new URLSearchParams({ action, ...params }).toString();
  const cached = readCache.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data);
  if (pendingReads.has(key)) return pendingReads.get(key);
  const owner = epoch,
    version = readVersion;
  const pending = request(action, body, params)
    .then((data) => {
      if (owner !== epoch) throw Error('Tài khoản đã thay đổi. Hãy mở lại nội dung.');
      if (action === 'bootstrap') setApiIdentity(data.user);
      if (identity?.endsWith(':admin') && adminReads.has(action) && version === readVersion) {
        if (readCache.size >= 60) readCache.delete(readCache.keys().next().value);
        readCache.set(key, { data, expires: Date.now() + 30000 });
      }
      return data;
    })
    .finally(() => {
      if (pendingReads.get(key) === pending) pendingReads.delete(key);
    });
  pendingReads.set(key, pending);
  return pending;
}
async function request(action, body, params) {
  const response = await fetch(
    body ? '/api/tipy' : `/api/tipy?${new URLSearchParams({ action, ...params })}`,
    {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify({ ...body, action }) : undefined,
    },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Phần tài khoản đang được thiết lập. Bạn vẫn có thể chơi thử.');
  }
  if (!response.ok) {
    if (
      typeof window !== 'undefined' &&
      [401, 403, 404].includes(response.status) &&
      ['classroom', 'class_posts', 'class_file', 'class_stars'].includes(action)
    )
      window.dispatchEvent(new window.Event('tipy-class-access-changed'));
    throw Error(data.error || 'Chưa xử lý được yêu cầu.');
  }
  if (
    typeof window !== 'undefined' &&
    (action === 'quest_finish' ||
      (action === 'progress' && body.result && body.result !== 'in_progress'))
  )
    window.dispatchEvent(new window.Event('tipy-points-changed'));
  return data;
}
// The queue prevents a late heartbeat from overwriting the final result.
let pendingSaves = Promise.resolve();
export function playRecorder(user, settings, report, request = api) {
  let playId = null,
    closed = false,
    queue = Promise.resolve(),
    lastSeconds = 0;
  const started = pendingSaves
    .then(() =>
      request('start', {
        gameCode: settings.gameCode || 'falling_letters',
        difficulty: settings.difficulty,
        keys: settings.keys,
        ...(settings.ranked ? { ranked: true } : {}),
      }),
    )
    .then((result) => {
      playId = result.data.play_id;
      return playId;
    })
    .catch((error) => {
      report(error.message);
      return null;
    });
  return {
    abandon(state) {
      if (closed || !playId) return;
      closed = true;
      const body = {
        action: 'progress',
        playId,
        seconds: Math.floor(state.elapsed),
        score: state.score,
        result: 'quit',
        metrics: { correct: state.correct, wrong: state.wrong, missed: state.missed },
      };
      if (typeof navigator !== 'undefined' && navigator.sendBeacon)
        navigator.sendBeacon(
          '/api/tipy',
          new Blob([JSON.stringify(body)], { type: 'application/json' }),
        );
    },
    update(state, result = 'in_progress') {
      if (closed) return queue;
      const seconds = Math.floor(state.elapsed);
      if (result === 'in_progress' && seconds - lastSeconds < 10) return queue;
      lastSeconds = seconds;
      if (result !== 'in_progress') closed = true;
      const snapshot = {
        seconds,
        score: state.score,
        result,
        metrics: { correct: state.correct, wrong: state.wrong, missed: state.missed },
      };
      queue = queue
        .then(async () => {
          if (await started) await request('progress', { playId, ...snapshot });
        })
        .catch((error) => report(error.message));
      pendingSaves = queue;
      return queue;
    },
  };
}
