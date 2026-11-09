import { useEffect, useState } from 'react';

/** Keep dialogs inside the visible area when a mobile keyboard or zoom changes it. */
export default function useDialogViewport(open) {
  const [style, setStyle] = useState(undefined);
  useEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame;
    const measure = () =>
      setStyle({
        '--dialog-height': `${viewport.height}px`,
        '--dialog-width': `${viewport.width}px`,
        '--dialog-top': `${viewport.offsetTop}px`,
        '--dialog-left': `${viewport.offsetLeft}px`,
      });
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
    };
  }, [open]);
  return style;
}
