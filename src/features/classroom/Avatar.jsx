import { characterFor } from '../../characters/catalog.js';
export default function Avatar({ value, name = '', eager = false }) {
  const character = characterFor(value?.animal);
  return (
    <span
      className="student-avatar"
      role="img"
      aria-label={name ? 'Nhân vật của ' + name + ': ' + character.name : character.name}
    >
      <img
        src={character.src}
        alt=""
        width="256"
        height="256"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  );
}
