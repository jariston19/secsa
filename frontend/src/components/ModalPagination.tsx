interface Props {
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  variant?: "default" | "inline";
}

export default function ModalPagination({
  page,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPageChange,
  variant = "default",
}: Props) {
  if (totalItems === 0) return null;

  return (
    <div className={`modal-pagination${variant === "inline" ? " modal-pagination-inline" : ""}`}>
      <span className="muted">
        Showing {pageStart}–{pageEnd} of {totalItems}
      </span>
      <button
        type="button"
        className="btn secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Previous
      </button>
      <span className="modal-pagination-label">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn secondary btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        Next
      </button>
    </div>
  );
}
