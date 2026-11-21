export const flightFrame = (time, fps) => Math.floor(time * fps) % 6;

// Each source frame is the same wrapped image shifted down by 1/4 of its height.
export function backgroundPosition(time, speed, world) {
  const scale = Math.max(world.width / 1024, world.height / 1536);
  const width = 1024 * scale,
    height = 1536 * scale;
  const phase = (((time * speed) % height) + height) % height;
  const frame = Math.min(3, Math.floor(phase / (height / 4)));
  return {
    frame,
    offset: phase - (frame * height) / 4,
    width,
    height,
    x: (world.width - width) / 2,
  };
}

export function shipSprite(s, motion = true) {
  const hurtSeconds = s.config.hurtSeconds ?? 0.3;
  if (s.hurtAt !== null && s.time - s.hurtAt < hurtSeconds) {
    return { set: 'hurt', frame: Math.min(2, Math.floor(((s.time - s.hurtAt) / hurtSeconds) * 3)) };
  }
  return {
    set: s.wave === 1 ? 'flight' : s.wave === 2 ? 'boost' : 'boostVfx',
    frame: motion ? Math.floor(s.spriteTime) % 6 : 0,
  };
}
