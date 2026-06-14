import { VerticalHistogram } from "./charts/AnalyticsCharts";
import AnalyticsPrintArea, { AnalyticsPrintAction } from "./AnalyticsPrintArea";

export interface OverviewDashboardData {
  students: number;
  examsTaken: number;
  passRate: number;
  averageScore: number;
  performanceHealth: {
    passRate: number;
    trend: {
      week: { current: number; previous: number; delta: number; exams: number };
      month: { current: number; previous: number; delta: number; exams: number };
    };
    scoreDistribution: Array<{ label: string; students: number }>;
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

export default function AnalyticsOverview({ data }: Props) {
  const maxYearPass = Math.max(...data.passRateByYear.map((row) => row.passRate), 1);

  return (
    <AnalyticsPrintArea id="analytics-print-overview" title="Analytics — Overview">
      <div className="analytics-overview">
        <div className="analytics-overview-toolbar analytics-no-print">
          <AnalyticsPrintAction areaId="analytics-print-overview" title="Analytics — Overview" />
        </div>
      <div className="analytics-overview-hero-grid">
        <article className="overview-hero-card overview-hero-pass">
          <div className="overview-hero-card-top">
            <span className="overview-hero-icon" aria-hidden>
              🟢
            </span>
            <div>
              <h3>Pass Rate</h3>
              <p className="muted">Performance health across all submitted exams</p>
            </div>
          </div>
          <div className="overview-hero-metric">{data.performanceHealth.passRate.toFixed(1)}%</div>
          <TrendArrow delta={data.performanceHealth.trend.week.delta} />
          <p className="muted overview-hero-sub">
            {data.performanceHealth.trend.month.delta >= 0 ? "↑" : "↓"}{" "}
            {Math.abs(data.performanceHealth.trend.month.delta).toFixed(1)} pts vs last month ·{" "}
            {data.examsTaken} exams total
          </p>
        </article>

        <article className="overview-hero-card overview-hero-distribution">
          <div className="overview-hero-card-top">
            <span className="overview-hero-icon" aria-hidden>
              📊
            </span>
            <div>
              <h3>Score Distribution</h3>
              <p className="muted">Latest attempt per student, in 10-point intervals</p>
            </div>
          </div>
          <VerticalHistogram
            buckets={data.performanceHealth.scoreDistribution.map((bucket) => ({
              label: bucket.label.replace("–", "-"),
              value: bucket.students,
            }))}
          />
        </article>

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
          <p className="overview-hero-highlight">
            Failed and haven&apos;t retaken yet
          </p>
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
      </div>

      <div className="analytics-overview-secondary-grid">
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

        <section className="card overview-panel">
          <h2>Pass Rate by Year</h2>
          <p className="muted section-desc">Quick snapshot across year levels</p>
          <div className="overview-year-pills">
            {data.passRateByYear.map((row) => (
              <div key={row.yearLevel} className="overview-year-pill">
                <div className="overview-year-pill-header">
                  <span>Year {row.yearLevel}</span>
                  <strong>
                    {row.students > 0 ? `${row.passRate.toFixed(0)}%` : "—"}
                  </strong>
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

        <section className="card overview-panel overview-panel-wide">
          <h2>First Takers vs Retakers</h2>
          <p className="muted section-desc">
            Compare pass rate and average score between first-time and retake attempts.
          </p>
          <div className="overview-cohort-compare">
            <article className="overview-cohort-card overview-cohort-first">
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
            <article className="overview-cohort-card overview-cohort-retake">
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
      </div>
    </div>
    </AnalyticsPrintArea>
  );
}
