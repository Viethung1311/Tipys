import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, setApiIdentity, clearApiCache } from '../src/game/backend.js';
import { assessmentSession } from '../src/features/assessments/session.js';
import { createAssessments } from '../server/modules/assessments.js';

test('admin cache shares reads, invalidates writes/account changes and rejects old responses', async () => {
  const original = globalThis.fetch;
  let calls = 0,
    finish;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ marker: calls }) };
  };
  try {
    setApiIdentity({ user_id: 'teacher', role: 'admin' });
    const first = await api('assessment_results', undefined, { assessmentId: 'a', page: 1 });
    assert.deepEqual(
      await api('assessment_results', undefined, { assessmentId: 'a', page: 1 }),
      first,
    );
    assert.equal(calls, 1);
    await api('assessment_results', undefined, { assessmentId: 'a', page: 2 });
    assert.equal(calls, 2);
    await api('star_gift', { requestId: 'test' });
    await api('assessment_results', undefined, { assessmentId: 'a', page: 1 });
    assert.equal(calls, 4);
    globalThis.fetch = () =>
      new Promise((resolve) => {
        finish = () => resolve({ ok: true, json: async () => ({ secret: true }) });
      });
    const stale = api('history', undefined, { userId: 'a' });
    setApiIdentity({ user_id: 'child', role: 'student' });
    finish();
    await assert.rejects(stale, /Tài khoản đã thay đổi/);
    globalThis.fetch = async () => {
      calls++;
      return { ok: true, json: async () => ({}) };
    };
    await api('assessment_attempts');
    await api('assessment_attempts');
    assert.equal(calls, 6, 'student private results are never reused from completed cache');
  } finally {
    globalThis.fetch = original;
    setApiIdentity(null);
    clearApiCache();
  }
});

test('unchanged checkpoint/cleanup writes nothing; frames arriving in flight wait for next checkpoint', async () => {
  const calls = [];
  let resolve;
  const attempt = { attempt_id: 'a', revision: 0, payload: {} };
  const session = assessmentSession(
    'exam',
    attempt,
    () => {},
    (action, body) => {
      calls.push({ action, body });
      return new Promise((done) => {
        resolve = () =>
          done({ data: { ...attempt, payload: body.payload, revision: body.revision + 1 } });
      });
    },
  );
  await session.flush();
  await session.flush();
  assert.equal(calls.length, 0);
  session.update('part', { seconds: 1 }, false);
  const save = session.flush();
  await new Promise((r) => setImmediate(r));
  session.update('part', { seconds: 2 }, false);
  resolve();
  await save;
  assert.equal(calls.length, 1);
  assert.equal(session.payload().part.seconds, 2);
  const next = session.flush();
  await new Promise((r) => setImmediate(r));
  resolve();
  await next;
  await session.flush();
  session.stop();
  assert.equal(calls.length, 2);
});

test('invalid draft is rejected before reading game configuration, unauthorized actor before any database query', async () => {
  let reads = 0;
  const service = createAssessments({
    from() {
      reads++;
      throw Error('must not read');
    },
    rpc() {
      reads++;
      throw Error('must not write');
    },
  });
  const input = {
    assessmentId: '00000000-0000-4000-8000-000000000001',
    requestId: '00000000-0000-4000-8000-000000000002',
    version: 0,
    title: ' ',
    selection: { falling: {} },
  };
  await assert.rejects(service.assessmentSave({ role: 'admin' }, input));
  await assert.rejects(service.assessmentSave({ role: 'student' }, input), (e) => e.status === 403);
  assert.equal(reads, 0);
});
