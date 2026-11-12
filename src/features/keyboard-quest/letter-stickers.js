const files = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((letter) => [letter, letter]),
);
Object.assign(files, {
  Ă: 'A_breve',
  Â: 'A_circumflex',
  Ê: 'E_circumflex',
  Ô: 'O_circumflex',
  Ơ: 'O_horn',
  Ư: 'U_horn',
});

// Exact characters only: a capital sticker must not replace a lowercase or tone-marked target.
export const LETTER_STICKERS = Object.freeze(
  Object.fromEntries(Object.entries(files).map(([letter, file]) => [letter, `${file}.png`])),
);
export const stickerFor = (character) => LETTER_STICKERS[character.normalize('NFC')] || null;
