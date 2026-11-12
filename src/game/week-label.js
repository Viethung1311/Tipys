export function weekLabel(start) {
  const first = new Date(start + 'T00:00:00Z');
  if (!Number.isFinite(first.getTime())) return '';
  const last = new Date(first);
  last.setUTCDate(last.getUTCDate() + 6);
  const format = (date) =>
    `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${format(first)}–${format(last)}`;
}
