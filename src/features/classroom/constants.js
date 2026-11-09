/** Safe shared constants for the classroom UI and API validation. No secrets here. */
export const ANIMALS = [
  ['rat', '🐭', 'Tý'],
  ['ox', '🐮', 'Sửu'],
  ['tiger', '🐯', 'Dần'],
  ['cat', '🐱', 'Mão'],
  ['dragon', '🐲', 'Thìn'],
  ['snake', '🐍', 'Tỵ'],
  ['horse', '🐴', 'Ngọ'],
  ['goat', '🐐', 'Mùi'],
  ['monkey', '🐵', 'Thân'],
  ['rooster', '🐔', 'Dậu'],
  ['dog', '🐶', 'Tuất'],
  ['pig', '🐷', 'Hợi'],
];
export const ACCESSORIES = [
  ['none', '', 'Không'],
  ['star', '⭐', 'Ngôi sao'],
  ['flower', '🌸', 'Bông hoa'],
  ['crown', '👑', 'Vương miện'],
  ['glasses', '👓', 'Kính'],
  ['book', '📘', 'Quyển sách'],
];
export const COLORS = ['sun', 'mint', 'sky', 'rose', 'lavender'];
export const FILE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
