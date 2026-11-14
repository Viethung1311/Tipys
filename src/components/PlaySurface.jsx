import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/play-surface.css';

let requested = false;
export const isPlaySurfaceActive = () =>
  requested || document.body.classList.contains('play-surface-open');
/** Call synchronously from the click, before fetching an attempt or mounting its engine. */
export function enterPlayFullscreen() {
  requested = true;
  const root = document.documentElement;
  try {
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    request?.call(root, { navigationUI: 'hide' })?.catch(() => {});
  } catch {
    /* The fixed viewport remains available without native fullscreen. */
  }
}
export default function PlaySurface({ active = true, children }) {
  const node = useRef(null);
  const generation = useRef(0);
  useLayoutEffect(() => {
    if (!active) return;
    const mounted = ++generation.current;
    const root = document.getElementById('root');
    const inert = root?.inert;
    const overflow = document.body.style.overflow;
    const focus = document.activeElement;
    if (root) root.inert = true;
    document.body.classList.add('play-surface-open');
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const resize = () => {
      if (!node.current) return;
      node.current.style.setProperty('--play-height', `${viewport?.height || innerHeight}px`);
      node.current.style.setProperty('--play-width', `${viewport?.width || innerWidth}px`);
      node.current.style.setProperty('--play-top', `${viewport?.offsetTop || 0}px`);
      node.current.style.setProperty('--play-left', `${viewport?.offsetLeft || 0}px`);
    };
    resize();
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    node.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      if (root) root.inert = inert;
      document.body.classList.remove('play-surface-open');
      document.body.style.overflow = overflow;
      // StrictMode replays effects without leaving the game.
      queueMicrotask(() => {
        if (generation.current !== mounted) return;
        const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (requested && fullscreen === document.documentElement) {
          try {
            (document.exitFullscreen || document.webkitExitFullscreen)
              ?.call(document)
              ?.catch(() => {});
          } catch {}
        }
        requested = false;
        window.dispatchEvent(new Event('tipy-play-ended'));
      });
      if (focus?.isConnected) focus.focus?.({ preventScroll: true });
    };
  }, [active]);
  if (!active) return children;
  return createPortal(
    <div ref={node} className="play-surface" tabIndex={-1} aria-label="Khu vực chơi toàn màn hình">
      {children}
    </div>,
    document.body,
  );
}
