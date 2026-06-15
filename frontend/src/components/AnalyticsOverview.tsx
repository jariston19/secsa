import { type ReactNode } from "react";
import { VerticalHistogram } from "./charts/AnalyticsCharts";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import SwappableChartGrid, { ChartReorderHint } from "./SwappableChartGrid";
import { useChartOrder } from "../hooks/useChartOrder";

export interface OverviewExamTypeHealth {
  passRate: number;
  examsTaken: number;
  trend: {
    week: { current: number; previous: number; delta: number; exams: number };
    month: { current: number; previous: number; delta: number; exams: number };
  };
  scoreDistribution: Array<{ label: string; students: number }>;
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
  "first-takers-retakers",
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

function TrendArrow({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return <span className="overview-trend overview-trend-flat">→ flat</span>;
  }
  if (delta > 0) {
    return (
      <span className="overview-trend overview-trend-up">
        ↑ {delta.toFixed(1)} pts vs last week
      </span>
    );
  }
  return (
    <span className="overview-trend overview-trend-down">
      ↓ {Math.abs(delta).toFixed(1)} pts vs last week
    </span>
  );
}

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
  data: OverviewDashboardData;
}

function PassRateCard({
  title,
  description,
  health,
  icon,
  className,
}: {
  title: string;
  description: string;
  health: OverviewExamTypeHealth;
  icon: string;
  className: string;
}) {
  return (
    <article className={`overview-hero-card ${className}`}>
      <div className="overview-hero-card-top">
        <span className="overview-hero-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="overview-hero-metric">{health.passRate.toFixed(1)}%</div>
      <TrendArrow delta={health.trend.week.delta} />
      <p className="muted overview-hero-sub">
        {health.trend.month.delta >= 0 ? "↑" : "↓"}{" "}
        {Math.abs(health.trend.month.delta).toFixed(1)} pts vs last month · {health.examsTaken}{" "}
        exam{health.examsTaken === 1 ? "" : "s"} total
      </p>
    </article>
  );
}

function ScoreDistributionCard({
  title,
  description,
  health,
  icon,
  className,
}: {
  title: string;
  description: string;
  health: OverviewExamTypeHealth;
  icon: string;
  className: string;
}) {
  return (
    <article className={`overview-hero-card ${className}`}>
      <div className="overview-hero-card-top">
        <span className="overview-hero-icon" aria-hidden>
          {icon}
        </span>
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
    case "first-takers-retakers":
      return (
        <section className="card overview-panel">
          <h2>First Takers vs Retakers</h2>
          <p className="muted section-desc">
            Compare pass rate and average score between first-time and retake attempts.
          </p>
          <div className="overview-cohort-compare">
            <article className="overview-cohort-card">
              <h3>First Takers</h3>
              <div className="overview-cohort-metric">
                {data.retakeEffectiveness.firstTakers.passRate.toFixed(1)}%
              </div>
              <span className="muted">Pass rate</span>
              <dl className="overview-mini-stats">
                <div>
                  <dt>Average score</dt>
                  <dd>{data.retakeEffectiveness.firstTakers.averageScore.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Exams</dt>
                  <dd>{data.retakeEffectiveness.firstTakers.count}</dd>
                </div>
              </dl>
            </article>
            <article className="overview-cohort-card">
              <h3>Retakers</h3>
              <div className="overview-cohort-metric">
                {data.retakeEffectiveness.retakers.passRate.toFixed(1)}%
              </div>
              <span className="muted">Pass rate</span>
              <dl className="overview-mini-stats">
                <div>
                  <dt>Average score</dt>
                  <dd>{data.retakeEffectiveness.retakers.averageScore.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Exams</dt>
                  <dd>{data.retakeEffectiveness.retakers.count}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
      );
    case "pass-rate-comprehensive":
      return (
        <PassRateCard
          title="Pass Rate — Comprehensive"
          description="Performance on comprehensive and retake exams"
          health={data.performanceHealth.comprehensive}
          icon="🟢"
          className="overview-hero-pass"
        />
      );
    case "pass-rate-diagnostic":
      return (
        <PassRateCard
          title="Pass Rate — Diagnostic"
          description="Performance on incoming diagnostic exams"
          health={data.performanceHealth.diagnostic}
          icon="🔵"
          className="overview-hero-pass overview-hero-pass-diagnostic"
        />
      );
    case "score-distribution-comprehensive":
      return (
        <ScoreDistributionCard
          title="Score Distribution — Comprehensive"
          description="Latest comprehensive or retake attempt per student"
          health={data.performanceHealth.comprehensive}
          icon="📊"
          className="overview-hero-distribution"
        />
      );
    case "score-distribution-diagnostic":
      return (
        <ScoreDistributionCard
          title="Score Distribution — Diagnostic"
          description="Latest diagnostic attempt per student"
          health={data.performanceHealth.diagnostic}
          icon="📈"
          className="overview-hero-distribution overview-hero-distribution-diagnostic"
        />
      );
    case "retake-success":
      return (
        <article className="overview-hero-card overview-hero-retake">
          <div className="overview-hero-card-top">
            <span className="overview-hero-icon" aria-hidden>
              🔄
            </span>
            <div>
              <h3>Retake Success Rate</h3>
              <p className="muted">Share of retakers who eventually passed</p>
            </div>
          </div>
          <div className="overview-hero-metric">
            {data.retakeEffectiveness.eventualPassRate.toFixed(0)}%
          </div>
          <p className="overview-hero-highlight">
            {data.retakeEffectiveness.retakersWhoEventuallyPassed} of{" "}
            {data.retakeEffectiveness.totalRetakerStudents} retakers passed
          </p>
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
        <article className="overview-hero-card overview-hero-risk">
          <div className="overview-hero-card-top">
            <span className="overview-hero-icon" aria-hidden>
              ⚠️
            </span>
            <div>
              <h3>At-Risk Students</h3>
              <p className="muted">Failed and need intervention</p>
            </div>
          </div>
          <div className="overview-hero-metric overview-hero-metric-risk">
            {data.atRisk.failedNotRetaken}
          </div>
          <p className="overview-hero-highlight">Failed and haven&apos;t retaken yet</p>
          <dl className="overview-mini-stats">
            <div>
              <dt>Failing (latest attempt)</dt>
              <dd>{data.atRisk.failingStudents}</dd>
            </div>
            <div>
              <dt>Students assessed</dt>
              <dd>{data.students}</dd>
            </div>
          </dl>
        </article>
      );
    case "exam-activity":
      return (
        <section className="card overview-panel">
          <h2>Exam Activity</h2>
          <div className="overview-activity-grid">
            <div className="overview-activity-stat">
              <span className="overview-activity-value">{data.examActivity.examsThisWeek}</span>
              <span className="overview-activity-label">This week</span>
              <span className="muted overview-activity-compare">
                vs {data.examActivity.examsLastWeek} last week
              </span>
            </div>
            <div className="overview-activity-stat">
              <span className="overview-activity-value">{data.examActivity.examsThisMonth}</span>
              <span className="overview-activity-label">This month</span>
              <span className="muted overview-activity-compare">
                vs {data.examActivity.examsLastMonth} last month
              </span>
            </div>
            <div className="overview-activity-stat">
              <span
                className={`overview-activity-value ${
                  data.examActivity.pendingRetakeApprovals > 0 ? "overview-activity-alert" : ""
                }`}
              >
                {data.examActivity.pendingRetakeApprovals}
              </span>
              <span className="overview-activity-label">Pending approvals</span>
            </div>
            <div className="overview-activity-stat">
              <span className="overview-activity-value overview-activity-time">
                {formatRelativeTime(data.examActivity.lastSubmissionAt)}
              </span>
              <span className="overview-activity-label">Last submission</span>
            </div>
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

export default function AnalyticsOverview({ data }: Props) {
  const [chartOrder, setChartOrder] = useChartOrder(
    "analytics-overview-chart-order",
    OVERVIEW_CHART_ORDER
  );

  return (
    <AnalyticsPrintArea id="analytics-print-overview" title="Analytics — Overview">
      <div className="analytics-overview">
        <ChartReorderHint />
        <SwappableChartGrid
          order={chartOrder}
          onOrderChange={setChartOrder}
          wideIds={["first-takers-retakers"]}
        >
          {(id) => renderOverviewChart(id as OverviewChartId, data)}
        </SwappableChartGrid>
      </div>
    </AnalyticsPrintArea>
  );
}
