import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  LIBRARY_LESSONS,
  ALL_LESSONS,
  findLesson,
  isUnlocked,
} from '../src/features/keyboard-quest/curriculum.js';
import {
  createAnswers,
  gradeLesson,
  updatedProgress,
} from '../src/features/keyboard-quest/engine.js';
import {
  learningSummary,
  recommendedLessons,
  practiceLesson,
} from '../src/features/keyboard-quest/progress.js';
import { validateQuestFinish } from '../server/modules/keyboard-quest.js';
import { createClassrooms } from '../server/modules/classrooms.js';
const completedAnswers = (lesson) =>
  createAnswers(lesson).map((row, i) => ({ ...row, answer: lesson.items[i].target }));
test('30 stable main stages and 90 vocabulary words roundtrip through server validation', () => {
  assert.equal(LESSONS.length, 30);
  assert.deepEqual(
    LESSONS.map((lesson) => lesson.stage),
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  assert.equal(new Set(ALL_LESSONS.map((lesson) => lesson.id)).size, 39);
  assert.equal(LIBRARY_LESSONS.length, 9);
  const all = [];
  for (const lesson of ALL_LESSONS) {
    assert.ok(lesson.items.length >= 5 && lesson.items.length <= 15);
    assert.ok(lesson.description && lesson.skill && lesson.estimatedMinutes > 0);
    for (const item of lesson.items) {
      assert.equal(item.target, item.target.normalize('NFC'));
      assert.ok(item.target.length <= 160);
    }
    const play = {
      stage_number: lesson.stage,
      metrics: { config_snapshot: { lesson_id: lesson.id, curriculum_version: 1 } },
    };
    const answers = completedAnswers(lesson);
    assert.equal(validateQuestFinish(play, { answers }).grade.stars, 3);
    assert.throws(() =>
      validateQuestFinish(play, { answers: answers.map((row, i) => (i === 1 ? answers[0] : row)) }),
    );
    all.push({ lesson_id: lesson.id, completed: true, best_stars: 3 });
  }
  assert.equal(
    LIBRARY_LESSONS.reduce((n, lesson) => n + lesson.items.length, 0),
    90,
  );
  assert.equal(isUnlocked(LIBRARY_LESSONS[0], [{ lesson_id: 'champion', completed: true }]), false);
  assert.ok(isUnlocked(LIBRARY_LESSONS[0], all));
  assert.ok(isUnlocked(findLesson('telex-demo'), []));
});
test('review interleaves weak exercises without losing IDs or accepting another lesson', () => {
  const lesson = LESSONS[0],
    rows = [{ lesson_id: lesson.id, weak_keys: { S: 4 }, last_accuracy: 70, completed: true }];
  const original = lesson.items.map((item) => item.id);
  const practice = practiceLesson(lesson, rows);
  assert.equal(practice.items[0].target, 'S');
  assert.equal(practice.items[1].target, 'A');
  assert.deepEqual(
    lesson.items.map((item) => item.id),
    original,
  );
  assert.deepEqual(new Set(practice.items.map((item) => item.id)), new Set(original));
  const answers = completedAnswers(practice);
  answers[0].errors = 2;
  answers[0].position = 2;
  const result = validateQuestFinish(
    {
      stage_number: 1,
      metrics: { config_snapshot: { lesson_id: lesson.id, curriculum_version: 1 } },
    },
    { answers },
  );
  assert.deepEqual(result.grade.weakKeys, { S: 2 });
  assert.equal(recommendedLessons(rows).review.id, lesson.id);
  assert.equal(recommendedLessons(rows).next.id, 'keys-asdf');
});
test('replays preserve earned coins, badges require actual progress and recent list stays bounded', () => {
  let rows = [];
  for (const lesson of LESSONS)
    rows = updatedProgress(rows, lesson, gradeLesson(lesson, completedAnswers(lesson)), 5);
  let summary = learningSummary(rows);
  assert.equal(summary.coins, 900);
  assert.equal(summary.completed, 30);
  assert.equal(summary.seconds, 150);
  assert.equal(summary.recent.length, 5);
  assert.ok(summary.badges.find((badge) => badge.id === 'champion').earned);
  rows = updatedProgress(
    rows,
    LESSONS[0],
    gradeLesson(LESSONS[0], completedAnswers(LESSONS[0])),
    5,
  );
  summary = learningSummary(rows);
  assert.equal(summary.coins, 900);
  assert.equal(summary.seconds, 155);
  assert.equal(rows.length, 30);
  assert.ok(!learningSummary([]).badges.some((badge) => badge.earned));
});
test('teacher progress report rejects students before queries and scopes a single roster query to class', async () => {
  const id = '11111111-1111-4111-8111-111111111111',
    calls = [];
  const row = {
    user_id: 'member',
    profiles: {
      full_name: 'Test',
      player_lesson_progress: [
        {
          lesson_id: 'keys-as',
          completed: true,
          best_stars: 3,
          last_accuracy: 90,
          correct_count: 10,
          wrong_count: 1,
          total_active_seconds: 12,
          weak_keys: { S: 1 },
          weak_rules: {},
          games: { game_code: 'keyboard_quest' },
        },
        {
          lesson_id: 'keys-as',
          completed: true,
          best_stars: 3,
          correct_count: 999,
          games: { game_code: 'other_game' },
        },
      ],
    },
  };
  const db = {
    from(table) {
      calls.push(['from', table]);
      return {
        select(value) {
          calls.push(['select', value]);
          return this;
        },
        eq(key, value) {
          calls.push(['eq', key, value]);
          return this;
        },
        is() {
          return this;
        },
        maybeSingle: async () => ({ data: { class_id: id } }),
        limit: async () => ({ data: [row] }),
      };
    },
  };
  const service = createClassrooms(db);
  await assert.rejects(
    service.questClassReport({ role: 'student' }, { classId: id }),
    (error) => error.status === 403,
  );
  assert.equal(calls.length, 0);
  const result = await service.questClassReport({ role: 'admin' }, { classId: id });
  assert.equal(result.students[0].completed, 1);
  assert.equal(result.students[0].seconds, 12);
  assert.deepEqual(result.students[0].weakKeys, ['S']);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'class_id' && call[2] === id));
  assert.equal(calls.filter((call) => call[0] === 'from').length, 2);
});
