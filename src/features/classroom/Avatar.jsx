import { ANIMALS, ACCESSORIES } from './constants.js';
export default function Avatar({ value = {}, name = '' }) {
  return (
    <span
      className={`student-avatar avatar-${value.color || 'sun'}`}
      role="img"
      aria-label={`Nhân vật của ${name}`}
    >
      <span>{ANIMALS.find((a) => a[0] === value.animal)?.[1] || '🐭'}</span>
      <small>{ACCESSORIES.find((a) => a[0] === value.accessory)?.[1]}</small>
    </span>
  );
}
