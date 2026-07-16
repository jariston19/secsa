interface Props {
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemNoun?: string;
  searchQuery?: string;
  layout?: "end" | "split";
}

export default function ModalPagination({
  page,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPageChange,
  itemNoun,
  searchQuery,
  layout = "end",
}: Props) {
  if (totalItems === 0) return null;

  const showNavigation = totalPages > 1;
  const searchSuffix = searchQuery?.trim() ? ` matching “${searchQuery.trim()}”` : "";
  const rangeLabel = itemNoun
    ? `Showing ${pageStart}–${pageEnd} of ${totalItems} ${itemNoun}${totalItems === 1 ? "" : "s"}`
    : `Showing ${pageStart}–${pageEnd} of ${totalItems}`;
  const singlePageSummary = itemNoun
    ? `${totalItems} ${itemNoun}${totalItems === 1 ? "" : "s"}`
    : `Showing ${pageStart}–${pageEnd} of ${totalItems}`;
  const summaryText = showNavigation
    ? `${rangeLabel}${searchSuffix}`
    : `${singlePageSummary}${searchSuffix}`;

  return (
    <div
      className={`modal-pagination modal-pagination-inline${
        layout === "split" ? " modal-pagination-split" : ""
      }`}
    >
      <span className="muted modal-pagination-summary">{summaryText}</span>
      {showNavigation ? (
        <div className="modal-pagination-actions">
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
      ) : null}
    </div>
  );
}
