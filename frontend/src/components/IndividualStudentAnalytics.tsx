import { useEffect, useMemo, useState } from "react";
import AnalyticsPrintArea, { AnalyticsPrintAction } from "./AnalyticsPrintArea";
import SegmentedControl from "./SegmentedControl";
import { HorizontalBarChart, GroupedDifficultyBars } from "./charts/AnalyticsCharts";
import { DIFFICULTY_LABELS } from "../lib/analyticsChartUtils";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { formatFullName } from "../lib/names";
import {
  abbreviateProgramCourse,
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { usePrograms } from "../lib/programs";

const YEAR_SEGMENTS = [
  { id: "all", label: "All years" },
  ...Array.from({ length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 }, (_, index) => {
    const year = MIN_YEAR_LEVEL + index;
    return { id: String(year), label: `Year ${year}` };
  }),
];

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

export default function IndividualStudentAnalytics({ token }: Props) {
  const { programs } = usePrograms();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<IndividualReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const courseOptions = useMemo(
    () => [
      { id: "ALL" as const, label: "All courses" },
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
    if (yearFilter !== "all") params.set("yearLevel", yearFilter);
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    return params;
  }, [query, yearFilter, courseFilter]);

  const canSearch =
    query.trim().length >= 2 || yearFilter !== "all" || courseFilter !== "ALL";

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
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
  }, [canSearch, searchParams, token]);

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

  function selectStudent(student: StudentSearchResult) {
    setSelectedId(student.id);
    setQuery(student.name);
    setResults([]);
  }

  function clearStudent() {
    setSelectedId(null);
    setReport(null);
    setQuery("");
    setError("");
  }

  function handleFilterChange(nextYear: string, nextCourse: ProgramCourseFilter) {
    setYearFilter(nextYear);
    setCourseFilter(nextCourse);
    if (selectedId) {
      setSelectedId(null);
      setReport(null);
    }
  }

  const showResults = canSearch && !selectedId;
  const browseMode = query.trim().length < 2 && (yearFilter !== "all" || courseFilter !== "ALL");

  const printAreaId = "analytics-print-individual-student";
  const printTitle = report?.student.name
    ? `Student Analytics — ${report.student.name}`
    : "Student Analytics";

  return (
    <div className="individual-student-analytics">
      <div className="individual-student-search analytics-no-print">
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
          </div>
          <SegmentedControl
            segments={YEAR_SEGMENTS}
            value={yearFilter}
            onChange={(value) => handleFilterChange(value, courseFilter)}
            scrollable
          />
        </div>

        <div className="individual-student-search-field">
          <label className="individual-student-search-label">
            Search student
            <input
              type="search"
              placeholder="Type first or last name…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (selectedId) setSelectedId(null);
              }}
              autoComplete="off"
            />
          </label>
          {searching ? <p className="muted individual-student-search-hint">Searching…</p> : null}
          {showResults && !searching && results.length > 0 ? (
            <ul className="individual-student-search-results">
              {results.map((student) => (
                <li key={student.id}>
                  <button type="button" onClick={() => selectStudent(student)}>
                    <span>{formatFullName(student.firstName, student.lastName)}</span>
                    <span className="muted">
                      {abbreviateProgramCourse(student.programCourse)} · Year{" "}
                      {student.yearLevel ?? "—"} · {student.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {showResults && !searching && results.length === 0 ? (
            <p className="muted individual-student-search-hint">
              No students with submitted exams match your search and filters.
            </p>
          ) : null}
          {!canSearch && !selectedId ? (
            <p className="muted individual-student-search-hint">
              Type a name (2+ characters) or choose a course and/or year to browse students.
            </p>
          ) : null}
          {browseMode && !searching && results.length > 0 ? (
            <p className="muted individual-student-search-hint">
              Showing students in the selected course and year. Refine with a name search.
            </p>
          ) : null}
        </div>
      </div>

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
                <AnalyticsPrintAction areaId={printAreaId} title={printTitle} />
                <button type="button" className="btn secondary" onClick={clearStudent}>
                  Change student
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
                </div>

                <section className="card individual-student-section">
                  <h3>Performance breakdown</h3>
                  <div className="individual-student-breakdown-grid">
                    <div>
                      <h4>Score per topic</h4>
                      <div className="individual-student-topic-grid">
                        {(report.byTopic ?? []).map((topic) => (
                          <div
                            key={topic.topicId}
                            className={`individual-student-topic-tile chart-tone-${topic.tone}`}
                          >
                            <span className="individual-student-topic-name">{topic.topic}</span>
                            <span className="individual-student-topic-score">
                              {topic.score.toFixed(0)}%
                            </span>
                            <span className="muted">{topic.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4>Student vs. class average</h4>
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
                              <span className="individual-student-compare-value">
                                {topic.score.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="muted individual-student-legend">
                        Blue bar = student · Grey tick = class average
                      </p>
                    </div>
                  </div>
                </section>

                <div className="individual-student-metrics-grid">
                  <section className="card individual-student-section">
                    <h3>Score by difficulty</h3>
                    <GroupedDifficultyBars
                      items={(report.byDifficulty ?? []).map((row) => ({
                        difficulty: row.difficulty,
                        score: row.score,
                      }))}
                    />
                  </section>

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
                            <strong>
                              {row.avgTimeSeconds != null ? `${row.avgTimeSeconds}s` : "—"}
                            </strong>
                            <span className="muted">
                              bench:{" "}
                              {row.classAvgTimeSeconds != null
                                ? `${row.classAvgTimeSeconds}s`
                                : "—"}
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
                </div>

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

      {!selectedId && !loading ? (
        <p className="muted individual-student-empty">
          Search by name or filter by course and year to view a student&apos;s analytics dashboard.
        </p>
      ) : null}
    </div>
  );
}
