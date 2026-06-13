interface CohortStats {
  count: number;
  averageScore: number;
  passRate: number;
}

interface CohortsData {
  firstTakers: CohortStats;
  retakers: CohortStats;
}

interface Props {
  cohorts: CohortsData;
}

function CohortCard({
  title,
  description,
  stats,
  accent,
}: {
  title: string;
  description: string;
  stats: CohortStats;
  accent: "first" | "retake";
}) {
  const hasData = stats.count > 0;

  return (
    <article className={`cohort-scorecard cohort-scorecard-${accent}`}>
      <div className="cohort-scorecard-header">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
      </div>

      <div className="cohort-scorecard-metric">
        <span className="cohort-scorecard-value">
          {hasData ? `${stats.passRate.toFixed(1)}%` : "—"}
        </span>
        <span className="cohort-scorecard-label">Pass rate</span>
      </div>

      <div
        className="cohort-scorecard-bar"
        role="presentation"
        aria-hidden={!hasData}
      >
        <span
          className="cohort-scorecard-bar-fill"
          style={{ width: hasData ? `${Math.min(stats.passRate, 100)}%` : "0%" }}
        />
      </div>

      <dl className="cohort-scorecard-details">
        <div>
          <dt>Average score</dt>
          <dd>{hasData ? `${stats.averageScore.toFixed(1)}%` : "—"}</dd>
        </div>
        <div>
          <dt>Exams taken</dt>
          <dd>{stats.count}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function CohortScorecard({ cohorts }: Props) {
  return (
    <div className="cohort-scorecard-grid">
      <CohortCard
        title="First Takers"
        description="Students on their initial comprehensive exam"
        stats={cohorts.firstTakers}
        accent="first"
      />
      <CohortCard
        title="Retakers"
        description="Students on approved retake attempts"
        stats={cohorts.retakers}
        accent="retake"
      />
    </div>
  );
}

export type { CohortsData };
