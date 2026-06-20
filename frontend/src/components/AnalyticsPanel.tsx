import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function AnalyticsPanel({ title, description, children, className = "" }: Props) {
  return (
    <section className={`card analytics-panel ${className}`.trim()}>
      <h3>{title}</h3>
      {description ? <p className="muted section-desc">{description}</p> : null}
      <div className="analytics-panel-body">{children}</div>
    </section>
  );
}
