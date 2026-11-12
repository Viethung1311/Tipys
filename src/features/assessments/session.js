import { api } from '../../game/backend.js';
/** One ordered checkpoint stream per attempt; a failed request retains its exact retry token. */
export function assessmentSession(
  assessmentId,
  attempt,
  notify,
  request = api,
  onFinal = () => {},
) {
  let payload = structuredClone(attempt.payload || {}),
    revision = attempt.revision,
    sequence = 0,
    saved = 0,
    pending = null,
    queue = Promise.resolve(),
    timer = null,
    closed = false,
    finalRow = null;
  const send = async (action) => {
    if (closed) return finalRow;
    clearTimeout(timer);
    timer = null;
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
          },
        };
      notify('Đang lưu…');
      const response = await request(pending.action, pending.body),
        row = response.data;
      revision = row.revision;
      saved = pending.sequence;
      if (sequence === saved) payload = structuredClone(row.payload);
      const submitted = Boolean(row.submitted_at) || pending.action === 'assessment_submit';
      pending = null;
      notify(submitted ? 'Đã nộp bài' : 'Đã lưu');
      if (submitted) {
        closed = true;
        finalRow = row;
        onFinal(row);
        return row;
      }
    }
  };
  const flush = (submit = false) => {
    if (closed) return Promise.resolve(finalRow);
    sequence++;
    queue = queue
      .catch(() => {})
      .then(() => send(submit ? 'assessment_submit' : 'assessment_checkpoint'))
      .catch((error) => {
        notify(error.message, true);
        throw error;
      });
    return queue;
  };
  return {
    update(id, value, schedule = true) {
      if (closed) return;
      payload[id] = structuredClone(value);
      if (schedule) sequence++;
      if (schedule) notify('Đang lưu…');
      if (schedule && !timer) timer = setTimeout(() => flush().catch(() => {}), 1000);
    },
    payload: () => payload,
    flush,
    stop() {
      clearTimeout(timer);
      timer = null;
    },
  };
}
