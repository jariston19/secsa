import { type DragEvent, type ReactNode, useRef } from "react";
import ChartDownloadButton from "./ChartDownloadButton";

interface Props {
  chartId?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  children: ReactNode;
}

export default function ChartSlotShell({
  chartId,
  draggable = false,
  onDragStart,
  onDragEnd,
  children,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="chart-slot-shell">
      <div className="chart-slot-toolbar analytics-no-print">
        <ChartDownloadButton
          targetRef={contentRef}
          fallbackName={chartId ?? "chart"}
          className="chart-slot-download chart-slot-shell-download"
        />
        {draggable ? (
          <button
            type="button"
            className="chart-card-drag-handle"
            draggable
            aria-label="Drag to reorder chart"
            title="Drag to reorder"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <span aria-hidden>⋮⋮</span>
          </button>
        ) : null}
      </div>
      <div ref={contentRef} className="chart-slot-content">
        {children}
      </div>
    </div>
  );
}
