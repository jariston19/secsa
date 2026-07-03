import { useRef, type ReactNode } from "react";
import ChartDownloadButton from "./ChartDownloadButton";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  chartId?: string;
}

export default function AnalyticsPanel({
  title,
  description,
  children,
  className = "",
  chartId,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);

  return (
    <section ref={panelRef} className={`card analytics-panel ${className}`.trim()}>
      <ChartDownloadButton
        targetRef={panelRef}
        fallbackName={chartId ?? title}
        className="chart-slot-download chart-card-download analytics-no-print"
      />
      <div className="analytics-panel-header">
        <div>
          <h3>{title}</h3>
          {description ? <p className="muted section-desc">{description}</p> : null}
        </div>
      </div>
      <div className="analytics-panel-body">{children}</div>
    </section>
  );
}
