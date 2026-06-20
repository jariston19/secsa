import type { ReactNode } from "react";
import { ANALYTICS_SLOT_CLASS, type AnalyticsSlotSize } from "../lib/analyticsLayout";

interface Props {
  size?: AnalyticsSlotSize;
  className?: string;
  children: ReactNode;
}

export default function AnalyticsChartSlot({
  size = "tall",
  className = "",
  children,
}: Props) {
  return (
    <div
      className={["analytics-chart-grid-slot", ANALYTICS_SLOT_CLASS[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
