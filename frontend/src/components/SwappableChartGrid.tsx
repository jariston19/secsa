import { type ReactNode, useState } from "react";
import { slotClassForChart, type AnalyticsSlotSize } from "../lib/analyticsLayout";

interface Props {
  order: string[];
  onOrderChange: (order: string[]) => void;
  slotLayout?: Partial<Record<string, AnalyticsSlotSize>>;
  /** @deprecated Use slotLayout with wide entries instead */
  wideIds?: readonly string[];
  children: (id: string) => ReactNode;
}

function reorder(order: string[], fromId: string, toId: string) {
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

export default function SwappableChartGrid({
  order,
  onOrderChange,
  slotLayout = {},
  wideIds = [],
  children,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className="analytics-chart-grid analytics-chart-grid-swappable">
      {order.map((id) => (
        <div
          key={id}
          className={[
            "analytics-chart-grid-slot",
            slotClassForChart(id, slotLayout, wideIds),
            draggingId === id ? "is-dragging" : "",
            overId === id && draggingId !== id ? "is-drop-target" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingId && draggingId !== id) setOverId(id);
          }}
          onDragLeave={() => {
            if (overId === id) setOverId(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingId) onOrderChange(reorder(order, draggingId, id));
            setDraggingId(null);
            setOverId(null);
          }}
        >
          <button
            type="button"
            className="chart-card-drag-handle analytics-no-print"
            draggable
            aria-label="Drag to reorder chart"
            title="Drag to reorder"
            onDragStart={(event) => {
              setDraggingId(id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
          >
            <span aria-hidden>⋮⋮</span>
          </button>
          {children(id)}
        </div>
      ))}
    </div>
  );
}
