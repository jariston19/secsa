import type { ReactNode } from "react";
import AnalyticsSeasonControl from "./AnalyticsSeasonControl";
import SegmentedControl from "./SegmentedControl";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { incomingYearLevelsForFilter } from "../lib/constants";

export type RosterYearFilter = "ALL" | "1" | "2" | "3" | "4" | "5";

export type RosterStat = {
  label: string;
  value: number | string;
};

type Tab = {
  id: string;
  label: string;
};

interface Props {
  title: string;
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  courseFilter: ProgramCourseFilter;
  onCourseFilterChange: (value: ProgramCourseFilter) => void;
  yearFilter: RosterYearFilter;
  onYearFilterChange: (value: RosterYearFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  stats: RosterStat[];
  note?: ReactNode;
  error?: string;
  printDisabled?: boolean;
  onPrint: () => void;
  children: ReactNode;
}

export default function AnalyticsRosterLayout({
  title,
  tabs,
  activeTab,
  onTabChange,
  courseFilter,
  onCourseFilterChange,
  yearFilter,
  onYearFilterChange,
  searchQuery,
  onSearchQueryChange,
  stats,
  note,
  error,
  printDisabled,
  onPrint,
  children,
}: Props) {
  const programCourseOptions = useProgramCourseOptions();

  return (
    <>
      <header className="analytics-roster-header analytics-no-print">
        <h2>{title}</h2>
        <div className="analytics-roster-header-actions">
          <AnalyticsSeasonControl variant="compact" />
          <button
            type="button"
            className="btn secondary btn-sm analytics-print-btn"
            onClick={onPrint}
            disabled={printDisabled}
          >
            Print list
          </button>
        </div>
      </header>

      <div className="analytics-roster-toolbar analytics-no-print">
        <SegmentedControl
          segments={[...tabs]}
          value={activeTab}
          onChange={onTabChange}
          scrollable
        />
        <div className="analytics-roster-filters">
          <label className="analytics-roster-filter">
            Course
            <select
              value={courseFilter}
              onChange={(event) =>
                onCourseFilterChange(event.target.value as ProgramCourseFilter)
              }
            >
              <option value="ALL">All</option>
              {programCourseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.label}
                </option>
              ))}
            </select>
          </label>
          <label className="analytics-roster-filter">
            Year
            <select
              value={yearFilter}
              onChange={(event) =>
                onYearFilterChange(event.target.value as RosterYearFilter)
              }
            >
              <option value="ALL">All</option>
              {incomingYearLevelsForFilter(courseFilter).map((level) => (
                <option key={level} value={String(level)}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="analytics-roster-filter analytics-roster-filter-search">
            Search
            <input
              type="search"
              placeholder="Name or email…"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      <div
        className={`analytics-rankings-summary analytics-roster-summary analytics-roster-summary-${stats.length} analytics-no-print`}
      >
        {stats.map((stat) => (
          <article key={stat.label} className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      {note ? <p className="muted analytics-roster-note analytics-no-print">{note}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {children}
    </>
  );
}

export function formatRosterDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRosterScore(
  percentage: number | null | undefined,
  score: number | null | undefined
) {
  if (percentage == null) return "—";
  return score != null ? `${percentage.toFixed(1)}% · ${score}` : `${percentage.toFixed(1)}%`;
}

export function rosterCourseLabel(course: string | null) {
  return course ? formatProgramCourse(course) : "—";
}
