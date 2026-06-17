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

function toneBarWidth(tone: BloomLevelRow["tone"]) {
  if (tone === "strong") return 85;
  if (tone === "moderate") return 60;
  return 35;
}

function toneFillColor(tone: BloomLevelRow["tone"]) {
  if (tone === "strong") return "#22c55e";
  if (tone === "moderate") return "#f59e0b";
  return "#ef4444";
}

function displayBarWidth(row: BloomLevelRow) {
  const width = row.score ?? toneBarWidth(row.tone);
  return Math.max(4, Math.min(100, width));
}

function toneLabel(tone: BloomLevelRow["tone"]) {
  if (tone === "strong") return "Strong";
  if (tone === "moderate") return "Developing";
  return "Needs focus";
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
            How you performed across recall, application, and higher-order thinking.
          </p>
          <div className="score-bars diagnostic-bloom-grid">
            {profile.bloomLevels.map((row) => (
              <div key={row.bloomLevel} className="score-bar-row diagnostic-bloom-row">
                <span className="score-bar-label diagnostic-bloom-label">{row.label}</span>
                <div
                  className="score-bar-track"
                  role="presentation"
                  style={{ height: "10px", background: "#e5e7eb", borderRadius: "999px" }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${displayBarWidth(row)}%`,
                      height: "10px",
                      borderRadius: "999px",
                      background: toneFillColor(row.tone),
                    }}
                  />
                </div>
                <span className={`diagnostic-bloom-tone diagnostic-bloom-tone-${row.tone}`}>
                  {toneLabel(row.tone)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
