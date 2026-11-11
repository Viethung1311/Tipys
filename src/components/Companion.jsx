import { useEffect, useRef, useState } from 'react';
import { characterFor } from '../characters/catalog.js';
import '../styles/companion.css';
function viewport() {
  const v = window.visualViewport;
  const width = v?.width || innerWidth,
    height = v?.height || innerHeight,
    size = Math.max(1, Math.min(width <= 680 ? 72 : 96, width - 24, height - 24));
  return {
    left: (v?.offsetLeft || 0) + 12,
    top: (v?.offsetTop || 0) + 12,
    width: Math.max(0, width - size - 24),
    height: Math.max(0, height - size - 24),
    size,
  };
}
/** Drag state stays here so pointer movement never rerenders the game. Persist only on release. */
export default function Companion({ avatar, preferences, onPosition }) {
  const [area, setArea] = useState(viewport),
    [position, setPosition] = useState({ x: preferences.x, y: preferences.y }),
    [dragging, setDragging] = useState(false);
  const drag = useRef(null),
    current = useRef(position);
  const character = characterFor(avatar.animal);
  const move = (next) => {
    current.current = next;
    setPosition(next);
  };
  useEffect(() => {
    move({ x: preferences.x, y: preferences.y });
  }, [preferences.x, preferences.y]);
  useEffect(() => {
    const resize = () => {
      drag.current = null;
      setDragging(false);
      setArea(viewport());
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, []);
  const cancel = () => {
    if (drag.current) {
      move(drag.current.position);
      drag.current = null;
      setDragging(false);
    }
  };
  return (
    <button
      type="button"
      className={`tipy-companion${dragging ? ' is-dragging' : ''}`}
      aria-label={`Bạn đồng hành ${character.name}. Kéo để di chuyển hoặc dùng phím mũi tên.`}
      style={{
        left: area.left + position.x * area.width,
        top: area.top + position.y * area.height,
        width: area.size,
        height: area.size,
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          position: current.current,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        move({
          x: Math.max(
            0,
            Math.min(1, start.position.x + (event.clientX - start.x) / Math.max(1, area.width)),
          ),
          y: Math.max(
            0,
            Math.min(1, start.position.y + (event.clientY - start.y) / Math.max(1, area.height)),
          ),
        });
      }}
      onPointerUp={(event) => {
        if (drag.current?.id !== event.pointerId) return;
        event.stopPropagation();
        drag.current = null;
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
        onPosition(current.current);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        const delta = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!delta) return;
        event.preventDefault();
        move({
          x: Math.max(
            0,
            Math.min(1, current.current.x + (delta[0] * 12) / Math.max(1, area.width)),
          ),
          y: Math.max(
            0,
            Math.min(1, current.current.y + (delta[1] * 12) / Math.max(1, area.height)),
          ),
        });
      }}
      onKeyUp={(event) => {
        event.stopPropagation();
        if (event.key.startsWith('Arrow')) onPosition(current.current);
      }}
    >
      <img
        src={character.src}
        alt=""
        draggable={false}
        width="96"
        height="96"
        onDragStart={(event) => event.preventDefault()}
      />
    </button>
  );
}
