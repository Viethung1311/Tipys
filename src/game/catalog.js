/** Register a client engine here when its gameplay screen is implemented. */
export const GAME_ENGINES = {
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
];
export function availableGames(catalog) {
  return (catalog === null ? OFFLINE_GAMES : catalog).filter((game) => game.is_active);
}
export function gameScreen(game) {
  return game.game_code === 'falling_letters' ? GAME_ENGINES[game.engine_code]?.screen : null;
}
