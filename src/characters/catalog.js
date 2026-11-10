// Stable IDs shared by accounts, classrooms and future games. Supplied original images.
export const CHARACTERS = [
  { id: 'icon_01', name: 'Búp bê', src: '/characters/icon_01.png' },
  { id: 'icon_02', name: 'Gà lửa', src: '/characters/icon_02.png' },
  { id: 'icon_03', name: 'Vua nấm', src: '/characters/icon_03.png' },
  { id: 'icon_04', name: 'Bò xanh', src: '/characters/icon_04.png' },
  { id: 'icon_05', name: 'Thỏ kính', src: '/characters/icon_05.png' },
  { id: 'icon_06', name: 'Ninja xanh', src: '/characters/icon_06.png' },
  { id: 'icon_07', name: 'Thợ mỏ', src: '/characters/icon_07.png' },
  { id: 'icon_08', name: 'Công chúa', src: '/characters/icon_08.png' },
  { id: 'icon_09', name: 'Hải tặc', src: '/characters/icon_09.png' },
  { id: 'icon_10', name: 'Râu lửa', src: '/characters/icon_10.png' },
  { id: 'icon_11', name: 'Chậu nhỏ', src: '/characters/icon_11.png' },
  { id: 'icon_12', name: 'Chiến binh', src: '/characters/icon_12.png' },
  { id: 'icon_13', name: 'Râu xanh', src: '/characters/icon_13.png' },
  { id: 'icon_14', name: 'Hiệp sĩ', src: '/characters/icon_14.png' },
  { id: 'icon_15', name: 'Ninja hồng', src: '/characters/icon_15.png' },
  { id: 'icon_16', name: 'Rô bốt', src: '/characters/icon_16.png' },
  { id: 'icon_17', name: 'Dơi nhỏ', src: '/characters/icon_17.png' },
  { id: 'icon_18', name: 'Mực tím', src: '/characters/icon_18.png' },
  { id: 'icon_19', name: 'Sừng đỏ', src: '/characters/icon_19.png' },
  { id: 'icon_20', name: 'Thạch xanh', src: '/characters/icon_20.png' },
  { id: 'icon_21', name: 'Bé lửa', src: '/characters/icon_21.png' },
  { id: 'icon_22', name: 'Mèo hồng', src: '/characters/icon_22.png' },
  { id: 'icon_23', name: 'Mũ cánh', src: '/characters/icon_23.png' },
  { id: 'icon_24', name: 'Mèo đen', src: '/characters/icon_24.png' },
  { id: 'icon_25', name: 'Mầm xanh', src: '/characters/icon_25.png' },
  { id: 'icon_26', name: 'Tóc xanh', src: '/characters/icon_26.png' },
  { id: 'icon_27', name: 'Cá mập', src: '/characters/icon_27.png' },
  { id: 'icon_28', name: 'Khiên màu', src: '/characters/icon_28.png' },
  { id: 'icon_29', name: 'Yêu tinh', src: '/characters/icon_29.png' },
  { id: 'icon_30', name: 'Áo choàng', src: '/characters/icon_30.png' },
  { id: 'icon_31', name: 'Mặt nạ', src: '/characters/icon_31.png' },
  { id: 'icon_32', name: 'Vua đầu lâu', src: '/characters/icon_32.png' },
  { id: 'icon_33', name: 'Băng xanh', src: '/characters/icon_33.png' },
  { id: 'icon_34', name: 'Bọ xanh', src: '/characters/icon_34.png' },
  { id: 'icon_35', name: 'Dơi tím', src: '/characters/icon_35.png' },
  { id: 'icon_36', name: 'Cây hoa', src: '/characters/icon_36.png' },
];
export const LEGACY_CHARACTERS = {
  rat: 'icon_01',
  ox: 'icon_04',
  tiger: 'icon_10',
  cat: 'icon_24',
  dragon: 'icon_29',
  snake: 'icon_18',
  horse: 'icon_23',
  goat: 'icon_14',
  monkey: 'icon_06',
  rooster: 'icon_02',
  dog: 'icon_22',
  pig: 'icon_20',
};
export function characterFor(id) {
  return CHARACTERS.find((item) => item.id === (LEGACY_CHARACTERS[id] || id)) || CHARACTERS[0];
}
export function normalizeAvatar(value) {
  return { accessory: 'none', color: 'sun', ...value, animal: characterFor(value?.animal).id };
}
