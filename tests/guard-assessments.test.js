import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEST_CONTENT } from '../src/features/assessments/content.js';
import {
  assessmentSnapshot,
  assessmentResult,
  createAssessments,
} from '../server/modules/assessments.js';
import {
  guardAssessmentDefaults,
  createGuardAssessment,
  guardAssessmentInput,
  guardAssessmentTick,
  guardEvidence,
  replayGuardAssessment,
} from '../src/features/keyboard-guard/assessment.js';
import { defaultGuardSettings } from '../src/features/keyboard-guard/settings.js';
import { hubFixture } from './hub-fixture.js';
import { id } from './teacher-fixture.js';
const selected = [
  'keys-as-1',
  'short-words-1',
  ...TEST_CONTENT.filter((i) => i.target === 'Space' || i.target === 'em bé').map((i) => i.id),
];
const selection = () => ({
  ...guardAssessmentDefaults(),
  ids: selected,
  order: 'sequential',
  passScore: 10,
  goodScore: 20,
  waves: [1, 2, 3].map(() => ({
    totalTargets: 1,
    speed: 100,
    maxActive: 1,
    spawnSeconds: 0.5,
    fps: 11,
  })),
});
const input = () => ({
  title: 'Phi thuyền kiểm tra',
  targets: { classIds: [id(50)], userIds: [] },
  selection: { guard: selection() },
  repeats: { mode: 'limited', extra: 2 },
});
function play(part, attemptId, shoot = true) {
  const run = createGuardAssessment(part, attemptId);
  while (!['won', 'lost'].includes(run.state.status) && run.ticks < 60000) {
    const target = run.state.targets.find((t) => t.state === 'falling' && t.y >= 0);
    if (target && shoot) guardAssessmentInput(run, target.key);
    guardAssessmentTick(run);
  }
  return run;
}
test('guard snapshots actual selected IDs, validates distinct capacity and settings without changing free play', () => {
  const settings = defaultGuardSettings(),
    before = JSON.stringify(settings),
    draft = input();
  const def = assessmentSnapshot(draft, undefined, settings),
    part = def.sections[0];
  assert.equal(part.type, 'guard');
  assert.equal(part.config.waves, 3);
  assert.deepEqual(
    part.items.map((i) => i.id),
    selected,
  );
  assert.equal(JSON.stringify(settings), before);
  assert.deepEqual(def.selection.guard, draft.selection.guard);
  for (const patch of [
    { ids: ['missing'] },
    { waves: [] },
    { goodScore: 1000 },
    { order: 'bad' },
    { ids: ['keys-as-1'], repeat: false },
  ])
    assert.throws(() =>
      assessmentSnapshot({
        ...draft,
        selection: { guard: { ...draft.selection.guard, ...patch } },
      }),
    );
});
test('guard ordered content, Vietnamese IME, distinct no-repeat and completion thresholds retain server units', () => {
  const draft = input();
  draft.selection.guard.ids = ['vocabulary-family-4', 'keys-as-1', 'space-1'];
  draft.selection.guard.repeat = false;
  const part = assessmentSnapshot(draft).sections[0];
  const run = createGuardAssessment(part, id(803));
  assert.deepEqual(
    run.state.words.map((w) => w.id),
    draft.selection.guard.ids,
  );
  while (!run.state.targets.some((t) => t.y >= 0)) guardAssessmentTick(run);
  guardAssessmentInput(run, 'em be', { composing: true });
  assert.equal(run.state.bullets.length, 0);
  guardAssessmentInput(run, 'em bé', { composing: false });
  assert.equal(run.state.bullets.length, 3);
  assert.equal(replayGuardAssessment(part, id(803), guardEvidence(run)).state.bullets.length, 3);
  const definition = { sections: [{ ...part, goodScore: 30 }] };
  const completed = play(part, id(803));
  const evidence = guardEvidence(completed);
  const grade = assessmentResult(
    definition,
    { guard: evidence },
    { attempt_id: id(803), started_at: new Date(0).toISOString(), payload: {}, active_seconds: 0 },
    1000000,
  );
  assert.equal(grade.results[0].scoreMax, 30);
  assert.equal(grade.results[0].outcome, 'good');
});
test('guard replay grades only deterministic inputs; rejects fake scores, shortened evidence, extra time and injected content', () => {
  const definition = assessmentSnapshot(input()),
    part = definition.sections[0];
  const attempt = {
    attempt_id: id(801),
    started_at: new Date(0).toISOString(),
    active_seconds: 0,
    payload: {},
  };
  const run = play(part, attempt.attempt_id),
    evidence = guardEvidence(run);
  assert.equal(run.state.status, 'won');
  assert.equal(run.state.score, 30);
  assert.equal(run.state.wave, 3);
  assert.equal(run.state.energy, 3);
  const grade = assessmentResult(
    definition,
    { guard: { ...evidence, score: 999999, destroyed: 9999 } },
    attempt,
    1000000,
  );
  assert.equal(grade.results[0].score, 30);
  assert.equal(grade.results[0].destroyed, 3);
  assert.equal(grade.results[0].outcome, 'good');
  assert.equal(grade.payload.guard.done, true);
  assert.deepEqual(
    guardEvidence(replayGuardAssessment(part, attempt.attempt_id, evidence)),
    evidence,
  );
  assert.throws(() =>
    assessmentResult(
      definition,
      { guard: { ...evidence, seconds: evidence.seconds + 1 } },
      attempt,
      1000000,
    ),
  );
  assert.throws(() =>
    replayGuardAssessment(part, attempt.attempt_id, { ...evidence, ticks: evidence.ticks + 1 }),
  );
  assert.throws(() =>
    replayGuardAssessment(part, attempt.attempt_id, {
      ticks: 2,
      inputs: [[0, 0, 'x'.repeat(81), 0]],
    }),
  );
  assert.throws(() =>
    assessmentResult(
      definition,
      { guard: { ...evidence, inputs: [] } },
      { ...attempt, payload: { guard: evidence } },
      1000000,
    ),
  );
  const wrong = createGuardAssessment(part, attempt.attempt_id);
  for (let i = 0; i < 100; i++) guardAssessmentTick(wrong);
  guardAssessmentInput(wrong, 'không thuộc đề');
  assert.equal(wrong.state.score, 0);
});
test('guard IME, Backspace, Space, repeated events and restored progress use the same engine', () => {
  const definition = assessmentSnapshot(input()),
    part = definition.sections[0];
  const run = createGuardAssessment(part, id(802));
  while (!run.state.targets.some((t) => t.y >= 0)) guardAssessmentTick(run);
  const word = run.state.targets[0].key;
  guardAssessmentInput(run, 'z', { composing: true });
  guardAssessmentInput(run, '', { composing: false });
  guardAssessmentInput(run, word, { repeat: true });
  assert.equal(run.state.bullets.length, 0);
  guardAssessmentInput(run, word);
  assert.equal(run.state.bullets.length, 3);
  guardAssessmentInput(run, word);
  assert.equal(run.state.bullets.length, 3);
  const restored = replayGuardAssessment(part, id(802), guardEvidence(run));
  assert.equal(restored.state.bullets.length, 3);
  assert.equal(restored.state.presses, run.state.presses);
});
test('guard SQL lifecycle enforces teacher scope, current members, snapshots, retries, best result and no star rewards', async () => {
  const f = await hubFixture();
  try {
    await f.db.exec(readFileSync('db/assessment_auto_finish.sql', 'utf8'));
    await f.db.exec(readFileSync('db/guard_assessments.sql', 'utf8'));
    const service = createAssessments({
      rpc: f.rpc,
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { config: defaultGuardSettings() } }),
      }),
    });
    const admin = f.admin,
      teacher = await f.people(30),
      other = await f.people(31),
      student = await f.people(1);
    const draft = { ...input(), assessmentId: id(850), requestId: id(851), version: 0 };
    await assert.rejects(service.assessmentSave(student, draft), (e) => e.status === 403);
    await assert.rejects(service.assessmentSave(other, draft), (e) => e.status === 403);
    const saved = await service.assessmentSave(teacher, draft);
    const mixed = await service.assessmentSave(teacher, {
      ...draft,
      assessmentId: id(860),
      requestId: id(861),
      selection: {
        ...draft.selection,
        questIds: ['keys-as-1'],
        falling: { difficulty: 'easy', keys: ['A'], targetScore: 10 },
      },
    });
    assert.equal(mixed.definition.sections.length, 3);
    assert.deepEqual(saved.definition.selection.guard.ids, selected);
    assert.equal((await service.assessmentSave(teacher, draft)).version, 1);
    await service.assessmentPublish(teacher, { assessmentId: draft.assessmentId, version: 1 });
    const list = await service.assessments(student, { classId: id(50) });
    assert.deepEqual(list.items[0].game_titles, ['Vệ binh bàn phím']);
    const before = await f.q('select count(*)::integer n from star_rewards');
    let best = 0;
    for (const shoot of [false, true, false]) {
      const requestId = crypto.randomUUID();
      const attempt = await service.assessmentStart(student, {
        assessmentId: draft.assessmentId,
        requestId,
      });
      const same = await service.assessmentStart(student, {
        assessmentId: draft.assessmentId,
        requestId,
      });
      assert.equal(same.attempt_id, attempt.attempt_id);
      const evidence = guardEvidence(
        play(attempt.definition.sections[0], attempt.attempt_id, shoot),
      );
      await f.db.query(
        "update assessment_attempts set started_at=clock_timestamp()-interval '20 minutes' where attempt_id=$1",
        [attempt.attempt_id],
      );
      const submitted = await service.assessmentSubmit(student, {
        assessmentId: draft.assessmentId,
        attemptId: attempt.attempt_id,
        requestId: crypto.randomUUID(),
        revision: 0,
        payload: { guard: evidence },
        automatic: true,
      });
      assert.equal(submitted.results[0].score, shoot ? 30 : 0);
      best = Math.max(best, submitted.results[0].score);
      const duplicate = await service.assessmentSubmit(student, {
        assessmentId: draft.assessmentId,
        attemptId: attempt.attempt_id,
        requestId: crypto.randomUUID(),
        revision: 0,
        payload: { guard: evidence },
        automatic: true,
      });
      assert.equal(duplicate.attempt_id, attempt.attempt_id);
    }
    const history = await service.assessmentAttempts(student, {
      assessmentId: draft.assessmentId,
      page: 1,
    });
    assert.equal(history.best_sections[0].score, best);
    assert.equal(history.total, 3);
    await assert.rejects(
      service.assessmentStart(student, {
        assessmentId: draft.assessmentId,
        requestId: crypto.randomUUID(),
      }),
    );
    await assert.rejects(service.assessment(other, { assessmentId: draft.assessmentId }));
    await f.db.query('insert into class_members(class_id,user_id) values($1,$2)', [id(50), id(8)]);
    const newcomer = await f.people(8);
    assert.equal((await service.assessments(newcomer, { classId: id(50) })).items.length, 1);
    await f.db.query('update class_members set is_active=false where class_id=$1 and user_id=$2', [
      id(50),
      id(8),
    ]);
    await assert.rejects(
      service.assessmentStart(newcomer, {
        assessmentId: draft.assessmentId,
        requestId: crypto.randomUUID(),
      }),
    );
    assert.deepEqual(await f.q('select count(*)::integer n from star_rewards'), before);
    const permissions = await f.q(
      "select has_function_privilege('authenticated','tipy_assessment(uuid,text,jsonb)','EXECUTE') allowed",
    );
    assert.equal(permissions.allowed, false);
  } finally {
    await f.db.close();
  }
});
