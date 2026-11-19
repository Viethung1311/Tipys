import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubFixture } from './hub-fixture.js';
import { id } from './teacher-fixture.js';
import { assessmentSession, draftKey } from '../src/features/assessments/session.js';
import { createGame, press } from '../src/game/engine.js';
import { assessmentResult, assessmentSnapshot } from '../server/modules/assessments.js';
import { LEVELS, virtualKey } from '../src/game/config.js';

test('virtual text keys retain Vietnamese case and support shifted punctuation', () => {
  assert.equal(virtualKey('A', false), 'a');
  assert.equal(virtualKey('A', true), 'A');
  assert.equal(virtualKey('Á', false), 'Á');
  assert.equal(virtualKey('1', true), '!');
  assert.equal(virtualKey(';', true), ':');
  assert.equal(virtualKey('/', true), '?');
});

test('local assessment drafts make no background writes; reload/offline retry and concurrent endings share one result', async () => {
  const items = new Map(),
    storage = {
      getItem: (key) => items.get(key),
      setItem: (key, value) => items.set(key, value),
      removeItem: (key) => items.delete(key),
    };
  const attempt = { attempt_id: id(700), revision: 0, payload: {} },
    calls = [];
  let fail = true,
    final = 0;
  const request = async (action, body) => {
    calls.push({ action, body: structuredClone(body) });
    if (fail) {
      fail = false;
      throw Error('offline');
    }
    return { data: { ...attempt, payload: body.payload, revision: 1, submitted_at: 'now' } };
  };
  const make = () =>
    assessmentSession(
      id(701),
      attempt,
      () => {},
      request,
      () => final++,
      { storage, userId: id(1) },
    );
  let session = make();
  for (let n = 0; n < 80; n++) session.update('quest', { seconds: n, done: n === 79 });
  session.setUI('quest', { value: 'Tiếng Việt' });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(calls.length, 0);
  session.stop();
  session = make();
  assert.equal(session.payload().quest.seconds, 79);
  assert.equal(session.ui('quest').value, 'Tiếng Việt');
  assert.equal(items.has(draftKey(id(2), id(701), attempt.attempt_id)), false);
  await assert.rejects(session.flush(true), /offline/);
  session.stop();
  session = make();
  assert.equal(session.pendingFinal(), true);
  session.update('quest', { seconds: 900 });
  await Promise.all([session.flush(true), session.flush(true)]);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls.length, 2);
  assert.equal(final, 1);
  assert.equal(items.size, 0);
});

test('falling target stops immediately at or above the threshold and server rejects premature endings', () => {
  for (const threshold of [10, 15]) {
    const settings = { difficulty: 'easy', keys: ['A'], levels: LEVELS, targetScore: threshold },
      state = createGame(settings);
    state.status = 'playing';
    for (let n = 0; n < Math.ceil(threshold / 10); n++) {
      state.letters = [{ id: n, key: 'A', column: 0, y: 0, fall: 8 }];
      state.nextId = n + 1;
      press(state, 'A');
    }
    assert.equal(state.status, 'result');
    const score = state.score;
    press(state, 'A');
    assert.equal(state.score, score);
    const definition = assessmentSnapshot({
      title: 'Thử',
      selection: { falling: { difficulty: 'easy', keys: ['A'], targetScore: threshold } },
    });
    const attempt = {
      payload: {},
      active_seconds: 0,
      started_at: new Date(Date.now() - 10000).toISOString(),
    };
    const result = assessmentResult(definition, { falling: { seconds: 0, state } }, attempt);
    assert.equal(result.results[0].score, score);
    assert.equal(result.results[0].outcome, 'good');
    assert.throws(() =>
      assessmentResult(
        definition,
        { falling: { seconds: 0, state: { ...state, correct: 0, score: 9999 } } },
        attempt,
      ),
    );
  }
});

test('migration enforces idempotent starts, private receipts, one submitted result, valid schedules and scope', async () => {
  const f = await hubFixture();
  try {
    await f.db.exec(readFileSync('db/assessment_auto_finish.sql', 'utf8'));
    await f.publish(710);
    const student = f.person(1),
      input = { assessmentId: id(710), requestId: id(711) };
    const starts = await Promise.all([
      f.assessments.assessmentStart(student, input),
      f.assessments.assessmentStart(student, input),
    ]);
    assert.equal(starts[0].attempt_id, starts[1].attempt_id);
    assert.equal(starts[0].allowedAttempts, 1);
    assert.ok(starts[0].assessment.definition);
    const a = starts[0],
      item = a.definition.sections[0].items[0];
    const body = {
      assessmentId: id(710),
      attemptId: a.attempt_id,
      requestId: id(712),
      revision: 0,
      automatic: true,
      payload: {
        quest: {
          seconds: 0,
          answers: [{ itemId: item.id, answer: '', errors: 0, position: 0, telex: 0, editing: 0 }],
        },
      },
    };
    await assert.rejects(f.assessments.assessmentSubmit(student, body), (e) => e.status === 400);
    body.payload.quest.answers[0].answer = item.target;
    const results = await Promise.all([
      f.assessments.assessmentSubmit(student, body),
      f.assessments.assessmentSubmit(student, body),
    ]);
    assert.ok(results.every((r) => r.submitted_at));
    assert.equal(
      (
        await f.q('select count(*)::int n from assessment_attempts where assessment_id=$1', [
          id(710),
        ])
      ).n,
      1,
    );
    assert.equal((await f.assessments.assessmentStart(student, input)).attempt_id, a.attempt_id);
    assert.equal((await f.assessments.assessments(student, {})).items[0].attemptNumber, 1);
    await assert.rejects(
      f.assessments.assessmentStart(f.person(8), input),
      (e) => e.status === 403,
    );
    await f.publish(720, undefined, {
      mode: 'scheduled',
      opensAt: new Date(Date.now() + 60000).toISOString(),
      closesAt: new Date(Date.now() + 120000).toISOString(),
    });
    await assert.rejects(
      f.assessments.assessmentStart(student, { assessmentId: id(720), requestId: id(721) }),
      (e) => e.status === 409,
    );
    await f.db.exec('set role authenticated');
    await assert.rejects(
      f.db.query('select * from assessment_start_requests'),
      /permission denied/,
    );
    await f.db.exec('reset role');
  } finally {
    await f.db.close();
  }
});
