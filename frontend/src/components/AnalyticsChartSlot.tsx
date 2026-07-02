import type { ReactNode } from "react";
import ChartSlotShell from "./ChartSlotShell";
import { ANALYTICS_SLOT_CLASS, type AnalyticsSlotSize } from "../lib/analyticsLayout";

interface Props {
  size?: AnalyticsSlotSize;
  className?: string;
  chartId?: string;
  children: ReactNode;
}

export default function AnalyticsChartSlot({
  size = "tall",
  className = "",
  chartId,
  children,
}: Props) {
  return (
    <div
      className={["analytics-chart-grid-slot", ANALYTICS_SLOT_CLASS[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      <ChartSlotShell chartId={chartId}>{children}</ChartSlotShell>
    </div>
  );
}
