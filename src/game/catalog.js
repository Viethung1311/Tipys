/** Register a client engine here when its gameplay screen is implemented. */
export const GAME_ENGINES = {
  keyboard_guard: {
    screen: 'guard',
    icon: '🚀',
    features: ['Gõ từ tiếng Việt', '3 đợt tăng tốc', '5 máu và khiên'],
  },
  keyboard_quest: {
    screen: 'quest',
    icon: '🗺️',
    features: ['30 bài học', '9 chủ đề từ vựng', 'Telex tiếng Việt'],
  },
  falling_letters: {
    screen: 'setup',
    icon: '⌨',
    features: ['Chữ, số & dấu câu', '3 mạng', '3 độ khó'],
  },
};
export const OFFLINE_GAMES = [
  {
    game_id: 'falling_letters',
    game_code: 'falling_letters',
    engine_code: 'falling_letters',
    game_name: 'Chữ rơi',
    description: 'Bắt lấy chữ đang rơi bằng cách gõ hoặc chạm đúng phím.',
    is_active: true,
  },
  {
    game_id: 'keyboard_quest',
    game_code: 'keyboard_quest',
    engine_code: 'keyboard_quest',
    game_name: 'Bé chinh phục bàn phím',
    description: 'Khám phá bàn phím, gõ từ và làm quen Telex.',
    is_active: true,
  },
  {
    game_id: 'keyboard_guard',
    game_code: 'keyboard_guard',
    engine_code: 'keyboard_guard',
    game_name: 'Vệ binh bàn phím',
    description: 'Gõ đúng từ, bắn thiên thạch và bảo vệ phi thuyền qua ba đợt!',
    is_active: true,
  },
];
export function availableGames(catalog) {
  const order = { falling_letters: 0, keyboard_quest: 1, keyboard_guard: 2 };
  return (catalog === null ? OFFLINE_GAMES : catalog)
    .filter((game) => game.is_active)
    .sort((a, b) => (order[a.game_code] ?? 3) - (order[b.game_code] ?? 3));
}
export function gameScreen(game) {
  return ['falling_letters', 'keyboard_quest', 'keyboard_guard'].includes(game.game_code) &&
    game.game_code === game.engine_code
    ? GAME_ENGINES[game.engine_code]?.screen
    : game.game_code === 'falling_letters'
      ? undefined
      : null;
}
