import { explosionFrame } from './engine.js';

import { ART, SHIP_ANCHORS } from './art.js';
import { backgroundPosition, shipSprite } from './animation.js';
export { ART } from './art.js';

export function renderGuard(
  canvas,
  labels,
  s,
  images,
  reduced,
  flightMotion = !reduced,
  inputLayer,
) {
  const rect = canvas.getBoundingClientRect(),
    w = rect.width,
    h = rect.height;
  if (!w || !h) return;
  const c = s.config,
    W = c.world.width,
    H = c.world.height,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d'),
    scale = Math.min(w / W, h / H);
  const ox = (w - W * scale) / 2,
    oy = (h - H * scale) / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  // Explicit flight motion may be enabled by the player without restoring decorative flashing.
  const bg = backgroundPosition(
    flightMotion ? s.movementTime : 0,
    c.background.scrollSpeed,
    c.world,
  );
  const image = images[`space${bg.frame}`];
  ctx.fillStyle = '#180e36';
  ctx.fillRect(0, 0, W, H);
  if (image?.naturalWidth) {
    // The source already contains the quarter-frame shift: apply only the remainder.
    for (let y = bg.offset - bg.height; y < H; y += bg.height) {
      ctx.drawImage(image, bg.x, y, bg.width, bg.height);
    }
  }
  ctx.fillStyle = '#d4eaff';
  for (let i = 0; i < c.background.starCount; i++) {
    const x = (i * 137 + 31) % W,
      y = (i * 211 + (flightMotion ? s.movementTime : 0) * c.background.starSpeed) % H;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const draw = (name, x, y, length, angle = 0, alpha = 1) => {
    const image = images[name],
      crop = ART[name].crop || [0, 0, image?.naturalWidth, image?.naturalHeight];
    if (!image?.naturalWidth) return;
    const width = (length * crop[2]) / crop[3];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, ...crop, -width / 2, -length / 2, width, length);
    ctx.restore();
  };
  s.targets.forEach((t, i) => {
    draw('meteor', t.x, t.y, c.meteorSize, reduced ? 0 : t.rotation);
    const label = labels.children[i];
    label.hidden = false;
    label.textContent = t.label || t.key;
    const inset = Math.min(58, Math.max(0, (w - 16) / 2));
    label.style.left = `${Math.max(inset, Math.min(w - inset, ox + t.x * scale))}px`;
    label.style.top = `${oy + (t.y + c.meteorSize * 0.8) * scale}px`;
    label.style.fontSize = `${Math.max(18, 26 * scale)}px`;
    label.dataset.active = String(s.inputTargetId === t.id);
    label.setAttribute('aria-label', `${t.label || t.key} · ${t.topic || 'Từ vựng'}`);
    label.dataset.state = t.state;
    label.dataset.targetId = String(t.id);
  });
  for (let i = s.targets.length; i < labels.children.length; i++) labels.children[i].hidden = true;
  if (inputLayer) {
    inputLayer.style.left = `${ox + c.ship.x * scale}px`;
    inputLayer.style.top = `${oy + (c.ship.y - c.ship.length * 0.85) * scale}px`;
  }
  const powered = s.energy === c.energyMax,
    protectedNow = s.time < s.protectedUntil;
  const alpha =
    !powered && protectedNow ? (reduced ? 0.65 : 0.45 + 0.55 * Math.abs(Math.sin(s.time * 16))) : 1;
  const sprite = shipSprite(s, flightMotion);
  const anchor = SHIP_ANCHORS[sprite.set];
  const shipImage = images[`${sprite.set}${sprite.frame}`];
  if (shipImage?.naturalWidth) {
    const ratio = c.ship.length / anchor.length;
    ctx.save();
    ctx.translate(c.ship.x, c.ship.y);
    ctx.rotate(s.aim + c.ship.spriteAngle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      shipImage,
      -anchor.x * ratio,
      -anchor.y * ratio,
      anchor.canvasSize * ratio,
      anchor.canvasSize * ratio,
    );
    ctx.restore();
  }
  const shieldFlash = s.shieldAt !== null && s.time - s.shieldAt < 0.3;
  if (powered || shieldFlash) {
    // Keep the supplied shield ring; clip out its static ship so flight stays animated.
    const radius = c.ship.length * 0.83;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.ship.x, c.ship.y, radius, 0, Math.PI * 2);
    ctx.arc(c.ship.x, c.ship.y, radius * 0.83, 0, Math.PI * 2);
    ctx.clip('evenodd');
    draw(
      'shield',
      c.ship.x,
      c.ship.y,
      radius * 2,
      s.aim + c.ship.spriteAngle,
      powered ? 1 : 1 - (s.time - s.shieldAt) / 0.3,
    );
    ctx.restore();
  }
  if (s.time < s.flashUntil) {
    const x = c.ship.x + Math.sin(s.aim) * c.ship.muzzleOffset,
      y = c.ship.y - Math.cos(s.aim) * c.ship.muzzleOffset;
    ctx.fillStyle = '#d7ffff';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  s.bullets
    .filter((b) => b.emitted)
    .forEach((b) => draw('bolt', b.x, b.y, c.ship.length * c.bulletLengthRatio, b.angle));
  for (const e of s.effects) {
    const frame = explosionFrame(e, s.time, c.explosionSeconds);
    draw(`explosion${frame}`, e.x, e.y, c.meteorSize * 1.65);
    ctx.font = '900 28px "TIPY Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff4a8';
    ctx.fillText(
      `+${e.points}`,
      e.x,
      e.y - c.meteorSize * 0.7 - (reduced ? 0 : (s.time - e.at) * 30),
    );
  }
}
