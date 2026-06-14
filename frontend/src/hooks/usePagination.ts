import { useEffect, useMemo, useState } from "react";

export const MODAL_PAGE_SIZE = 10;

interface UsePaginationOptions {
  pageSize?: number;
  resetKey?: string | number;
}

export function usePagination<T>(items: readonly T[], options: UsePaginationOptions = {}) {
  const pageSize = options.pageSize ?? MODAL_PAGE_SIZE;
  const resetKey = options.resetKey ?? items.length;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const pageStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, items.length);

  return {
    page,
    setPage,
    totalPages,
    paginatedItems,
    pageStart,
    pageEnd,
    totalItems: items.length,
  };
}
