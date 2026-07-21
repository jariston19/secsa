import { useEffect, useMemo, useState, type RefObject } from "react";
import { useListPanelScrollRef } from "../components/ListPanelContext";
import { measurePageSize, type MeasurePageSizeOptions } from "../lib/paginationLayout";

export const MODAL_PAGE_SIZE = 10;
export const CHART_PAGE_SIZE = 5;

interface UsePaginationOptions {
  pageSize?: number;
  resetKey?: string | number;
  containerRef?: RefObject<HTMLElement | null>;
  measure?: MeasurePageSizeOptions & { columns?: number };
}

export function usePagination<T>(items: readonly T[], options: UsePaginationOptions = {}) {
  const listPanelRef = useListPanelScrollRef();
  const containerRef = options.containerRef;
  const resetKey = options.resetKey ?? items.length;
  const [page, setPage] = useState(1);
  const fitToContainer =
    options.pageSize == null && (listPanelRef != null || containerRef != null);
  const [measuredPageSize, setMeasuredPageSize] = useState(
    options.pageSize ?? (containerRef ? CHART_PAGE_SIZE : MODAL_PAGE_SIZE)
  );

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (options.pageSize != null) {
      setMeasuredPageSize(options.pageSize);
      return;
    }

    if (!fitToContainer) {
      setMeasuredPageSize(MODAL_PAGE_SIZE);
      return;
    }

    const measure = options.measure;
    const getContainer = () => containerRef?.current ?? listPanelRef?.current ?? null;

    const update = () => {
      const container = getContainer();
      if (!container) return;

      if (containerRef) {
        const rows = measurePageSize(container, {
          headerSelector: "",
          ...measure,
        });
        const columns = measure?.columns ?? 1;
        const minPageSize = measure?.minPageSize ?? 1;
        setMeasuredPageSize(Math.max(minPageSize, rows * columns));
        return;
      }

      setMeasuredPageSize(
        measurePageSize(container, {
          rowHeightVar: "--list-panel-row-height",
          rowHeightFallbackPx: 44,
        })
      );
    };

    const node = getContainer();
    if (!node) return;

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    options.pageSize,
    options.measure?.rowHeightVar,
    options.measure?.rowHeightFallbackPx,
    options.measure?.reservedHeight,
    options.measure?.minPageSize,
    options.measure?.columns,
    options.measure?.headerSelector,
    fitToContainer,
    listPanelRef,
    containerRef,
    resetKey,
  ]);

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
