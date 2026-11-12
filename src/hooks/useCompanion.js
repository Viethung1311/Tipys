import { useCallback, useEffect, useState } from 'react';
import { companionKey, readCompanion, saveCompanion } from '../characters/companion-settings.js';
export default function useCompanion(userId) {
  const key = companionKey(userId);
  const [state, setState] = useState(() => ({ key, value: readCompanion(key) }));
  const [draft, setDraft] = useState(null);
  const preview = useCallback((size) => setDraft(size === null ? null : { key, size }), [key]);
  useEffect(() => setState({ key, value: readCompanion(key) }), [key]);
  const value = state.key === key ? state.value : readCompanion(key);
  const change = (patch) => {
    const next = { ...value, ...patch };
    setState({ key, value: next });
    saveCompanion(key, next);
  };
  return [value, change, draft?.key === key ? draft.size : null, preview];
}
