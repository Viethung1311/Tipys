import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bubblePosition, createSpeechGate, SPEECH_EVENT } from '../characters/companion-speech.js';

export default function CompanionSpeech({ anchor, position, size, interaction }) {
  const [speech, setSpeech] = useState(null),
    [location, setLocation] = useState(null);
  const gate = useRef(createSpeechGate()),
    bubble = useRef(null),
    timer = useRef(null),
    speak = useRef(null);
  useEffect(() => {
    const say = (group) => {
      if (document.hidden) return;
      const next = gate.current(group, Date.now());
      if (!next) return;
      clearTimeout(timer.current);
      setSpeech(next);
      timer.current = setTimeout(() => setSpeech(null), 2500);
    };
    speak.current = say;
    const event = (e) => say(e.detail);
    const welcome = setTimeout(() => say('welcome'), 0);
    let idle;
    const activity = () => {
      clearTimeout(idle);
      idle = setTimeout(() => say('rest'), 120000);
    };
    const hidden = () => {
      if (document.hidden) {
        clearTimeout(timer.current);
        setSpeech(null);
      }
      activity();
    };
    activity();
    window.addEventListener(SPEECH_EVENT, event);
    window.addEventListener('pointerdown', activity, { passive: true });
    window.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clearTimeout(welcome);
      clearTimeout(idle);
      clearTimeout(timer.current);
      window.removeEventListener(SPEECH_EVENT, event);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', hidden);
      speak.current = null;
    };
  }, []);
  useEffect(() => {
    if (interaction) speak.current?.(interaction.group);
  }, [interaction]);
  useLayoutEffect(() => {
    if (!speech) return;
    const place = () => {
      if (!bubble.current || !anchor.current) return;
      const v = window.visualViewport;
      const left = v?.offsetLeft || 0,
        top = v?.offsetTop || 0;
      const obstacles = [
        ...document.querySelectorAll(
          '.arena,.quest-player,.quest-result,button,input,textarea,select,a',
        ),
      ]
        .filter((el) => el !== anchor.current && !el.closest('[role="dialog"]'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height);
      setLocation(
        bubblePosition(
          anchor.current.getBoundingClientRect(),
          bubble.current.getBoundingClientRect(),
          {
            left,
            top,
            right: left + (v?.width || innerWidth),
            bottom: top + (v?.height || innerHeight),
          },
          obstacles,
        ),
      );
    };
    place();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    observer?.observe(document.body);
    observer?.observe(bubble.current);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [speech, position, size, anchor]);
  return (
    speech && (
      <span
        ref={bubble}
        className="companion-bubble"
        role="status"
        style={{
          left: location?.left ?? 0,
          top: location?.top ?? 0,
          visibility: location ? 'visible' : 'hidden',
        }}
      >
        {speech.text}
      </span>
    )
  );
}
