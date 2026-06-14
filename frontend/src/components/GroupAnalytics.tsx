import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsPrintArea, { AnalyticsPrintAction } from "./AnalyticsPrintArea";
import { AnalyticsReportBody } from "./AnalyticsReports";
import SegmentedControl from "./SegmentedControl";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { formatProgramCourse } from "../lib/programCourse";

const YEAR_SEGMENTS = [
  { id: "all", label: "All years" },
  ...Array.from({ length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 }, (_, index) => {
    const year = MIN_YEAR_LEVEL + index;
    return { id: String(year), label: `Year ${year}` };
  }),
];

interface CohortSummary {
  programCourse: string;
  yearLevel: number;
  studentsAssessed: number;
  examsTaken: number;
  passRate: number;
  averageScore: number;
  readinessLevel: string;
}

interface GroupReportsData {
  readiness: {
    overallScore: number;
    passingThreshold: number;
    readinessLevel: string;
    studentsAssessed: number;
    examsTaken: number;
    passRate: number;
    completionRate: number;
  };
  byTopic: Array<{
    topicId: string;
    topic: string;
    subject: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
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
  topicDifficultyMatrix: Array<{
    topicId: string;
    topic: string;
    subject: string;
    difficulty: string;
    score: number;
    total: number;
    correct: number;
    tone: "strong" | "moderate" | "weak";
  }>;
  atRiskByTopic: Array<{
    topicId: string;
    topic: string;
    subject: string;
    count: number;
  }>;
  knowledgeGaps: {
    strongAreas: Array<{ label: string; score: number; type: string }>;
    weakAreas: Array<{ label: string; score: number; type: string }>;
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
  questionReliability: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    difficulty: string;
    correctRate: number;
    avgTimeSeconds: number | null;
    discriminationIndex: number | null;
    attempts: number;
  }>;
  timeCorrectnessSamples: Array<{
    timeSeconds: number;
    correct: boolean;
    difficulty: string;
  }>;
  topicCoverageMatrix: Array<{
    topicId: string;
    topic: string;
    subject: string;
    easy: number;
    medium: number;
    hard: number;
  }>;
  questionTimeBars: Array<{
    questionId: string;
    label: string;
    avgTimeSeconds: number;
  }>;
  passFail: { passed: number; failed: number };
  scorePercentiles: { min: number; max: number; avg: number };
  cohortSummaries: CohortSummary[];
}

interface SelectedCohort {
  programCourse: string;
  yearLevel: number;
}

interface Props {
  token: string | null;
}

function readinessTone(level: string) {
  if (level === "Ready") return "ready";
  if (level === "Needs Improvement") return "watch";
  return "risk";
}

export default function GroupAnalytics({ token }: Props) {
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedCohort, setSelectedCohort] = useState<SelectedCohort | null>(null);
  const [reports, setReports] = useState<GroupReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCohort) {
      params.set("programCourse", selectedCohort.programCourse);
      params.set("yearLevel", String(selectedCohort.yearLevel));
    } else if (yearFilter !== "all") {
      params.set("yearLevel", yearFilter);
    }
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [selectedCohort, yearFilter]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<GroupReportsData>(`/analytics/reports${query}`, {}, token)
      .then((data) => {
        setReports(data);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  const printAreaId = "analytics-print-group";
  const printTitle = "Analytics — Group";
  const printSubtitle = selectedCohort
    ? `${formatProgramCourse(selectedCohort.programCourse)} · Year ${selectedCohort.yearLevel}`
    : yearFilter === "all"
      ? "All cohorts"
      : `Year ${yearFilter}`;

  const cohortSummaries = reports?.cohortSummaries ?? [];

  return (
    <AnalyticsPrintArea id={printAreaId} title={printTitle} subtitle={printSubtitle}>
      <div className="analytics-reports group-analytics">
        <div className="analytics-reports-filter analytics-no-print">
          <div className="analytics-reports-filter-primary">
            {selectedCohort ? (
              <div className="group-analytics-cohort-nav">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setSelectedCohort(null)}
                >
                  ← All cohorts
                </button>
                <div className="group-analytics-cohort-label">
                  <strong>{formatProgramCourse(selectedCohort.programCourse)}</strong>
                  <span className="muted">Incoming Year {selectedCohort.yearLevel}</span>
                </div>
              </div>
            ) : (
              <SegmentedControl
                segments={YEAR_SEGMENTS}
                value={yearFilter}
                onChange={setYearFilter}
                scrollable
              />
            )}
            <AnalyticsPrintAction
              areaId={printAreaId}
              title={printTitle}
              disabled={loading && !reports}
            />
          </div>
        </div>

        <p className="muted analytics-lens-intro">
          {selectedCohort
            ? "Batch performance for this program and year level."
            : "Pick a program and year level to drill into cohort charts."}
        </p>

        {error && !reports ? <p className="error">{error}</p> : null}
        {loading && !reports ? <p className="muted">Loading group analytics…</p> : null}

        {reports && !selectedCohort ? (
          <section
            className={`group-analytics-cohort-browser${refreshing ? " is-refreshing" : ""}`}
          >
            <div className="group-analytics-cohort-browser-header">
              <h2>Cohorts by program &amp; year</h2>
              <p className="muted section-desc">
                Each card is a program course and incoming year level with submitted exams.
              </p>
            </div>

            {cohortSummaries.length === 0 ? (
              <p className="muted">No cohort data yet. Students need a program course, year level, and a submitted exam.</p>
            ) : (
              <div className="group-analytics-cohort-grid">
                {cohortSummaries.map((cohort) => (
                  <button
                    key={`${cohort.programCourse}-${cohort.yearLevel}`}
                    type="button"
                    className="group-analytics-cohort-card"
                    onClick={() =>
                      setSelectedCohort({
                        programCourse: cohort.programCourse,
                        yearLevel: cohort.yearLevel,
                      })
                    }
                  >
                    <div className="group-analytics-cohort-card-top">
                      <span className="group-analytics-cohort-program">
                        {formatProgramCourse(cohort.programCourse)}
                      </span>
                      <span className="group-analytics-cohort-year">
                        Year {cohort.yearLevel}
                      </span>
                    </div>
                    <div className="group-analytics-cohort-metrics">
                      <div>
                        <span className="group-analytics-cohort-metric-label">Avg score</span>
                        <strong>{cohort.averageScore.toFixed(0)}%</strong>
                      </div>
                      <div>
                        <span className="group-analytics-cohort-metric-label">Pass rate</span>
                        <strong>{cohort.passRate.toFixed(0)}%</strong>
                      </div>
                      <div>
                        <span className="group-analytics-cohort-metric-label">Students</span>
                        <strong>{cohort.studentsAssessed}</strong>
                      </div>
                    </div>
                    <span
                      className={`group-analytics-cohort-badge group-analytics-cohort-badge-${readinessTone(
                        cohort.readinessLevel
                      )}`}
                    >
                      {cohort.readinessLevel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {reports && selectedCohort ? (
          <AnalyticsReportBody
            reports={reports}
            lens="group"
            refreshing={refreshing}
            error={error}
          />
        ) : null}
      </div>
    </AnalyticsPrintArea>
  );
}
