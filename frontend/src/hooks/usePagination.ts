import { useEffect, useMemo, useState } from "react";
import { useListPanelScrollRef } from "../components/ListPanelContext";
import { measurePageSize } from "../lib/paginationLayout";

export const MODAL_PAGE_SIZE = 10;
export const CHART_PAGE_SIZE = 5;

interface UsePaginationOptions {
  pageSize?: number;
  resetKey?: string | number;
}

export function usePagination<T>(items: readonly T[], options: UsePaginationOptions = {}) {
  const listPanelRef = useListPanelScrollRef();
  const resetKey = options.resetKey ?? items.length;
  const [page, setPage] = useState(1);
  const fitToContainer = options.pageSize == null && listPanelRef != null;
  const [measuredPageSize, setMeasuredPageSize] = useState(
    options.pageSize ?? MODAL_PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (options.pageSize != null) {
      setMeasuredPageSize(options.pageSize);
      return;
    }

    if (!fitToContainer || !listPanelRef) {
      setMeasuredPageSize(MODAL_PAGE_SIZE);
      return;
    }

    const node = listPanelRef.current;
    if (!node) return;

    const update = () => {
      const container = listPanelRef.current;
      if (!container) return;
      setMeasuredPageSize(
        measurePageSize(container, {
          rowHeightVar: "--list-panel-row-height",
          rowHeightFallbackPx: 44,
        })
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [options.pageSize, fitToContainer, listPanelRef, resetKey]);

  const pageSize = options.pageSize ?? measuredPageSize;
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
    pageSize,
    totalPages,
    paginatedItems,
    pageStart,
    pageEnd,
    totalItems: items.length,
  };
}
