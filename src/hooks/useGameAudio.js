import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio, normalizeAudio } from '../game/audio.js';
import { load, save } from '../game/config.js';

export default function useGameAudio(active) {
  const [preferences, setPreferences] = useState(() => normalizeAudio(load('tipy-audio', {}), load('tipy-muted', false)));
  const engine = useRef(null);
  useEffect(() => {
    const audio = new GameAudio();
    engine.current = audio;
    const unlock = () => audio.unlock();
    const click = event => {
      const button = event.target.closest?.('button');
      if (!button || button.disabled || button.closest('[data-audio-control]') || button.closest('.touchboard')) return;
      audio.unlock();
      const picker = button.closest('.picker');
      audio.play(picker ? (button.getAttribute('aria-pressed') === 'true' ? 'deselect' : 'select') : 'click');
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('click', click, true);
      audio.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => { save('tipy-audio', preferences); engine.current?.configure(preferences); }, [preferences]);
  useEffect(() => { engine.current?.setActive(active); }, [active]);
  const play = useCallback(kind => engine.current?.play(kind), []);
  return { preferences, setPreferences, play };
}
