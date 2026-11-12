import { LESSONS, findLesson } from './curriculum.js';
export function learningSummary(rows) {
  const known = rows.filter((row) => findLesson(row.lesson_id));
  const done = (id) => known.some((row) => row.lesson_id === id && row.completed);
  const stars = known.reduce((n, row) => n + row.best_stars, 0);
  const correct = known.reduce((n, row) => n + Number(row.correct_count || 0), 0);
  const wrong = known.reduce((n, row) => n + Number(row.wrong_count || 0), 0);
  const keys = known
    .filter((row) => findLesson(row.lesson_id).kind === 'key')
    .reduce((n, row) => n + Number(row.correct_count || 0), 0);
  const words = known
    .filter((row) => findLesson(row.lesson_id).kind === 'text')
    .reduce((n, row) => n + Number(row.correct_count || 0), 0);
  const weakest = (key) =>
    Object.entries(
      known.reduce((all, row) => {
        for (const [id, count] of Object.entries(row[key] || {}))
          all[id] = (all[id] || 0) + Number(count);
        return all;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => (key === 'Space' ? 'Phím cách' : key === 'combined' ? 'Ghép dấu' : key));
  const badges = [
    { id: 'first', name: 'Bước đầu tiên', icon: '🌱', earned: done('keys-as') },
    { id: 'keys', name: '100 phím đúng', icon: '⌨️', earned: keys >= 100 },
    { id: 'words', name: '50 từ và câu', icon: '📚', earned: words >= 50 },
    {
      id: 'vietnamese',
      name: 'Tiếng Việt đầu tiên',
      icon: '🪄',
      earned: known.some((row) => row.completed && findLesson(row.lesson_id).telex),
    },
    {
      id: 'telex',
      name: 'Đại sư Telex',
      icon: '✨',
      earned: LESSONS.filter((lesson) => lesson.world === 4).every((lesson) => done(lesson.id)),
    },
    {
      id: 'champion',
      name: 'Nhà vô địch',
      icon: '🏆',
      earned: LESSONS.every((lesson) => done(lesson.id)),
    },
  ];
  return {
    completed: LESSONS.filter((lesson) => done(lesson.id)).length,
    stars,
    awardedStars: known.reduce((n, row) => n + Number(row.awarded_stars || 0), 0),
    correct,
    weakKeys: weakest('weak_keys'),
    weakRules: weakest('weak_rules'),
    wrong,
    accuracy: correct + wrong ? Math.round((100 * correct) / (correct + wrong)) : null,
    seconds: known.reduce((n, row) => n + Number(row.total_active_seconds || 0), 0),
    badges,
    worlds: [1, 2, 3, 4, 5].map((id) => ({
      id,
      done: LESSONS.filter((lesson) => lesson.world === id && done(lesson.id)).length,
      total: LESSONS.filter((lesson) => lesson.world === id).length,
    })),
    recent: known
      .filter((row) => row.last_played_at)
      .sort((a, b) => Date.parse(b.last_played_at) - Date.parse(a.last_played_at))
      .slice(0, 5),
  };
}
/** Reorder fixed exercises, never add answers outside the server-validated lesson. */
export function practiceLesson(lesson, rows, random = Math.random) {
  const old = rows.find((row) => row.lesson_id === lesson.id);
  const weak = (item) =>
    Number(old?.weak_keys?.[item.target] || 0) + Number(old?.weak_rules?.[item.rule] || 0);
  const shuffled = [...lesson.items];
  if ([10, 23, 30].includes(lesson.stage) || lesson.world === 0)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  const revisit = shuffled.filter((item) => weak(item) > 0).sort((a, b) => weak(b) - weak(a));
  const fresh = shuffled.filter((item) => !weak(item));
  if (!revisit.length) return { ...lesson, items: shuffled };
  const items = [];
  while (revisit.length || fresh.length) {
    if (revisit.length) items.push(revisit.shift());
    if (fresh.length) items.push(fresh.shift());
  }
  return { ...lesson, items };
}
