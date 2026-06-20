import { useEffect, useMemo, useState, type ReactNode } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import SwappableChartGrid from "./SwappableChartGrid";
import AnalyticsPanel from "./AnalyticsPanel";
import ChartCard from "./charts/ChartCard";
import {
  HorizontalBarChart,
  GroupedDifficultyBars,
  GroupedBloomBars,
  StudentJourneyLineChart,
} from "./charts/AnalyticsCharts";
import { DIFFICULTY_LABELS } from "../lib/analyticsChartUtils";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { resetBodyScrollLock } from "../lib/scrollLock";
import { MODAL_PAGE_SIZE, usePagination } from "../hooks/usePagination";
import { useChartOrder } from "../hooks/useChartOrder";
import { formatFullName } from "../lib/names";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { INDIVIDUAL_STUDENT_CHART_LAYOUT } from "../lib/analyticsLayout";

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

const INDIVIDUAL_STUDENT_CHART_ORDER = [
  "multi-year-journey",
  "topic-tiles",
  "class-compare",
  "bloom-levels",
  "score-by-difficulty",
  "score-per-subject",
  "avg-time-difficulty",
  "insights-flags",
] as const;

type IndividualStudentChartId = (typeof INDIVIDUAL_STUDENT_CHART_ORDER)[number];

type InsightType = "weak" | "risk" | "watch" | "strength";

interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  yearLevel: number | null;
  programCourse: string | null;
  email: string;
}

interface IndividualReport {
  student: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    yearLevel: number | null;
    programCourse: string | null;
    email: string;
  };
  hasExamData: boolean;
  exam?: {
    questionSetName: string;
    questionSetYear: number;
    submittedAt: string;
    attemptType: string;
    attemptNumber: number;
    percentage: number;
    passed: boolean | null;
    passThreshold: number;
    score: number | null;
    totalItems: number;
    focusWarningCount: number;
  };
  summary?: {
    overallScore: number;
    correct: number;
    totalItems: number;
    rank: number | null;
    batchSize: number;
    completionMinutes: number | null;
    classAvgMinutes: number | null;
    weakTopicsCount: number;
    passed: boolean | null;
    focusWarningCount: number;
    classAvgFocusWarnings: number | null;
  };
  byTopic?: Array<{
    topicId: string;
    topic: string;
    subject: string;
    courseCode: string;
    score: number;
    classAverage: number | null;
    tone: "strong" | "moderate" | "weak";
  }>;
  bySubject?: Array<{
    subjectId: string;
    subject: string;
    score: number;
    classAverage: number | null;
    tone: "strong" | "moderate" | "weak";
  }>;
  byDifficulty?: Array<{
    difficulty: string;
    score: number;
    classAverage: number;
    tone: "strong" | "moderate" | "weak";
    avgTimeSeconds: number | null;
    classAvgTimeSeconds: number | null;
    domains?: Array<{
      bloomLevel: string;
      score: number;
      classAverage: number;
      tone: "strong" | "moderate" | "weak";
      total: number;
      correct: number;
    }>;
  }>;
  byBloomLevel?: Array<{
    bloomLevel: string;
    score: number;
    classAverage: number;
    tone: "strong" | "moderate" | "weak";
    total: number;
    correct: number;
  }>;
  bloomProfile?: {
    type: "surface" | "deep" | "mixed";
    message: string;
  } | null;
  insights?: Array<{ type: InsightType; message: string }>;
  journey?: {
    intakeYear: number | null;
    hasJourneyData: boolean;
    milestones: Array<{
      yearLevel: number;
      kind: string;
      label: string;
      score: number | null;
      passed: boolean | null;
      submittedAt: string | null;
      hasData: boolean;
    }>;
    transitions: Array<{
      fromYear: number;
      toYear: number;
      fromLabel: string;
      toLabel: string;
      fromScore: number;
      toScore: number;
      delta: number;
      direction: "improved" | "declined" | "stable";
    }>;
  };
}

interface Props {
  token: string | null;
}

function formatExamDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function insightLabel(type: InsightType) {
  if (type === "weak") return "Weak topic";
  if (type === "risk") return "Guessing risk";
  if (type === "strength") return "Strength";
  return "Watch";
}

function renderIndividualStudentChart(id: IndividualStudentChartId, report: IndividualReport): ReactNode {
  switch (id) {
    case "multi-year-journey":
      if (!report.journey?.hasJourneyData) return null;
      return (
        <AnalyticsPanel
          title="Multi-year journey"
          description={
            report.journey.intakeYear != null
              ? `Intake batch ${report.journey.intakeYear}`
              : undefined
          }
          className="individual-student-journey-section"
        >
          <StudentJourneyLineChart
            milestones={report.journey.milestones}
            intakeYear={report.journey.intakeYear}
            compact
            fill
          />
          {report.journey.transitions.length > 0 ? (
            <ul className="individual-student-journey-transitions">
              {report.journey.transitions.map((transition) => (
                <li
                  key={`${transition.fromYear}-${transition.toYear}`}
                  className={`individual-student-journey-transition journey-${transition.direction}`}
                >
                  <span>Y{transition.fromYear}→Y{transition.toYear}</span>
                  <span>
                    {transition.fromScore.toFixed(0)}→{transition.toScore.toFixed(0)}%
                  </span>
                  <span className="individual-student-journey-transition-delta">
                    {transition.delta > 0 ? "+" : ""}
                    {transition.delta.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </AnalyticsPanel>
      );
    case "topic-tiles":
      return (
        <AnalyticsPanel title="Score per topic">
          <div className="analytics-topic-tile-grid individual-student-topic-grid">
            {(report.byTopic ?? []).map((topic) => (
              <div
                key={topic.topicId}
                className={`individual-student-topic-tile chart-tone-${topic.tone}`}
              >
                <span className="individual-student-topic-name">{topic.topic}</span>
                <span className="individual-student-topic-score">{topic.score.toFixed(0)}%</span>
                <span className="muted individual-student-topic-code">{topic.subject}</span>
              </div>
            ))}
          </div>
        </AnalyticsPanel>
      );
    case "class-compare":
      return (
        <AnalyticsPanel title="Student vs. class average">
          <div className="individual-student-compare-chart">
            {(report.byTopic ?? []).map((topic) => {
              const max = 100;
              const studentWidth = (topic.score / max) * 100;
              const classPos =
                topic.classAverage != null ? (topic.classAverage / max) * 100 : null;
              return (
                <div key={topic.topicId} className="individual-student-compare-row">
                  <span className="individual-student-compare-label">{topic.topic}</span>
                  <div className="individual-student-compare-track">
                    {classPos != null ? (
                      <span
                        className="individual-student-compare-marker"
                        style={{ left: `${classPos}%` }}
                        title={`Class avg ${topic.classAverage?.toFixed(0)}%`}
                      />
                    ) : null}
                    <span
                      className={`individual-student-compare-bar chart-tone-${topic.tone}`}
                      style={{ width: `${studentWidth}%` }}
                    />
                  </div>
                  <span className="individual-student-compare-value">{topic.score.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          <p className="muted individual-student-legend">
            Blue bar = student · Grey tick = class average
          </p>
        </AnalyticsPanel>
      );
    case "bloom-levels":
      return (
        <AnalyticsPanel
          title="Domain profile"
          description="L1–L6 cognitive domains. Spot surface recall vs deeper analysis and evaluation gaps."
        >
          <GroupedBloomBars
            items={(report.byBloomLevel ?? []).map((row) => ({
              bloomLevel: row.bloomLevel,
              score: row.score,
            }))}
          />
        </AnalyticsPanel>
      );
    case "score-by-difficulty":
      return (
        <ChartCard
          className="analytics-chart-card-paired analytics-chart-card-difficulty"
          title="Performance by difficulty"
          description="Easy, medium, and hard bars with L1–L6 domain scores mapped to each difficulty tier."
        >
          <GroupedDifficultyBars items={report.byDifficulty ?? []} />
        </ChartCard>
      );
    case "score-per-subject":
      return (
        <AnalyticsPanel title="Score per subject">
          {(report.bySubject ?? []).length === 0 ? (
            <p className="muted">No subject data yet.</p>
          ) : (
            <HorizontalBarChart
              bars={(report.bySubject ?? []).map((row) => ({
                label: row.subject,
                value: row.score,
                tone: row.tone,
              }))}
            />
          )}
        </AnalyticsPanel>
      );
    case "avg-time-difficulty": {
      const timeRows = report.byDifficulty ?? [];
      const maxTime = Math.max(
        1,
        ...timeRows.flatMap((row) =>
          [row.avgTimeSeconds, row.classAvgTimeSeconds].filter((value): value is number => value != null)
        )
      );
      const scaleMax = maxTime * 1.1;

      return (
        <AnalyticsPanel
          title="Avg time per difficulty"
          description="Seconds per answered question on this exam."
        >
          <div className="individual-student-compare-chart individual-student-time-compare">
            {timeRows.map((row) => {
              const studentTime = row.avgTimeSeconds;
              const classTime = row.classAvgTimeSeconds;
              const studentWidth =
                studentTime != null ? Math.min(100, (studentTime / scaleMax) * 100) : 0;
              const classPos =
                classTime != null ? Math.min(100, (classTime / scaleMax) * 100) : null;
              const fastHard =
                row.difficulty === "HARD" &&
                studentTime != null &&
                classTime != null &&
                studentTime < classTime * 0.6;

              return (
                <div key={row.difficulty} className="individual-student-compare-row">
                  <span className="individual-student-compare-label">
                    {DIFFICULTY_LABELS[row.difficulty] ?? row.difficulty}
                  </span>
                  <div className="individual-student-compare-track">
                    {classPos != null ? (
                      <span
                        className="individual-student-compare-marker"
                        style={{ left: `${classPos}%` }}
                        title={`Class average ${classTime}s`}
                      />
                    ) : null}
                    {studentTime != null ? (
                      <span
                        className="individual-student-compare-bar individual-student-time-bar"
                        style={{ width: `${studentWidth}%` }}
                      />
                    ) : null}
                  </div>
                  <span className="individual-student-compare-value">
                    {studentTime != null ? `${studentTime}s` : "—"}
                  </span>
                  {fastHard ? (
                    <span className="individual-student-time-warning">
                      Answered much faster than class average — check for guessing
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="muted individual-student-legend">
            Blue bar = this student · Grey tick = class average
          </p>
        </AnalyticsPanel>
      );
    }
    case "insights-flags":
      return (
        <AnalyticsPanel
          title="Insights & flags"
          description="Auto-generated from topic, difficulty, and timing patterns."
          className="individual-student-insights-panel"
        >
          <ul className="individual-student-insights-list">
            {(report.insights ?? []).map((insight, index) => (
              <li key={index} className={`individual-student-insight insight-${insight.type}`}>
                <span className="individual-student-insight-dot" aria-hidden />
                <div>
                  <strong>{insightLabel(insight.type)}</strong>
                  <p>{insight.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </AnalyticsPanel>
      );
    default:
      return null;
  }
}

export default function IndividualStudentAnalytics({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<IndividualReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartOrder, setChartOrder] = useChartOrder(
    "analytics-individual-student-chart-order",
    INDIVIDUAL_STUDENT_CHART_ORDER
  );

  const courseOptions = useMemo(
    () => [
      { id: "ALL" as const, label: "All" },
      ...programCourseOptions.map((course) => ({
        id: course.id as ProgramCourseFilter,
        label: course.label,
      })),
    ],
    [programCourseOptions]
  );

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed.length >= 2) params.set("q", trimmed);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    return params;
  }, [query, yearFilter, courseFilter]);

  const canSearch = true;

  useEffect(() => {
    resetBodyScrollLock();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    resetBodyScrollLock();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedId]);

  useEffect(() => {
    if (!canSearch || selectedId) {
      if (!canSearch && !selectedId) {
        setResults([]);
      }
      return;
    }

    const handle = window.setTimeout(() => {
      setSearching(true);
      const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
      api<{ students: StudentSearchResult[] }>(`/analytics/students/search${suffix}`, {}, token)
        .then((data) => setResults(data.students))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [canSearch, searchParams, token, selectedId]);

  useEffect(() => {
    if (!selectedId && results.length > 0) {
      setStudentRoster(results);
    }
  }, [results, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }

    setLoading(true);
    setError("");
    api<IndividualReport>(`/analytics/students/${selectedId}`, {}, token)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load student analytics"))
      .finally(() => setLoading(false));
  }, [selectedId, token]);

  function selectStudent(student: StudentSearchResult, roster = results) {
    if (roster.length > 0) {
      setStudentRoster(roster);
    }
    setSelectedId(student.id);
    setQuery(student.name);
  }

  function goToAdjacentStudent(direction: -1 | 1) {
    const currentIndex = studentRoster.findIndex((student) => student.id === selectedId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= studentRoster.length) return;
    const nextStudent = studentRoster[nextIndex];
    setSelectedId(nextStudent.id);
    setQuery(nextStudent.name);
  }

  function backToList() {
    setSelectedId(null);
    setReport(null);
    setQuery("");
    setError("");
  }

  function handleFilterChange(nextYear: YearLevelFilter, nextCourse: ProgramCourseFilter) {
    setYearFilter(nextYear);
    setCourseFilter(nextCourse);
    if (selectedId) {
      setSelectedId(null);
      setReport(null);
    }
  }

  const showBrowseTable = !selectedId;
  const currentStudentIndex = selectedId
    ? studentRoster.findIndex((student) => student.id === selectedId)
    : -1;
  const canGoPrevious = currentStudentIndex > 0;
  const canGoNext =
    currentStudentIndex >= 0 && currentStudentIndex < studentRoster.length - 1;

  const studentTablePagination = usePagination(results, {
    pageSize: MODAL_PAGE_SIZE,
    resetKey: results.map((student) => student.id).join("|"),
  });

  const studentTablePlaceholderCount = Math.max(
    0,
    MODAL_PAGE_SIZE - studentTablePagination.paginatedItems.length
  );

  const studentCountLabel = useMemo(() => {
    const count = results.length;
    return `${count} student${count === 1 ? "" : "s"}`;
  }, [results.length]);

  const visibleChartOrder = useMemo(() => {
    if (report?.journey?.hasJourneyData) return chartOrder;
    return chartOrder.filter((id) => id !== "multi-year-journey");
  }, [chartOrder, report?.journey?.hasJourneyData]);

  const printAreaId = "analytics-print-individual-student";
  const printTitle = report?.student.name
    ? `Student Analytics — ${report.student.name}`
    : "Student Analytics";

  return (
    <div className="individual-student-analytics">
      {showBrowseTable ? (
        <section className="card individual-student-browser">
          <div className="individual-student-browser-header">
            <div>
              <h2>Students</h2>
            </div>
            <span className="muted individual-student-browser-count">{studentCountLabel}</span>
          </div>

          <div className="individual-student-browser-toolbar">
            <div className="individual-student-search-filters">
              <div className="individual-student-search-filter-row">
                <label className="individual-student-search-filter">
                  Course
                  <select
                    value={courseFilter}
                    onChange={(event) =>
                      handleFilterChange(yearFilter, event.target.value as ProgramCourseFilter)
                    }
                  >
                    {courseOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="individual-student-search-filter">
                  Year
                  <select
                    value={yearFilter}
                    onChange={(event) =>
                      handleFilterChange(event.target.value as YearLevelFilter, courseFilter)
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
                <label className="individual-student-search-filter individual-student-search-filter-grow">
                  Search student
                  <input
                    type="search"
                    placeholder="Type first or last name…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
          </div>

          {searching ? <p className="muted individual-student-search-hint">Loading students…</p> : null}

          {searching ? (
            <p className="muted">Loading students…</p>
          ) : results.length === 0 ? (
            <p className="muted">No students with submitted exams match your search and filters.</p>
          ) : (
            <ListPanel
              className="individual-student-list"
              footer={
                <ModalPagination
                  page={studentTablePagination.page}
                  totalPages={studentTablePagination.totalPages}
                  pageStart={studentTablePagination.pageStart}
                  pageEnd={studentTablePagination.pageEnd}
                  totalItems={studentTablePagination.totalItems}
                  onPageChange={studentTablePagination.setPage}
                />
              }
            >
              <div className="individual-student-table-inner">
                <table className="individual-student-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Year</th>
                      <th>Email</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentTablePagination.paginatedItems.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <strong>{formatFullName(student.firstName, student.lastName)}</strong>
                        </td>
                        <td>{formatProgramCourse(student.programCourse) ?? "—"}</td>
                        <td>{student.yearLevel ?? "—"}</td>
                        <td>{student.email}</td>
                        <td>
                          <button
                            type="button"
                            className="btn secondary btn-sm"
                            onClick={() => selectStudent(student, results)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: studentTablePlaceholderCount }, (_, index) => (
                      <tr
                        key={`student-row-placeholder-${index}`}
                        className="individual-student-table-row-placeholder"
                        aria-hidden="true"
                      >
                        <td colSpan={5} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ListPanel>
          )}
        </section>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading student analytics…</p> : null}

      {report && !loading ? (
        <AnalyticsPrintArea
          id={printAreaId}
          title={printTitle}
          subtitle={
            report.student.programCourse || report.student.yearLevel != null
              ? [
                  report.student.programCourse
                    ? formatProgramCourse(report.student.programCourse)
                    : null,
                  report.student.yearLevel != null
                    ? `Incoming Year ${report.student.yearLevel}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
        >
          <div className="individual-student-dashboard">
            <header className="individual-student-header analytics-no-print">
              <div>
                <h2>{report.student.name}</h2>
                <p className="muted">
                  {report.student.programCourse
                    ? `${formatProgramCourse(report.student.programCourse)} · `
                    : ""}
                  {report.student.yearLevel != null ? `Incoming Year ${report.student.yearLevel}` : "Year —"}
                  {report.exam
                    ? ` · ${report.exam.questionSetName} · ${formatExamDate(report.exam.submittedAt)}`
                    : ""}
                </p>
              </div>
              <div className="individual-student-header-actions">
                <button type="button" className="btn secondary" onClick={backToList}>
                  Back to list
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!canGoPrevious}
                  onClick={() => goToAdjacentStudent(-1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!canGoNext}
                  onClick={() => goToAdjacentStudent(1)}
                >
                  Next
                </button>
              </div>
            </header>

            {!report.hasExamData || !report.summary ? (
              <p className="muted">This student has not submitted an exam yet.</p>
            ) : (
              <>
                <div className="individual-student-print-header">
                  <h2>{report.student.name}</h2>
                  <p className="muted">
                    {report.student.programCourse
                      ? `${formatProgramCourse(report.student.programCourse)} · `
                      : ""}
                    {report.student.yearLevel != null ? `Incoming Year ${report.student.yearLevel}` : "Year —"}
                    {report.exam
                      ? ` · ${report.exam.questionSetName} · ${formatExamDate(report.exam.submittedAt)}`
                      : ""}
                  </p>
                </div>

                <div className="individual-student-summary-grid">
                  <article className="individual-student-stat-card">
                    <span className="individual-student-stat-label">Overall score</span>
                    <span className="individual-student-stat-value">
                      {report.summary.overallScore.toFixed(0)}%
                    </span>
                    <span className="muted">
                      {report.summary.correct}/{report.summary.totalItems} items
                    </span>
                  </article>
                  <article className="individual-student-stat-card">
                    <span className="individual-student-stat-label">Rank in batch</span>
                    <span className="individual-student-stat-value">
                      {report.summary.rank ?? "—"}
                      {report.summary.rank ? (
                        <span className="individual-student-stat-suffix">
                          /{report.summary.batchSize}
                        </span>
                      ) : null}
                    </span>
                    <span className="muted">Among same year level</span>
                  </article>
                  <article className="individual-student-stat-card">
                    <span className="individual-student-stat-label">Completion time</span>
                    <span className="individual-student-stat-value">
                      {report.summary.completionMinutes != null
                        ? `${report.summary.completionMinutes} min`
                        : "—"}
                    </span>
                    <span className="muted">
                      Class avg{" "}
                      {report.summary.classAvgMinutes != null
                        ? `${report.summary.classAvgMinutes} min`
                        : "—"}
                    </span>
                  </article>
                  <article className="individual-student-stat-card">
                    <span className="individual-student-stat-label">Weak topics flagged</span>
                    <span className="individual-student-stat-value">
                      {report.summary.weakTopicsCount}
                    </span>
                    <span
                      className={
                        report.summary.weakTopicsCount > 0
                          ? "individual-student-badge-warn"
                          : "individual-student-badge-ok"
                      }
                    >
                      {report.summary.weakTopicsCount > 0 ? "Needs attention" : "On track"}
                    </span>
                  </article>
                  <article className="individual-student-stat-card">
                    <span className="individual-student-stat-label">Focus warnings</span>
                    <span className="individual-student-stat-value">
                      {report.summary.focusWarningCount}
                    </span>
                    <span
                      className={
                        report.summary.focusWarningCount >= 2
                          ? "individual-student-badge-warn"
                          : "individual-student-badge-ok"
                      }
                    >
                      {report.summary.focusWarningCount >= 5
                        ? "High — review proctoring"
                        : report.summary.focusWarningCount >= 2
                          ? "Left exam focus"
                          : "None recorded"}
                    </span>
                    <span className="muted">
                      Class avg{" "}
                      {report.summary.classAvgFocusWarnings != null
                        ? report.summary.classAvgFocusWarnings
                        : "—"}
                    </span>
                  </article>
                </div>

                <SwappableChartGrid
                  order={visibleChartOrder}
                  onOrderChange={setChartOrder}
                  slotLayout={INDIVIDUAL_STUDENT_CHART_LAYOUT}
                >
                  {(id) => renderIndividualStudentChart(id as IndividualStudentChartId, report)}
                </SwappableChartGrid>
              </>
            )}
          </div>
        </AnalyticsPrintArea>
      ) : null}
    </div>
  );
}
