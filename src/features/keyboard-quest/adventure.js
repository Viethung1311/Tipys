import { LESSONS, WORLDS, isUnlocked } from './curriculum.js';

// Supplied artwork stays lossless; width is a display hint, not an encoding resize.
export const ADVENTURE_ART = {
  island: {
    source: 'Five-region island adventure map.png',
    src: '/quest-art/island.png',
    width: 1672,
  },
  sign: {
    source: 'Blank Golden Wooden Sign with Ropes-1.png',
    src: '/quest-art/sign.png',
    width: 420,
  },
  archer: {
    source: '36f0046c-d7cd-4680-8381-b169d7d0d40b.png',
    src: '/quest-art/archer.png',
    width: 420,
  },
  dinosaur: {
    source: 'Bone-marked green stegosaurus sprite.png',
    src: '/quest-art/dinosaur.png',
    width: 420,
  },
  detective: {
    source: 'Illustrated detective with dog and clues.png',
    src: '/quest-art/detective.png',
    width: 420,
  },
  witch: { source: 'Purple witch cat with star wand.png', src: '/quest-art/witch.png', width: 420 },
  knight: {
    source: 'Cute knight with sword and shield.png',
    src: '/quest-art/knight.png',
    width: 420,
  },
  brightForest: {
    source: 'Emerald Canopy Tropical Forest-1.png',
    src: '/quest-art/bright-forest.png',
    width: 1440,
  },
  deepForest: {
    source: 'Sunlit Deep Green Woodland Clearing-4.png',
    src: '/quest-art/deep-forest.png',
    width: 1440,
  },
  autumn: {
    source: 'Golden Autumn Forest Clearing-5.png',
    src: '/quest-art/autumn.png',
    width: 1440,
  },
  desert: {
    source: 'Golden Dunes Beneath Terracotta Mesas-2.png',
    src: '/quest-art/desert.png',
    width: 1440,
  },
  snow: { source: 'Whimsical Snowy Village Stream-3.png', src: '/quest-art/snow.png', width: 1440 },
};

// Coordinates are the centers of the red markers in the original 1672 × 941 map.
const appearances = [
  {
    id: 1,
    x: 163 / 1672,
    y: 560 / 941,
    guide: 'archer',
    guideName: 'Tiên nữ cung thủ',
    background: 'brightForest',
    description: 'Cùng tiên nữ tìm những phím đầu tiên.',
  },
  {
    id: 2,
    x: 478 / 1672,
    y: 419 / 941,
    guide: 'dinosaur',
    guideName: 'Khủng long xanh',
    background: 'deepForest',
    description: 'Khám phá khu rừng và luyện gõ từng bước.',
  },
  {
    id: 3,
    x: 813 / 1672,
    y: 577 / 941,
    guide: 'detective',
    guideName: 'Thám tử và chú chó',
    background: 'autumn',
    description: 'Tìm manh mối qua hình ảnh, từ và câu.',
  },
  {
    id: 4,
    x: 1107 / 1672,
    y: 419 / 941,
    guide: 'witch',
    guideName: 'Mèo phù thủy',
    background: 'desert',
    description: 'Khám phá những phép gõ dấu tiếng Việt.',
  },
  {
    id: 5,
    x: 1434 / 1672,
    y: 518 / 941,
    guide: 'knight',
    guideName: 'Hiệp sĩ',
    background: 'snow',
    description: 'Cùng hiệp sĩ chinh phục thử thách cuối.',
  },
];
export const ADVENTURE_WORLDS = appearances.map((world) => ({
  ...WORLDS.find((item) => item.id === world.id),
  ...world,
  guide: ADVENTURE_ART[world.guide],
  background: ADVENTURE_ART[world.background],
}));

export function adventureWorld(id) {
  return ADVENTURE_WORLDS.find((world) => world.id === id);
}
export function worldProgress(id, progress) {
  const lessons = LESSONS.filter((lesson) => lesson.world === id);
  const completed = lessons.filter((lesson) =>
    progress.some((row) => row.lesson_id === lesson.id && row.completed),
  ).length;
  const unlocked = lessons.some((lesson) => isUnlocked(lesson, progress));
  const state = completed === lessons.length ? 'completed' : unlocked ? 'open' : 'locked';
  return {
    lessons,
    completed,
    total: lessons.length,
    state,
    label: state === 'completed' ? 'Đã hoàn thành' : state === 'open' ? 'Đang mở' : 'Chưa mở',
  };
}
