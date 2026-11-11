export default function Pagination({ page, pages, total, onPage, disabled }) {
  const numbers = [...new Set([1, pages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  return (
    <nav className="admin-pagination" aria-label="Phân trang">
      <span>
        {total} tài khoản phù hợp · Trang {page}/{pages}
      </span>
      <button disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        Trước
      </button>
      {numbers.map((n, index) => (
        <span key={n}>
          {index > 0 && n > numbers[index - 1] + 1 && <span aria-hidden="true">…</span>}
          <button
            disabled={disabled}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Trang ${n}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        </span>
      ))}
      <button disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
        Sau
      </button>
    </nav>
  );
}
