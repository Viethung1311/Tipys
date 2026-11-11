import { useEffect, useState } from 'react';
import { companionKey, readCompanion, saveCompanion } from '../characters/companion-settings.js';
export default function useCompanion(userId) {
  const key = companionKey(userId);
  const [state, setState] = useState(() => ({ key, value: readCompanion(key) }));
  useEffect(() => setState({ key, value: readCompanion(key) }), [key]);
  const value = state.key === key ? state.value : readCompanion(key);
  const change = (patch) => {
    const next = { ...value, ...patch };
    setState({ key, value: next });
    saveCompanion(key, next);
  };
  return [value, change];
}
