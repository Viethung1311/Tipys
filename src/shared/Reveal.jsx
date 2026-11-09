import { useEffect, useRef } from 'react';
/** Reveal once, disconnect immediately; no scroll listener or perpetual animation. */
export default function Reveal({ children, className = '' }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!('IntersectionObserver' in window)) return;
    el.classList.add('reveal-pending');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          el.classList.remove('reveal-pending');
          observer.disconnect();
        }
      },
      { threshold: 0.06 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className={`screen-reveal ${className}`}>
      {children}
    </div>
  );
}
