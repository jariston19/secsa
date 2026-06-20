import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import { AnalyticsReportBody } from "./AnalyticsReports";
import PreparednessInterpretationPanel from "./PreparednessInterpretationPanel";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { preparednessToneFromLabel } from "../lib/preparednessFramework";
import { useProgramCourseOptions } from "../lib/programs";

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";
type CohortDetailView = "charts" | "preparedness";

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
    domains?: Array<{
      bloomLevel: string;
      score: number;
      tone: "strong" | "moderate" | "weak";
      total: number;
      correct: number;
    }>;
  }>;
  byBloomLevel?: Array<{
    bloomLevel: string;
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
  preparednessReport?: import("../lib/preparednessFramework").PreparednessReport;
}

interface SelectedCohort {
  programCourse: string;
  yearLevel: number;
}

interface Props {
  token: string | null;
}

function readinessTone(level: string) {
  return preparednessToneFromLabel(level);
}

export default function GroupAnalytics({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [selectedCohort, setSelectedCohort] = useState<SelectedCohort | null>(null);
  const [cohortDetailView, setCohortDetailView] = useState<CohortDetailView>("charts");
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
    } else {
      if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
      if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    }
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [selectedCohort, courseFilter, yearFilter]);

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

  useEffect(() => {
    setCohortDetailView("charts");
  }, [selectedCohort]);

  const printAreaId = "analytics-print-group";
  const printTitle = "Analytics — Group";
  const printSubtitle = selectedCohort
    ? `${formatProgramCourse(selectedCohort.programCourse)} · Year ${selectedCohort.yearLevel}`
    : [
        courseFilter === "ALL" ? "All" : formatProgramCourse(courseFilter),
        yearFilter === "ALL" ? "All" : `Year ${yearFilter}`,
      ].join(" · ");

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
                {reports?.preparednessReport ? (
                  <button
                    type="button"
                    className="btn secondary group-analytics-preparedness-toggle analytics-no-print"
                    onClick={() =>
                      setCohortDetailView((view) =>
                        view === "preparedness" ? "charts" : "preparedness"
                      )
                    }
                  >
                    {cohortDetailView === "preparedness"
                      ? "Back"
                      : "Interpretation"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="analytics-reports-filters">
                <label className="analytics-reports-filter-field">
                  Course
                  <select
                    value={courseFilter}
                    onChange={(e) =>
                      setCourseFilter(e.target.value as ProgramCourseFilter)
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
                  Year
                  <select
                    value={yearFilter}
                    onChange={(e) =>
                      setYearFilter(e.target.value as YearLevelFilter)
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
            )}
          </div>
        </div>

        {error && !reports ? <p className="error">{error}</p> : null}
        {loading && !reports ? <p className="muted">Loading group analytics…</p> : null}

        {reports && !selectedCohort ? (
          <section
            className={`group-analytics-cohort-browser${refreshing ? " is-refreshing" : ""}`}
          >
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

        {reports && selectedCohort && cohortDetailView === "charts" ? (
          <AnalyticsReportBody
            reports={reports}
            lens="group"
            refreshing={refreshing}
            error={error}
          />
        ) : null}

        {reports && selectedCohort && cohortDetailView === "preparedness" && reports.preparednessReport ? (
          <div className={`group-analytics-preparedness-view${refreshing ? " is-refreshing" : ""}`}>
            <PreparednessInterpretationPanel report={reports.preparednessReport} />
          </div>
        ) : null}
      </div>
    </AnalyticsPrintArea>
  );
}
