/** Small CSS-only loader; rendered only while work is pending. */
export default function Loading({ label = 'Đang tải…', fullscreen = false }) {
  return (
    <div
      className={`tipy-loading ${fullscreen ? 'loading-fullscreen' : ''}`}
      role="status"
      aria-label={label}
    >
      <div className="loading-letters" aria-hidden="true">
        <span className="loading-key">A</span>
      </div>
      <p>{label}</p>
    </div>
  );
}
