import type { ReactNode } from "react";
import AnalyticsPrintButton from "./AnalyticsPrintButton";

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AnalyticsPrintArea({ id, title, subtitle, children }: Props) {
  const printedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="analytics-print-area" id={id}>
      <div className="analytics-print-only-header">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        <p className="analytics-print-date">Printed {printedAt}</p>
      </div>

      {children}
    </div>
  );
}

export function AnalyticsPrintAction({
  areaId,
  title,
  disabled = false,
}: {
  areaId: string;
  title: string;
  disabled?: boolean;
}) {
  return <AnalyticsPrintButton areaId={areaId} title={title} disabled={disabled} />;
}
