import { useEffect, useState } from "react";
import ScoreBar from "./ScoreBar";
import SegmentedControl from "./SegmentedControl";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { formatFullName } from "../lib/names";

const YEAR_SEGMENTS = [
  { id: "all", label: "All years" },
  ...Array.from({ length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 }, (_, index) => {
    const year = MIN_YEAR_LEVEL + index;
    return { id: String(year), label: `Year ${year}` };
  }),
];

interface ReportsData {
  readiness: {
    overallScore: number;
    passingThreshold: number;
    readinessLevel: string;
    studentsAssessed: number;
    examsTaken: number;
  };
  bySubject: Array<{
    subjectId: string;
    subject: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
    total: number;
    correct: number;
  }>;
  byTopic: Array<{
    topicId: string;
    topic: string;
    subject: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
    avgTimeSeconds: number | null;
    total: number;
    correct: number;
  }>;
  byDifficulty: Array<{
    difficulty: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
    total: number;
    correct: number;
  }>;
  knowledgeGaps: {
    strongAreas: Array<{ label: string; score: number; type: string }>;
    weakAreas: Array<{ label: string; score: number; type: string }>;
  };
  timeAnalytics: {
    byTopic: Array<{ topic: string; subject: string; avgTimeSeconds: number }>;
    fastestQuestions: Array<{
      questionId: string;
      text: string;
      subject: string;
      topic: string | null;
      avgTimeSeconds: number;
    }>;
    slowestQuestions: Array<{
      questionId: string;
      text: string;
      subject: string;
      topic: string | null;
      avgTimeSeconds: number;
    }>;
    hasTimedData: boolean;
  };
  questionAnalysis: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    difficulty: string;
    correctRate: number;
    attempts: number;
    flag: "too_easy" | "too_hard" | null;
  }>;
  mostMissed: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    incorrect: number;
    correctRate: number;
    attempts: number;
  }>;
  distractorAnalysis: Array<{
    questionId: string;
    text: string;
    subject: string;
    correctOption: string;
    correctRate: number;
    options: Array<{ option: string; count: number; rate: number; isCorrect: boolean }>;
    topWrongOption: string | null;
    topWrongRate: number;
  }>;
  readinessDistribution: Array<{ label: string; students: number }>;
  atRiskStudents: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    yearLevel: number | null;
    overallScore: number | null;
    reasons: string[];
  }>;
  batchComparison: Array<{ yearLevel: number; average: number; students: number }>;
  questionInventory: Array<{ subject: string; easy: number; medium: number; hard: number }>;
  usageFrequency: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    timesUsed: number;
  }>;
  questionReliability: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    correctRate: number;
    avgTimeSeconds: number | null;
    discriminationIndex: number | null;
    attempts: number;
  }>;
}

interface Props {
  token: string | null;
}

function readinessClass(level: string) {
  if (level === "Ready") return "readiness-ready";
  if (level === "Needs Improvement") return "readiness-needs-improvement";
  return "readiness-at-risk";
}

function truncate(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatDifficulty(difficulty: string) {
  if (difficulty === "HARD") return "Difficult";
  if (difficulty === "MEDIUM") return "Medium";
  return "Easy";
}

export default function AnalyticsReports({ token }: Props) {
  const [yearFilter, setYearFilter] = useState("all");
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const query = yearFilter === "all" ? "" : `?yearLevel=${yearFilter}`;
    api<ReportsData>(`/analytics/reports${query}`, {}, token)
      .then(setReports)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, [token, yearFilter]);

  if (loading) return <p className="muted">Loading analytics reports...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!reports) return null;

  const maxDistribution = Math.max(...reports.readinessDistribution.map((b) => b.students), 1);
  const topicsBySubject = reports.byTopic.reduce<Record<string, typeof reports.byTopic>>(
    (groups, row) => {
      const list = groups[row.subject] ?? [];
      list.push(row);
      groups[row.subject] = list;
      return groups;
    },
    {}
  );

  return (
    <div className="analytics-reports">
      <div className="analytics-reports-filter">
        <SegmentedControl segments={YEAR_SEGMENTS} value={yearFilter} onChange={setYearFilter} />
      </div>

      <section className="card analytics-report-section">
        <h2>Overall Readiness Score</h2>
        <div className="readiness-hero">
          <div className="readiness-hero-score">{reports.readiness.overallScore.toFixed(1)}%</div>
          <dl className="readiness-hero-meta">
            <div>
              <dt>Passing threshold</dt>
              <dd>{reports.readiness.passingThreshold.toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Readiness level</dt>
              <dd className={readinessClass(reports.readiness.readinessLevel)}>
                {reports.readiness.readinessLevel}
              </dd>
            </div>
            <div>
              <dt>Students assessed</dt>
              <dd>{reports.readiness.studentsAssessed}</dd>
            </div>
            <div>
              <dt>Exams taken</dt>
              <dd>{reports.readiness.examsTaken}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Performance by Subject</h2>
        <div className="score-bars">
          {reports.bySubject.length === 0 ? (
            <p className="muted">No subject data yet.</p>
          ) : (
            reports.bySubject.map((row) => (
              <ScoreBar key={row.subjectId} label={row.subject} value={row.score} tone={row.tone} />
            ))
          )}
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Performance by Topic</h2>
        {Object.keys(topicsBySubject).length === 0 ? (
          <p className="muted">No topic data yet.</p>
        ) : (
          Object.entries(topicsBySubject).map(([subject, topics]) => (
            <div key={subject} className="analytics-topic-group">
              <h3>{subject}</h3>
              <div className="score-bars">
                {topics.map((row) => (
                  <ScoreBar
                    key={row.topicId}
                    label={row.topic}
                    value={row.score}
                    tone={row.tone}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Performance by Difficulty</h2>
        <div className="score-bars">
          {reports.byDifficulty.map((row) => (
            <ScoreBar
              key={row.difficulty}
              label={formatDifficulty(row.difficulty)}
              value={row.score}
              tone={row.tone}
            />
          ))}
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Knowledge Gap Analysis</h2>
        <div className="knowledge-gap-grid">
          <div>
            <h3>Strong areas</h3>
            {reports.knowledgeGaps.strongAreas.length === 0 ? (
              <p className="muted">No strong areas identified yet.</p>
            ) : (
              <ul className="knowledge-gap-list">
                {reports.knowledgeGaps.strongAreas.map((area) => (
                  <li key={area.label}>
                    <span>{area.label}</span>
                    <span className="success">{area.score.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Weak areas</h3>
            {reports.knowledgeGaps.weakAreas.length === 0 ? (
              <p className="muted">No weak areas flagged yet.</p>
            ) : (
              <ul className="knowledge-gap-list">
                {reports.knowledgeGaps.weakAreas.map((area) => (
                  <li key={area.label}>
                    <span>{area.label}</span>
                    <span className="error">{area.score.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Time Analytics</h2>
        {!reports.timeAnalytics.hasTimedData ? (
          <p className="muted">
            Per-question timing will appear after students complete exams with the updated exam
            flow.
          </p>
        ) : (
          <>
            <h3>Average time by topic</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Subject</th>
                    <th>Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.timeAnalytics.byTopic.map((row) => (
                    <tr key={`${row.subject}-${row.topic}`}>
                      <td>{row.topic}</td>
                      <td>{row.subject}</td>
                      <td>{row.avgTimeSeconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="analytics-two-col">
              <div>
                <h3>Fastest questions</h3>
                <ul className="analytics-mini-list">
                  {reports.timeAnalytics.fastestQuestions.map((row) => (
                    <li key={row.questionId}>
                      <span>{truncate(row.text)}</span>
                      <span>{row.avgTimeSeconds}s</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Slowest questions</h3>
                <ul className="analytics-mini-list">
                  {reports.timeAnalytics.slowestQuestions.map((row) => (
                    <li key={row.questionId}>
                      <span>{truncate(row.text)}</span>
                      <span>{row.avgTimeSeconds}s</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Subject Performance Heatmap</h2>
        <div className="heatmap-grid">
          {reports.bySubject.map((row) => (
            <div key={row.subjectId} className={`heatmap-cell heatmap-${row.tone}`}>
              <span className="heatmap-label">{row.subject}</span>
              <span className="heatmap-value">{row.score.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Topic Mastery Heatmap</h2>
        <div className="heatmap-grid heatmap-grid-compact">
          {reports.byTopic.map((row) => (
            <div key={row.topicId} className={`heatmap-cell heatmap-${row.tone}`}>
              <span className="heatmap-label">{row.topic}</span>
              <span className="heatmap-subtext">{row.subject}</span>
              <span className="heatmap-value">{row.score.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Question Analysis</h2>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Correct %</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {reports.questionAnalysis.slice(0, 20).map((row) => (
                <tr key={row.questionId}>
                  <td className="analytics-question-cell">{truncate(row.text)}</td>
                  <td>{row.subject}</td>
                  <td>{row.correctRate.toFixed(1)}%</td>
                  <td>
                    {row.flag === "too_easy" && <span className="muted">Too easy</span>}
                    {row.flag === "too_hard" && <span className="error">Too hard</span>}
                    {!row.flag && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Most Missed Questions</h2>
        {reports.mostMissed.length === 0 ? (
          <p className="muted">No missed-question data yet.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Subject</th>
                  <th>Incorrect</th>
                  <th>Correct %</th>
                </tr>
              </thead>
              <tbody>
                {reports.mostMissed.map((row) => (
                  <tr key={row.questionId}>
                    <td className="analytics-question-cell">{truncate(row.text)}</td>
                    <td>{row.subject}</td>
                    <td>{row.incorrect}</td>
                    <td>{row.correctRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Distractor Analysis</h2>
        {reports.distractorAnalysis.length === 0 ? (
          <p className="muted">No strong misconception patterns detected yet.</p>
        ) : (
          <div className="distractor-list">
            {reports.distractorAnalysis.map((row) => (
              <article key={row.questionId} className="distractor-card">
                <p className="distractor-question">{truncate(row.text, 120)}</p>
                <p className="muted distractor-meta">
                  {row.subject} · correct: {row.correctOption} · {row.correctRate.toFixed(0)}%
                  correct
                </p>
                <div className="distractor-options">
                  {row.options.map((option) => (
                    <span
                      key={option.option}
                      className={
                        option.isCorrect
                          ? "distractor-option correct"
                          : option.option === row.topWrongOption
                            ? "distractor-option misconception"
                            : "distractor-option"
                      }
                    >
                      {option.option}: {option.rate.toFixed(0)}%
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Readiness Distribution</h2>
        <div className="histogram">
          {reports.readinessDistribution.map((bucket) => (
            <div key={bucket.label} className="histogram-row">
              <span className="histogram-label">{bucket.label}</span>
              <div className="histogram-bar">
                <span
                  className="histogram-bar-fill"
                  style={{ width: `${(bucket.students / maxDistribution) * 100}%` }}
                />
              </div>
              <span className="histogram-count">{bucket.students}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>At-Risk Students</h2>
        {reports.atRiskStudents.length === 0 ? (
          <p className="muted">No at-risk students flagged.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Year</th>
                  <th>Score</th>
                  <th>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {reports.atRiskStudents.map((student) => (
                  <tr key={student.studentId}>
                    <td>{formatFullName(student.firstName, student.lastName)}</td>
                    <td>{student.yearLevel ?? "—"}</td>
                    <td>
                      {student.overallScore != null ? `${student.overallScore.toFixed(1)}%` : "—"}
                    </td>
                    <td>{student.reasons.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Comparison by Batch</h2>
        {reports.batchComparison.length === 0 ? (
          <p className="muted">No batch comparison data yet.</p>
        ) : (
          <div className="score-bars">
            {reports.batchComparison.map((row) => (
              <ScoreBar
                key={row.yearLevel}
                label={`Year ${row.yearLevel} (${row.students} students)`}
                value={row.average}
                tone={row.average >= 75 ? "strong" : row.average >= 50 ? "moderate" : "weak"}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card analytics-report-section">
        <h2>Question Inventory</h2>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Easy</th>
                <th>Medium</th>
                <th>Hard</th>
              </tr>
            </thead>
            <tbody>
              {reports.questionInventory.map((row) => (
                <tr key={row.subject}>
                  <td>{row.subject}</td>
                  <td>{row.easy}</td>
                  <td>{row.medium}</td>
                  <td>{row.hard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Question Usage Frequency</h2>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Times used</th>
              </tr>
            </thead>
            <tbody>
              {reports.usageFrequency.map((row) => (
                <tr key={row.questionId}>
                  <td className="analytics-question-cell">{truncate(row.text)}</td>
                  <td>{row.subject}</td>
                  <td>{row.timesUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card analytics-report-section">
        <h2>Question Reliability Score</h2>
        <p className="muted section-desc">
          Combines correct rate, average response time, and discrimination index.
        </p>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Correct %</th>
                <th>Avg time</th>
                <th>Discrimination</th>
              </tr>
            </thead>
            <tbody>
              {reports.questionReliability.slice(0, 20).map((row) => (
                <tr key={row.questionId}>
                  <td className="analytics-question-cell">{truncate(row.text)}</td>
                  <td>{row.correctRate.toFixed(1)}%</td>
                  <td>{row.avgTimeSeconds != null ? `${row.avgTimeSeconds}s` : "—"}</td>
                  <td>
                    {row.discriminationIndex != null ? row.discriminationIndex.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
