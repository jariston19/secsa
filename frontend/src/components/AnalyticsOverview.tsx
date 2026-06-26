import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { VerticalHistogram, DonutChart } from "./charts/AnalyticsCharts";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import SwappableChartGrid from "./SwappableChartGrid";
import { useChartOrder } from "../hooks/useChartOrder";
import { OVERVIEW_CHART_LAYOUT } from "../lib/analyticsLayout";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { api } from "../lib/api";
import { useAnalyticsSeason } from "../lib/analyticsSeason";
import AnalyticsSeasonControl from "./AnalyticsSeasonControl";

export interface OverviewCohortPassStats {
  count: number;
  passRate: number;
  passed: number;
  failed: number;
}

export interface OverviewExamTypeHealth {
  passRate: number;
  examsTaken: number;
  averageScore: number;
  passed: number;
  failed: number;
  trend: {
    week: { current: number; previous: number; delta: number; exams: number };
    month: { current: number; previous: number; delta: number; exams: number };
  };
  scoreDistribution: Array<{ label: string; students: number }>;
  cohorts?: {
    firstTakers: OverviewCohortPassStats;
    retakers: OverviewCohortPassStats;
  };
}

export interface OverviewDashboardData {
  students: number;
  examsTaken: number;
  passRate: number;
  averageScore: number;
  performanceHealth: {
    comprehensive: OverviewExamTypeHealth;
    diagnostic: OverviewExamTypeHealth;
    failingStudents: number;
  };
  retakeEffectiveness: {
    retakersWhoEventuallyPassed: number;
    totalRetakerStudents: number;
    eventualPassRate: number;
    averageAttemptsToPass: number;
    exhaustedRetakeLimit: number;
    firstTakers: { count: number; passRate: number; averageScore: number };
    retakers: { count: number; passRate: number; averageScore: number };
  };
  examActivity: {
    examsThisWeek: number;
    examsLastWeek: number;
    examsThisMonth: number;
    examsLastMonth: number;
    pendingRetakeApprovals: number;
    lastSubmissionAt: string | null;
  };
  atRisk: {
    failedNotRetaken: number;
    failingStudents: number;
  };
  passRateByYear: Array<{ yearLevel: number; students: number; passRate: number }>;
}

const OVERVIEW_CHART_ORDER = [
  "average-score-breakdown",
  "pass-rate-comprehensive",
  "pass-rate-diagnostic",
  "score-distribution-comprehensive",
  "score-distribution-diagnostic",
  "retake-success",
  "at-risk",
  "exam-activity",
  "pass-rate-by-year",
] as const;

type OverviewChartId = (typeof OVERVIEW_CHART_ORDER)[number];

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

function formatRelativeTime(iso: string | null) {
  if (!iso) return "No submissions yet";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  token: string | null;
}

function DiagnosticPassRateCard({ health }: { health: OverviewExamTypeHealth }) {
  return (
    <article className="overview-hero-card overview-hero-pass overview-hero-pass-diagnostic overview-hero-pass-donut">
      <div className="overview-hero-card-top">
        <div>
          <h3>Pass Rate — Diagnostic</h3>
          <p className="muted">Pass vs fail on incoming diagnostic exams</p>
        </div>
      </div>
      <DonutChart
        value={health.passRate}
        label="passed"
        passed={health.passed}
        failed={health.failed}
      />
    </article>
  );
}

function ComprehensivePassRateCard({
  health,
}: {
  health: OverviewExamTypeHealth;
}) {
  const cohorts = health.cohorts ?? {
    firstTakers: { count: 0, passRate: 0, passed: 0, failed: 0 },
    retakers: { count: 0, passRate: 0, passed: 0, failed: 0 },
  };

  return (
    <article className="overview-hero-card overview-hero-pass overview-hero-pass-comprehensive">
      <div className="overview-hero-card-top">
        <div>
          <h3>Pass Rate — Comprehensive</h3>
          <p className="muted">First-time vs retake attempts on comprehensive exams</p>
        </div>
      </div>
      <div className="overview-pass-donut-grid">
        <div className="overview-pass-donut-item">
          <span className="overview-pass-donut-title">First takers</span>
          <DonutChart
            value={cohorts.firstTakers.passRate}
            label="passed"
            passed={cohorts.firstTakers.passed}
            failed={cohorts.firstTakers.failed}
          />
        </div>
        <div className="overview-pass-donut-item">
          <span className="overview-pass-donut-title">Retakers</span>
          <DonutChart
            value={cohorts.retakers.passRate}
            label="passed"
            passed={cohorts.retakers.passed}
            failed={cohorts.retakers.failed}
          />
        </div>
      </div>
    </article>
  );
}

function AverageScoreColumn({
  title,
  value,
  exams,
}: {
  title: string;
  value: number;
  exams: number;
}) {
  return (
    <div className="overview-pass-donut-item">
      <span className="overview-pass-donut-title">{title}</span>
      <DonutChart
        metric="averageScore"
        value={value}
        exams={exams}
      />
    </div>
  );
}

function AverageScoreBreakdownCard({ data }: { data: OverviewDashboardData }) {
  const comprehensive = data.performanceHealth.comprehensive;
  const diagnostic = data.performanceHealth.diagnostic;
  const repeaters = data.retakeEffectiveness.retakers;

  return (
    <article className="overview-hero-card overview-hero-pass overview-hero-pass-average-score">
      <div className="overview-hero-card-top">
        <div>
          <h3>Average Score</h3>
          <p className="muted">Mean exam score by comprehensive, diagnostic, and retake attempts.</p>
        </div>
      </div>
      <div className="overview-pass-donut-grid overview-pass-donut-grid-three">
        <AverageScoreColumn
          title="Comprehensive"
          value={comprehensive.averageScore ?? 0}
          exams={comprehensive.examsTaken}
        />
        <AverageScoreColumn
          title="Diagnostic"
          value={diagnostic.averageScore ?? 0}
          exams={diagnostic.examsTaken}
        />
        <AverageScoreColumn
          title="Repeaters"
          value={repeaters.averageScore}
          exams={repeaters.count}
        />
      </div>
    </article>
  );
}

function ScoreDistributionCard({
  title,
  description,
  health,
  className,
}: {
  title: string;
  description: string;
  health: OverviewExamTypeHealth;
  className: string;
}) {
  return (
    <article className={`overview-hero-card ${className}`}>
      <div className="overview-hero-card-top">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
      </div>
      <VerticalHistogram
        buckets={health.scoreDistribution.map((bucket) => ({
          label: bucket.label.replace("–", "-"),
          value: bucket.students,
        }))}
      />
    </article>
  );
}

function renderOverviewChart(id: OverviewChartId, data: OverviewDashboardData): ReactNode {
  const maxYearPass = Math.max(...data.passRateByYear.map((row) => row.passRate), 1);

  switch (id) {
    case "average-score-breakdown":
      return <AverageScoreBreakdownCard data={data} />;
    case "pass-rate-comprehensive":
      return <ComprehensivePassRateCard health={data.performanceHealth.comprehensive} />;
    case "pass-rate-diagnostic":
      return <DiagnosticPassRateCard health={data.performanceHealth.diagnostic} />;
    case "score-distribution-comprehensive":
      return (
        <ScoreDistributionCard
          title="Score Distribution — Comprehensive"
          description="Latest comprehensive or retake attempt per student"
          health={data.performanceHealth.comprehensive}
          className="overview-hero-distribution"
        />
      );
    case "score-distribution-diagnostic":
      return (
        <ScoreDistributionCard
          title="Score Distribution — Diagnostic"
          description="Latest diagnostic attempt per student"
          health={data.performanceHealth.diagnostic}
          className="overview-hero-distribution overview-hero-distribution-diagnostic"
        />
      );
    case "retake-success":
      return (
        <article className="overview-hero-card overview-hero-retake overview-hero-retake-donut">
          <div className="overview-hero-card-top">
            <div>
              <h3>Retake Success Rate</h3>
              <p className="muted">Share of retakers who eventually passed</p>
            </div>
          </div>
          <DonutChart
            value={data.retakeEffectiveness.eventualPassRate}
            label="passed"
            passed={data.retakeEffectiveness.retakersWhoEventuallyPassed}
            failed={
              data.retakeEffectiveness.totalRetakerStudents -
              data.retakeEffectiveness.retakersWhoEventuallyPassed
            }
          />
          <dl className="overview-mini-stats">
            <div>
              <dt>Avg attempts to pass</dt>
              <dd>
                {data.retakeEffectiveness.averageAttemptsToPass > 0
                  ? data.retakeEffectiveness.averageAttemptsToPass.toFixed(1)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Exhausted retake limit</dt>
              <dd>{data.retakeEffectiveness.exhaustedRetakeLimit}</dd>
            </div>
          </dl>
        </article>
      );
    case "at-risk":
      return (
        <article className="overview-hero-card overview-hero-risk overview-at-risk-panel">
          <div className="overview-hero-card-top">
            <div>
              <h3>At-Risk Students</h3>
              <p className="muted">Failed and need intervention</p>
            </div>
          </div>
          <div className="overview-activity-grid overview-at-risk-grid">
            <article className="overview-activity-tile overview-activity-tile-risk">
              <span className="overview-activity-value overview-activity-alert">
                {data.atRisk.failedNotRetaken}
              </span>
              <span className="overview-activity-label">Failed, not retaken</span>
              <span className="muted overview-activity-compare">Haven&apos;t retaken yet</span>
            </article>
            <article className="overview-activity-tile">
              <span className="overview-activity-value">{data.atRisk.failingStudents}</span>
              <span className="overview-activity-label">Failing (latest attempt)</span>
            </article>
            <article className="overview-activity-tile overview-at-risk-tile-wide">
              <span className="overview-activity-value">{data.students}</span>
              <span className="overview-activity-label">Students assessed</span>
            </article>
          </div>
        </article>
      );
    case "exam-activity":
      return (
        <section className="card overview-panel overview-activity-panel">
          <h2>Exam Activity</h2>
          <div className="overview-activity-grid">
            <article className="overview-activity-tile">
              <span className="overview-activity-value">{data.examActivity.examsThisWeek}</span>
              <span className="overview-activity-label">This week</span>
              <span className="muted overview-activity-compare">
                vs {data.examActivity.examsLastWeek} last week
              </span>
            </article>
            <article className="overview-activity-tile">
              <span className="overview-activity-value">{data.examActivity.examsThisMonth}</span>
              <span className="overview-activity-label">This month</span>
              <span className="muted overview-activity-compare">
                vs {data.examActivity.examsLastMonth} last month
              </span>
            </article>
            <article
              className={`overview-activity-tile${
                data.examActivity.pendingRetakeApprovals > 0 ? " overview-activity-tile-alert" : ""
              }`}
            >
              <span
                className={`overview-activity-value ${
                  data.examActivity.pendingRetakeApprovals > 0 ? "overview-activity-alert" : ""
                }`}
              >
                {data.examActivity.pendingRetakeApprovals}
              </span>
              <span className="overview-activity-label">Pending approvals</span>
            </article>
            <article className="overview-activity-tile">
              <span className="overview-activity-value overview-activity-time">
                {formatRelativeTime(data.examActivity.lastSubmissionAt)}
              </span>
              <span className="overview-activity-label">Last submission</span>
            </article>
          </div>
        </section>
      );
    case "pass-rate-by-year":
      return (
        <section className="card overview-panel">
          <h2>Pass Rate by Year</h2>
          <p className="muted section-desc">Quick snapshot across year levels</p>
          <div className="overview-year-pills">
            {data.passRateByYear.map((row) => (
              <div key={row.yearLevel} className="overview-year-pill">
                <div className="overview-year-pill-header">
                  <span>Year {row.yearLevel}</span>
                  <strong>{row.students > 0 ? `${row.passRate.toFixed(0)}%` : "—"}</strong>
                </div>
                <div className="overview-year-pill-track">
                  <span
                    className="overview-year-pill-fill"
                    style={{
                      width:
                        row.students > 0
                          ? `${Math.min(100, (row.passRate / maxYearPass) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
                <span className="muted overview-year-pill-meta">
                  {row.students} student{row.students === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default function AnalyticsOverview({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const { appendExamYear, seasonLabel } = useAnalyticsSeason();
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [data, setData] = useState<OverviewDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  const [chartOrder, setChartOrder] = useChartOrder(
    "analytics-overview-chart-order-v2",
    OVERVIEW_CHART_ORDER
  );

  const displayChartOrder = useMemo(() => {
    const pinned: OverviewChartId = "average-score-breakdown";
    if (chartOrder[0] === pinned) return chartOrder;
    return [pinned, ...chartOrder.filter((id) => id !== pinned)];
  }, [chartOrder]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    appendExamYear(params);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [yearFilter, courseFilter, appendExamYear]);

  const filterSubtitle = useMemo(() => {
    const parts = [
      courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
      yearFilter === "ALL" ? "All incoming years" : `Incoming year ${yearFilter}`,
      seasonLabel,
    ];
    return parts.join(" · ");
  }, [courseFilter, yearFilter, seasonLabel]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<OverviewDashboardData>(`/analytics/overview${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  if (loading && !data) {
    return <p className="muted">Loading analytics...</p>;
  }

  if (!data) {
    return error ? <p className="error">{error}</p> : null;
  }

  return (
    <AnalyticsPrintArea
      id="analytics-print-overview"
      title="Analytics — Overview"
      subtitle={filterSubtitle}
    >
      <div className={`analytics-overview${refreshing ? " is-refreshing" : ""}`}>
        <AnalyticsSeasonControl variant="overview" />

        <div className="analytics-reports-filter analytics-no-print">
          <div className="analytics-reports-filters">
            <label className="analytics-reports-filter-field">
              Course
              <select
                value={courseFilter}
                onChange={(event) =>
                  setCourseFilter(event.target.value as ProgramCourseFilter)
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
            <label className="analytics-reports-filter-field">
              Incoming year
              <select
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(event.target.value as YearLevelFilter)
                }
              >
                <option value="ALL">All</option>
                {Array.from(
                  { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                  (_, i) => MIN_YEAR_LEVEL + i
                ).map((level) => (
                  <option key={level} value={String(level)}>
                    Year {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <SwappableChartGrid
          order={displayChartOrder}
          onOrderChange={setChartOrder}
          slotLayout={OVERVIEW_CHART_LAYOUT}
        >
          {(id) => renderOverviewChart(id as OverviewChartId, data)}
        </SwappableChartGrid>
      </div>
    </AnalyticsPrintArea>
  );
}
