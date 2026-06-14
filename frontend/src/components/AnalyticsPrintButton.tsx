import { printAnalyticsArea } from "../lib/printAnalytics";

interface Props {
  areaId: string;
  title: string;
  disabled?: boolean;
}

export default function AnalyticsPrintButton({ areaId, title, disabled = false }: Props) {
  return (
    <button
      type="button"
      className="btn secondary analytics-print-btn"
      onClick={() => printAnalyticsArea(areaId)}
      disabled={disabled}
      aria-label={`Print ${title}`}
    >
      Print
    </button>
  );
}
