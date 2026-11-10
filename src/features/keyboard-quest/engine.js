export const normalizeText = (value) => String(value ?? '').normalize('NFC');
export const matchesTarget = (value, target) => normalizeText(value) === normalizeText(target);
const withoutMarks = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
export function errorKind(lesson, actual, target) {
  if (lesson.kind === 'key') return 'position';
  if (lesson.telex && withoutMarks(actual) === withoutMarks(target)) return 'telex';
  return 'editing';
}
/** One record per fixed exercise, never store the child's incorrect free text. */
export function createAnswers(lesson) {
  return lesson.items.map((item) => ({
    itemId: item.id,
    answer: '',
    errors: 0,
    position: 0,
    telex: 0,
    editing: 0,
  }));
}
export function gradeLesson(lesson, answers) {
  const correct = lesson.items.length;
  const wrong = answers.reduce((sum, row) => sum + row.errors, 0);
  const accuracy = Math.round((10000 * correct) / (correct + wrong)) / 100;
  const completed = accuracy >= lesson.threshold;
  const stars = !completed ? 0 : accuracy >= 95 ? 3 : accuracy >= 90 ? 2 : 1;
  const weakKeys = {},
    weakRules = {};
  answers.forEach((row) => {
    const item = lesson.items.find((item) => item.id === row.itemId);
    if (row.errors && (item.kind || lesson.kind) === 'key')
      weakKeys[item.target] = (weakKeys[item.target] || 0) + row.errors;
    if (row.telex && item.rule) weakRules[item.rule] = (weakRules[item.rule] || 0) + row.telex;
  });
  return { correct, wrong, accuracy, completed, stars, weakKeys, weakRules };
}
export function updatedProgress(rows, lesson, grade, seconds = 0) {
  const old = rows.find((row) => row.lesson_id === lesson.id);
  return [
    ...rows.filter((row) => row.lesson_id !== lesson.id),
    {
      lesson_id: lesson.id,
      completed: Boolean(old?.completed || grade.completed),
      best_stars: Math.max(old?.best_stars || 0, grade.stars),
      best_accuracy: Math.max(Number(old?.best_accuracy) || 0, grade.accuracy),
      last_accuracy: grade.accuracy,
      weak_keys: grade.weakKeys,
      weak_rules: grade.weakRules,
      attempts: (old?.attempts || 0) + 1,
      correct_count: Number(old?.correct_count || 0) + grade.correct,
      wrong_count: Number(old?.wrong_count || 0) + grade.wrong,
      total_active_seconds: Number(old?.total_active_seconds || 0) + seconds,
      last_played_at: new Date().toISOString(),
    },
  ];
}
