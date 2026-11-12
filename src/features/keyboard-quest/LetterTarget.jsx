import { useState } from 'react';
import { stickerFor } from './letter-stickers.js';
const images = import.meta.glob('../../assets/alphabet/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export default function LetterTarget({ value }) {
  const file = stickerFor(value);
  const source = file ? images[`../../assets/alphabet/${file}`] : null;
  const [failed, setFailed] = useState(null);
  if (!source || failed === source) return value === 'Space' ? 'Phím cách' : value;
  return (
    <>
      <span className="quest-sticker-label">{value}</span>
      <img
        className="quest-letter-sticker"
        src={source}
        alt=""
        width="240"
        height="240"
        decoding="async"
        draggable={false}
        onError={() => setFailed(source)}
      />
    </>
  );
}
