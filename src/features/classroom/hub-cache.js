export const shortName = (name) =>
  String(name || '')
    .trim()
    .normalize('NFC')
    .split(/\s+/u)
    .at(-1) || 'Bạn';
export function readHub(cache, key, load) {
  const cached = cache.get(key);
  if (cached && (cached.promise || Date.now() - cached.time < 60000))
    return cached.promise || Promise.resolve(cached.data);
  const entry = { time: Date.now() };
  entry.promise = load().then(
    (data) => {
      if (cache.get(key) === entry)
        cache.set(key, { data, time: Date.now(), receivedAt: performance.now() });
      return data;
    },
    (error) => {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    },
  );
  cache.set(key, entry);
  return entry.promise;
}
export function invalidateHub(cache, prefix) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}
