import {
  examProfileBandTextColor,
  examProfileBarStyle,
  examProfileLegendItems,
  examProfileQualitativeLabel,
  scoreToExamProfileBand,
} from "../lib/examProfileLabels";

type AreaInsight = {
  label: string;
  type: "subject" | "topic";
  tone: "strong" | "weak";
  message: string;
};

type BloomLevelRow = {
  bloomLevel: string;
  label: string;
  tone: "strong" | "moderate" | "weak";
  score?: number;
  correct?: number;
  total?: number;
};

export type DiagnosticProfile = {
  strongAreas: AreaInsight[];
  weakAreas: AreaInsight[];
  qualities: string[];
  bloomLevels: BloomLevelRow[];
};

interface Props {
  profile: DiagnosticProfile;
  variant?: "diagnostic" | "comprehensive";
  /** Admin/teacher report view — neutral wording instead of second-person student copy. */
  reportMode?: boolean;
}

function displayBarWidth(score: number | undefined) {
  const width = score ?? 0;
  return Math.max(4, Math.min(100, width));
}

export default function DiagnosticResultProfile({
  profile,
  variant = "diagnostic",
  reportMode = false,
}: Props) {
  const leadCopy = reportMode
    ? variant === "comprehensive"
      ? "Evaluation of strengths and areas to develop based on exam responses."
      : "Learning profile based on diagnostic responses — not a graded score."
    : variant === "comprehensive"
      ? "Your comprehensive exam is complete. Below is an evaluation of your strengths and areas to develop based on your responses."
      : "Your diagnostic is complete. Below is a learning profile based on your responses — not a graded score.";

  const legendItems = examProfileLegendItems();

  return (
    <div className="diagnostic-result-profile">
      <p className="diagnostic-result-lead">{leadCopy}</p>

      {profile.qualities.length > 0 ? (
        <section className="diagnostic-result-section">
          <h3>{reportMode ? "Learning profile" : "Your learning profile"}</h3>
          <ul className="diagnostic-qualities-list">
            {profile.qualities.map((quality) => (
              <li key={quality}>{quality}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.strongAreas.length > 0 ? (
        <section className="diagnostic-result-section">
          <h3>Strengths</h3>
          <ul className="diagnostic-area-list">
            {profile.strongAreas.map((area) => (
              <li key={`strong-${area.label}`} className="diagnostic-area-item diagnostic-area-strong">
                <strong>{area.label}</strong>
                <span>{area.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.weakAreas.length > 0 ? (
        <section className="diagnostic-result-section">
          <h3>Areas to develop</h3>
          <ul className="diagnostic-area-list">
            {profile.weakAreas.map((area) => (
              <li key={`weak-${area.label}`} className="diagnostic-area-item diagnostic-area-weak">
                <strong>{area.label}</strong>
                <span>{area.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.bloomLevels.length > 0 ? (
        <section className="diagnostic-result-section">
          <h3>Cognitive domains</h3>
          <p className="muted section-desc">
            {reportMode
              ? "Performance across recall, application, and higher-order thinking, with qualitative labels by score band."
              : "How you performed across recall, application, and higher-order thinking, with qualitative labels by score band."}
          </p>
          <div className="score-bars diagnostic-bloom-grid">
            {profile.bloomLevels.map((row) => {
              const score = row.score ?? 0;
              const band = scoreToExamProfileBand(score);
              const summaryColor = examProfileBandTextColor(band);
              const qualitativeLabel = examProfileQualitativeLabel(score);

              return (
                <div key={row.bloomLevel} className="diagnostic-bloom-row-wrap">
                  <div className="diagnostic-bloom-row-header">
                    <span className="diagnostic-bloom-label">
                      <span className="diagnostic-bloom-label-text">{row.label}</span>
                      {row.total != null && row.total > 0 ? (
                        <span className="diagnostic-bloom-quantity">
                          {row.correct ?? 0}/{row.total} correct
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`diagnostic-bloom-tone diagnostic-bloom-tone-${band}`}
                      style={{ color: summaryColor }}
                      title={qualitativeLabel}
                    >
                      {row.score != null ? `${row.score}% · ` : ""}
                      {qualitativeLabel}
                    </span>
                  </div>
                  <div className="diagnostic-bloom-track" role="presentation">
                    <span
                      className="diagnostic-bloom-fill"
                      style={examProfileBarStyle(displayBarWidth(score))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="diagnostic-bloom-legend" aria-hidden="true">
            {legendItems.map((item) => (
              <span key={`${item.band}-${item.range}`} className="diagnostic-bloom-legend-item">
                <i
                  className="diagnostic-bloom-legend-swatch"
                  style={{ background: item.color }}
                />
                <span>
                  {item.range} · {item.label}
                </span>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
