import { ALL_LESSONS, WORLDS } from '../keyboard-quest/curriculum.js';
export const TEST_CONTENT = ALL_LESSONS.flatMap((lesson) =>
  lesson.items.map((item) => ({
    ...item,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    world: lesson.world,
    kind: item.kind || lesson.kind,
    telex: Boolean(lesson.telex),
  })),
);
export const TEST_WORLDS = [...WORLDS, { id: 0, title: 'Từ vựng' }];
export const contentMatches = (item, search) =>
  `${item.target} ${item.prompt || ''} ${item.lessonTitle}`
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .includes(search.normalize('NFC').toLocaleLowerCase('vi').trim());
