import { useAnalyticsSeason } from "../lib/analyticsSeason";

interface Props {
  variant?: "overview" | "bar";
}

export default function AnalyticsSeasonControl({ variant = "bar" }: Props) {
  const { examYear, setExamYear, availableYears, loadingYears, seasonLabel } =
    useAnalyticsSeason();

  const isOverview = variant === "overview";

  return (
    <div
      className={
        isOverview
          ? "analytics-season-setting card"
          : "analytics-season-bar analytics-no-print"
      }
    >
      <div className="analytics-season-copy">
        <strong>
          {isOverview ? "Analytics period" : "Showing"} · {seasonLabel}
        </strong>
        {isOverview ? (
          <p className="muted">
            Choose all collected exam years or one calendar year. Other analytics tabs follow
            this setting.
          </p>
        ) : null}
      </div>
      <label className="analytics-season-field">
        {isOverview ? "Exam year" : "Period"}
        <select
          value={examYear === "ALL" ? "ALL" : String(examYear)}
          disabled={loadingYears}
          onChange={(event) => {
            const value = event.target.value;
            setExamYear(value === "ALL" ? "ALL" : Number(value));
          }}
        >
          <option value="ALL">All collected years</option>
          {availableYears.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
