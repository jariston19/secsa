import type { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, description, children, className = "" }: Props) {
  return (
    <article className={`analytics-chart-card ${className}`.trim()}>
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
