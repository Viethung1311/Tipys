import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis } from 'lucide-react';
import TipyButton from './TipyButton.jsx';
import '../styles/action-menu.css';

export default function ActionMenu({ label = 'Tùy chọn', description, disabled, items, children }) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState(null);
  const anchor = useRef(null),
    menu = useRef(null),
    id = useId();
  const close = (restore = false) => {
    if (restore) anchor.current?.querySelector('button')?.focus();
    setOpen(false);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = anchor.current.getBoundingClientRect();
      const width = Math.min(260, innerWidth - 24);
      const height = Math.min(menu.current.offsetHeight, innerHeight - 24);
      setPosition({
        width,
        left: Math.max(12, Math.min(box.right - width, innerWidth - width - 12)),
        top: Math.max(
          12,
          Math.min(
            box.bottom + height + 8 <= innerHeight ? box.bottom + 8 : box.top - height - 8,
            innerHeight - height - 12,
          ),
        ),
      });
    };
    place();
    const outside = (e) => {
      if (!anchor.current.contains(e.target) && !menu.current.contains(e.target)) close();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  const positioned = !!position;
  useLayoutEffect(() => {
    if (open && positioned) menu.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open, positioned]);
  useLayoutEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <>
      <span ref={anchor} className={children ? 'tipy-avatar-menu' : undefined}>
        <TipyButton
          emphasis="secondary"
          icon={Ellipsis}
          className={children ? 'tipy-avatar-trigger' : ''}
          disabled={disabled}
          aria-label={description ? `${label}: ${description}` : label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => {
            setPosition(null);
            setOpen(!open);
          }}
          onKeyDown={(e) => {
            if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {children || label}
        </TipyButton>
      </span>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={description || label}
            className="tipy-action-menu"
            style={position || { visibility: 'hidden' }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) close();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close(true);
              }
              if (e.key === 'Tab') close(true);
              const buttons = [...e.currentTarget.querySelectorAll('[role="menuitem"]')];
              const index = buttons.indexOf(document.activeElement);
              const next = {
                ArrowDown: (index + 1) % buttons.length,
                ArrowUp: (index + buttons.length - 1) % buttons.length,
                Home: 0,
                End: buttons.length - 1,
              }[e.key];
              if (next !== undefined) {
                e.preventDefault();
                buttons[next]?.focus();
              }
            }}
          >
            {items.map(({ label: text, icon, danger, onClick }) => (
              <TipyButton
                key={text}
                role="menuitem"
                emphasis="secondary"
                icon={icon}
                className={danger ? 'tipy-button--danger' : ''}
                onClick={() => {
                  close(true);
                  onClick();
                }}
              >
                {text}
              </TipyButton>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
