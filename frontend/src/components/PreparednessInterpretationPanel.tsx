import type { PreparednessReport } from "../lib/preparednessFramework";
import { preparednessTone } from "../lib/preparednessFramework";

interface Props {
  report: PreparednessReport;
}

export default function PreparednessInterpretationPanel({ report }: Props) {
  const tone = preparednessTone(report.categoryId);

  return (
    <section className="card analytics-preparedness-report">
      <header className="analytics-preparedness-header">
        <div>
          <h2>Interpretation</h2>
          <p className="muted section-desc">
            NIRNDO-based Readiness Index (0–100) for faculty reporting
            {report.basedOnDiagnostic ? " — based on latest diagnostic scores." : "."}
          </p>
        </div>
        <span className={`analytics-preparedness-badge analytics-preparedness-badge-${tone}`}>
          {report.categoryLabel}
        </span>
      </header>

      <div className="analytics-preparedness-summary">
        <article className="analytics-preparedness-stat">
          <span className="analytics-preparedness-stat-label">Readiness Index</span>
          <strong>{report.readinessIndex.toFixed(2)}</strong>
        </article>
        <article className="analytics-preparedness-stat">
          <span className="analytics-preparedness-stat-label">Cohort</span>
          <strong>{report.cohortLabel}</strong>
        </article>
      </div>

      {report.topicPerformance.length > 0 ? (
        <div className="analytics-preparedness-topics">
          <h3>Unit topic performance</h3>
          <ul className="analytics-preparedness-topic-list">
            {report.topicPerformance.map((topic) => (
              <li key={topic.label}>
                <span>{topic.label}</span>
                <span className="analytics-preparedness-topic-score">
                  {topic.score.toFixed(2)}% · {topic.performanceLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="analytics-preparedness-narrative">
        <h3>Narrative summary</h3>
        <p>{report.narrative}</p>
      </div>

      <div className="analytics-preparedness-blocks">
        <article>
          <h3>Interpretation</h3>
          <p>{report.interpretation}</p>
        </article>
        <article>
          <h3>Suggested intervention program</h3>
          <p>{report.suggestedIntervention}</p>
        </article>
      </div>
    </section>
  );
}
