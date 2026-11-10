import { EXTRA_LESSONS, VOCABULARY } from './content.js';
export const QUEST_CODE = 'keyboard_quest';
export const CURRICULUM_VERSION = 1;
export const WORLDS = [
  { id: 1, title: 'Làm quen bàn phím', icon: '🌱' },
  { id: 2, title: 'Nhà thám hiểm', icon: '🌳' },
  { id: 3, title: 'Ghép chữ, kể chuyện', icon: '🚲' },
  { id: 4, title: 'Phù thủy tiếng Việt', icon: '🪄' },
  { id: 5, title: 'Siêu anh hùng gõ phím', icon: '🏆' },
];
const keys = (values) => values.map((target) => ({ target, image: '⌨️' }));
const definitions = [
  {
    id: 'keys-as',
    stage: 1,
    world: 1,
    title: 'Hai người bạn A, S',
    kind: 'key',
    threshold: 80,
    items: keys(['A', 'S', 'A', 'S', 'S', 'A', 'S', 'A', 'A', 'S']),
  },
  {
    id: 'keys-asdf',
    stage: 2,
    world: 1,
    title: 'Bốn người bạn mới',
    kind: 'key',
    threshold: 80,
    previous: 'keys-as',
    items: keys(['A', 'S', 'D', 'F', 'D', 'S', 'A', 'F', 'D', 'F']),
  },
  {
    id: 'keys-right',
    stage: 3,
    world: 1,
    title: 'Khám phá tay phải',
    kind: 'key',
    threshold: 80,
    previous: 'keys-asdf',
    items: keys(['J', 'K', 'L', ';', 'J', 'L', 'K', ';', 'L', 'J']),
  },
  {
    id: 'space',
    stage: 4,
    world: 1,
    title: 'Phím cách kỳ diệu',
    kind: 'key',
    threshold: 80,
    previous: 'keys-right',
    items: keys(Array(8).fill('Space')),
  },
  {
    id: 'home-row',
    stage: 5,
    world: 1,
    title: 'Ngôi nhà các ngón tay',
    kind: 'key',
    threshold: 80,
    previous: 'space',
    items: keys(['A', 'S', 'D', 'F', 'J', 'K', 'L', ';', 'Space', 'F', 'J']),
  },
  {
    id: 'picture-words',
    stage: 12,
    world: 3,
    title: 'Nhìn hình, gõ từ',
    kind: 'text',
    threshold: 85,
    demo: true,
    items: [
      ['meo', '🐱'],
      ['cho', '🐶'],
      ['ga', '🐔'],
      ['voi', '🐘'],
      ['ca', '🐟'],
    ].map(([target, image]) => ({ target, image })),
  },
  {
    id: 'sentences',
    stage: 15,
    world: 3,
    title: 'Bé kể chuyện',
    kind: 'text',
    threshold: 90,
    demo: true,
    items: ['Em di hoc.', 'Me yeu be.', 'Be choi vui.', 'Em hoc go phim.', 'Em yeu ba.'].map(
      (target) => ({ target, image: '📖' }),
    ),
  },
  {
    id: 'telex-demo',
    stage: 16,
    world: 4,
    title: 'Phép thuật Telex',
    kind: 'text',
    threshold: 80,
    demo: true,
    telex: true,
    items: [
      ['á', 'as', 's'],
      ['à', 'af', 'f'],
      ['ả', 'ar', 'r'],
      ['ã', 'ax', 'x'],
      ['ạ', 'aj', 'j'],
      ['â', 'aa', 'aa'],
      ['ă', 'aw', 'aw'],
      ['đ', 'dd', 'dd'],
      ['tiếng', 'tieengs', 'combined'],
      ['đường', 'dduowngf', 'combined'],
      ['con yêu mẹ', 'con yeeu mej', 'combined'],
    ].map(([target, example, rule]) => ({ target, example, rule, image: '🪄' })),
  },
];
const prepare = (lesson) => ({
  description: lesson.telex
    ? 'Gõ tiếng Việt bằng bộ gõ của thiết bị. Ưu tiên đúng trước nhanh.'
    : lesson.kind === 'key'
      ? 'Tìm phím theo mẫu. Không cần gõ nhanh.'
      : 'Gõ theo mẫu, có thể dùng Backspace để sửa.',
  skill: lesson.telex
    ? 'telex'
    : lesson.exercise || (lesson.kind === 'key' ? 'key-position' : 'text-input'),
  difficulty: lesson.world,
  estimatedMinutes: Math.max(1, Math.ceil(lesson.items.length / 5)),
  ...lesson,
  items: lesson.items.map((item, index) => ({ ...item, id: `${lesson.id}-${index + 1}` })),
});
// The eight MVP IDs and exercises stay unchanged so existing progress remains valid.
export const LESSONS = [...definitions, ...EXTRA_LESSONS]
  .sort((a, b) => a.stage - b.stage)
  .map(prepare);
export const LIBRARY_LESSONS = VOCABULARY.map((topic, index) =>
  prepare({
    id: `vocabulary-${topic.id}`,
    stage: 101 + index,
    world: 0,
    title: topic.title,
    kind: 'text',
    telex: true,
    threshold: 85,
    previous: 'champion',
    items: topic.words.map((target) => ({ target, image: topic.image, rule: 'combined' })),
  }),
);
export const ALL_LESSONS = [...LESSONS, ...LIBRARY_LESSONS];
export const findLesson = (id) => ALL_LESSONS.find((lesson) => lesson.id === id);
export const lessonForStage = (stage) => ALL_LESSONS.find((lesson) => lesson.stage === stage);
export const isUnlocked = (lesson, progress) =>
  lesson.world === 0
    ? LESSONS.every((lesson) =>
        progress.some((row) => row.lesson_id === lesson.id && row.completed),
      )
    : !lesson.previous ||
      progress.some((row) => row.lesson_id === lesson.previous && row.completed);
export const FINGER_HINTS = {
  A: 'Ngón út tay trái',
  Q: 'Ngón út tay trái',
  W: 'Ngón áp út tay trái',
  E: 'Ngón giữa tay trái',
  R: 'Ngón trỏ tay trái',
  T: 'Ngón trỏ tay trái',
  Y: 'Ngón trỏ tay phải',
  U: 'Ngón trỏ tay phải',
  I: 'Ngón giữa tay phải',
  O: 'Ngón áp út tay phải',
  P: 'Ngón út tay phải',
  Z: 'Ngón út tay trái',
  X: 'Ngón áp út tay trái',
  C: 'Ngón giữa tay trái',
  V: 'Ngón trỏ tay trái',
  B: 'Ngón trỏ tay trái',
  N: 'Ngón trỏ tay phải',
  M: 'Ngón trỏ tay phải',
  G: 'Ngón trỏ tay trái',
  H: 'Ngón trỏ tay phải',
  S: 'Ngón áp út tay trái',
  D: 'Ngón giữa tay trái',
  F: 'Ngón trỏ tay trái',
  J: 'Ngón trỏ tay phải',
  K: 'Ngón giữa tay phải',
  L: 'Ngón áp út tay phải',
  ';': 'Ngón út tay phải',
  Space: 'Ngón cái',
};
