import { useRef, type ReactNode } from "react";
import ChartDownloadButton from "../ChartDownloadButton";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  chartId?: string;
}

export default function ChartCard({
  title,
  description,
  children,
  className = "",
  chartId,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);

  return (
    <article ref={cardRef} className={`analytics-chart-card ${className}`.trim()}>
      <ChartDownloadButton
        targetRef={cardRef}
        fallbackName={chartId ?? title}
        className="chart-slot-download chart-card-download analytics-no-print"
      />
      <header className="analytics-chart-card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted analytics-chart-card-desc">{description}</p>
        </div>
      </header>
      <div className="analytics-chart-card-body">{children}</div>
    </article>
  );
}
