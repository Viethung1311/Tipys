import { api } from '../../game/backend.js';
export const draftKey = (userId, assessmentId, attemptId) =>
  `tipy-assessment-draft:${userId}:${assessmentId}:${attemptId}`;
export function clearAssessmentDraft(userId, assessmentId, attemptId) {
  try {
    localStorage.removeItem(draftKey(userId, assessmentId, attemptId));
  } catch {}
}
/** Local snapshots while playing; explicit evidence batches and one immutable final request. */
export function assessmentSession(
  assessmentId,
  attempt,
  notify,
  request = api,
  onFinal = () => {},
  options = {},
) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const key = options.userId ? draftKey(options.userId, assessmentId, attempt.attempt_id) : null;
  let payload = structuredClone(attempt.payload || {}),
    revision = attempt.revision,
    sequence = 0,
    saved = 0,
    pending = null,
    queue = Promise.resolve(),
    timer = null,
    closed = false,
    finalizing = false,
    finalRow = null,
    ui = {};
  try {
    const local = key && JSON.parse(storage?.getItem(key) || 'null');
    if (
      local?.schema === 1 &&
      local.attemptId === attempt.attempt_id &&
      local.revision === revision &&
      local.payload &&
      typeof local.payload === 'object'
    ) {
      ui = local.ui || {};
      payload = local.payload;
      sequence = local.sequence || 0;
      saved = local.saved || 0;
      pending = local.pending || null;
      finalizing = Boolean(local.finalizing);
    }
  } catch {}
  const keep = () => {
    clearTimeout(timer);
    timer = null;
    if (!key || closed) return;
    try {
      storage?.setItem(
        key,
        JSON.stringify({
          schema: 1,
          attemptId: attempt.attempt_id,
          revision,
          payload,
          sequence,
          saved,
          pending,
          finalizing,
          ui,
        }),
      );
    } catch {
      notify('Chưa giữ được bản trên thiết bị. Đừng tải lại trang.', true);
    }
  };
  const send = async (action) => {
    if (closed) return finalRow;
    keep();
    while (pending || saved < sequence || action === 'assessment_submit') {
      if (!pending)
        pending = {
          action,
          sequence,
          body: {
            assessmentId,
            attemptId: attempt.attempt_id,
            revision,
            requestId: crypto.randomUUID(),
            payload: structuredClone(payload),
            ...(action === 'assessment_submit' && options.userId && { automatic: true }),
          },
        };
      keep();
      notify(
        action === 'assessment_submit' ? 'Đang lưu kết quả…' : 'Đang gửi bằng chứng thời gian…',
      );
      const response = await request(pending.action, pending.body),
        row = response.data;
      if (!row || !Number.isInteger(row.revision))
        throw Error('Chưa xác nhận được kết quả lưu. Thử lại cùng yêu cầu.');
      revision = row.revision;
      saved = pending.sequence;
      if (sequence === saved) payload = structuredClone(row.payload || payload);
      const submitted = Boolean(row.submitted_at);
      pending = null;
      if (submitted) {
        closed = true;
        finalRow = row;
        clearTimeout(timer);
        if (key)
          try {
            storage?.removeItem(key);
          } catch {}
        notify('Đã lưu kết quả');
        onFinal(row);
        return row;
      }
      keep();
      notify('Đã giữ trên thiết bị');
      if (action === 'assessment_checkpoint') return row;
    }
  };
  const flush = (submit = false) => {
    if (closed) return Promise.resolve(finalRow);
    if (submit) finalizing = true;
    keep();
    queue = queue
      .catch(() => {})
      .then(() => send(submit ? 'assessment_submit' : 'assessment_checkpoint'))
      .catch((error) => {
        notify(submit ? `Chưa lưu được, thử lại. ${error.message}` : error.message, true);
        throw error;
      });
    return queue;
  };
  return {
    update(id, value) {
      if (closed || finalizing || JSON.stringify(payload[id]) === JSON.stringify(value)) return;
      payload[id] = structuredClone(value);
      sequence++;
      if (!timer) timer = setTimeout(keep, 250);
    },
    ui: (id) => ui[id],
    setUI(id, value) {
      if (closed || finalizing) return;
      ui[id] = value;
      if (!timer) timer = setTimeout(keep, 250);
    },
    payload: () => payload,
    pendingFinal: () => finalizing,
    flush,
    keep,
    stop() {
      keep();
    },
  };
}
