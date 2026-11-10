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
export const LESSONS = definitions.map((lesson) => ({
  ...lesson,
  items: lesson.items.map((item, index) => ({ ...item, id: `${lesson.id}-${index + 1}` })),
}));
export const findLesson = (id) => LESSONS.find((lesson) => lesson.id === id);
export const lessonForStage = (stage) => LESSONS.find((lesson) => lesson.stage === stage);
export const isUnlocked = (lesson, progress) =>
  !lesson.previous || progress.some((row) => row.lesson_id === lesson.previous && row.completed);
export const FINGER_HINTS = {
  A: 'Ngón út tay trái',
  S: 'Ngón áp út tay trái',
  D: 'Ngón giữa tay trái',
  F: 'Ngón trỏ tay trái',
  J: 'Ngón trỏ tay phải',
  K: 'Ngón giữa tay phải',
  L: 'Ngón áp út tay phải',
  ';': 'Ngón út tay phải',
  Space: 'Ngón cái',
};
