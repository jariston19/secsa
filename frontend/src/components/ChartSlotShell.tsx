import { Download } from "lucide-react";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { downloadChartPng } from "../lib/downloadChartPng";

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
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!contentRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadChartPng(contentRef.current, chartId ?? "chart");
    } catch (error) {
      console.error(error);
      window.alert(
        "Could not download chart image. Rebuild the frontend, then hard-refresh the page (Ctrl+Shift+R)."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="chart-slot-toolbar analytics-no-print">
        <button
          type="button"
          className="chart-slot-download"
          aria-label="Download chart as PNG"
          title="Download PNG"
          disabled={downloading}
          onClick={() => void handleDownload()}
        >
          <Download aria-hidden size={14} strokeWidth={2} />
        </button>
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
    </>
  );
}
