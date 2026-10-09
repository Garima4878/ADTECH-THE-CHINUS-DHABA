interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-sm sm:flex-row">
      <p className="text-stone-500">
        Showing <span className="font-semibold text-stone-700">{from}</span>–
        <span className="font-semibold text-stone-700">{to}</span> of{" "}
        <span className="font-semibold text-stone-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-3 py-1.5"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          ← Prev
        </button>
        <span className="px-2 text-stone-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
