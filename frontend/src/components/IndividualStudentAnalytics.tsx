import { useEffect, useMemo, useState, type ReactNode } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import SwappableChartGrid, { ChartReorderHint } from "./SwappableChartGrid";
import { HorizontalBarChart, GroupedDifficultyBars, GroupedBloomBars, BloomCognitiveCallout } from "./charts/AnalyticsCharts";
import { DIFFICULTY_LABELS } from "../lib/analyticsChartUtils";
import { BLOOM_LEVEL_LABELS, type BloomLevelId } from "../lib/bloomLevel";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { usePagination } from "../hooks/usePagination";
import { useChartOrder } from "../hooks/useChartOrder";
import { formatFullName } from "../lib/names";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { usePrograms } from "../lib/programs";

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

const STUDENT_TABLE_PAGE_SIZE = 5;

const INDIVIDUAL_STUDENT_CHART_ORDER = [
  "topic-tiles",
  "class-compare",
  "bloom-levels",
  "score-by-difficulty",
  "score-per-subject",
  "avg-time-difficulty",
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
    case "topic-tiles":
      return (
        <section className="card individual-student-section">
          <h3>Score per topic</h3>
          <div className="individual-student-topic-grid">
            {(report.byTopic ?? []).map((topic) => (
              <div
                key={topic.topicId}
                className={`individual-student-topic-tile chart-tone-${topic.tone}`}
              >
                <span className="individual-student-topic-name">{topic.topic}</span>
                <span className="individual-student-topic-score">{topic.score.toFixed(0)}%</span>
                <span className="muted">{topic.subject}</span>
              </div>
            ))}
          </div>
        </section>
      );
    case "class-compare":
      return (
        <section className="card individual-student-section">
          <h3>Student vs. class average</h3>
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
        </section>
      );
    case "bloom-levels":
      return (
        <section className="card individual-student-section">
          <h3>Domain profile</h3>
          <p className="muted individual-student-section-lead">
            L1–L6 bars show which domains are strong or weak — same score can hide very different learning needs.
          </p>
          <GroupedBloomBars
            items={(report.byBloomLevel ?? []).map((row) => ({
              bloomLevel: row.bloomLevel,
              score: row.score,
            }))}
          />
          <BloomCognitiveCallout profile={report.bloomProfile} />
          <div className="individual-student-bloom-legend">
            {(report.byBloomLevel ?? []).map((row) => (
              <span key={row.bloomLevel} className="muted">
                {BLOOM_LEVEL_LABELS[row.bloomLevel as BloomLevelId] ?? row.bloomLevel}:{" "}
                {row.score.toFixed(0)}%
                {row.classAverage > 0 ? ` (class ${row.classAverage.toFixed(0)}%)` : ""}
              </span>
            ))}
          </div>
        </section>
      );
    case "score-by-difficulty":
      return (
        <section className="card individual-student-section">
          <h3>Score by difficulty</h3>
          <GroupedDifficultyBars
            items={(report.byDifficulty ?? []).map((row) => ({
              difficulty: row.difficulty,
              score: row.score,
            }))}
          />
        </section>
      );
    case "score-per-subject":
      return (
        <section className="card individual-student-section">
          <h3>Score per subject</h3>
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
        </section>
      );
    case "avg-time-difficulty":
      return (
        <section className="card individual-student-section">
          <h3>Avg time per difficulty</h3>
          <div className="individual-student-time-list">
            {(report.byDifficulty ?? []).map((row) => {
              const fastHard =
                row.difficulty === "HARD" &&
                row.avgTimeSeconds != null &&
                row.classAvgTimeSeconds != null &&
                row.avgTimeSeconds < row.classAvgTimeSeconds * 0.6;
              return (
                <div key={row.difficulty} className="individual-student-time-row">
                  <span>{DIFFICULTY_LABELS[row.difficulty] ?? row.difficulty}</span>
                  <strong>{row.avgTimeSeconds != null ? `${row.avgTimeSeconds}s` : "—"}</strong>
                  <span className="muted">
                    bench:{" "}
                    {row.classAvgTimeSeconds != null ? `${row.classAvgTimeSeconds}s` : "—"}
                  </span>
                  {fastHard ? (
                    <span className="individual-student-time-warning">
                      Hard items answered fast — check for guessing
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default function IndividualStudentAnalytics({ token }: Props) {
  const { programs } = usePrograms();
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
      ...programs.map((course) => ({
        id: course.slug as ProgramCourseFilter,
        label: course.label,
      })),
    ],
    [programs]
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
    pageSize: STUDENT_TABLE_PAGE_SIZE,
    resetKey: results.map((student) => student.id).join("|"),
  });

  const studentCountLabel = useMemo(() => {
    const count = results.length;
    return `${count} student${count === 1 ? "" : "s"}`;
  }, [results.length]);

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
              <p className="muted section-desc">
                Browse students with submitted exams, then open individual analytics.
              </p>
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

                <ChartReorderHint />
                <SwappableChartGrid order={chartOrder} onOrderChange={setChartOrder}>
                  {(id) => renderIndividualStudentChart(id as IndividualStudentChartId, report)}
                </SwappableChartGrid>

                <section className="card individual-student-section individual-student-insights">
                  <h3>Insights &amp; flags</h3>
                  <p className="muted section-desc">Auto-generated from topic, difficulty, and timing patterns.</p>
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
                </section>
              </>
            )}
          </div>
        </AnalyticsPrintArea>
      ) : null}
    </div>
  );
}
