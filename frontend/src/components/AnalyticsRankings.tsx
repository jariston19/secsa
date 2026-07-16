import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ListPanel from "./ListPanel";
import SegmentedControl from "./SegmentedControl";
import AnalyticsSeasonControl from "./AnalyticsSeasonControl";
import { api } from "../lib/api";
import { useAnalyticsSeason } from "../lib/analyticsSeason";
import { MIN_YEAR_LEVEL, incomingYearLevelsForFilter } from "../lib/constants";
import { formatFullName } from "../lib/names";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import type { ExamStatusNavigationRequest } from "./AnalyticsExamStatus";

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";
type ExamTypeTab = "comprehensive" | "diagnostic" | "retake";
type ViewLimit = "all" | "top10";

interface RankingRow {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  name: string;
  yearLevel: number | null;
  programCourse: string | null;
  percentage: number;
  score: number;
  totalItems: number;
  passed: boolean;
  passThreshold: number;
  attemptType: string;
  questionSetName: string;
  submittedAt: string;
}

interface RankingsData {
  examType: ExamTypeTab;
  studentsInScope: number;
  studentsRanked: number;
  rankings: RankingRow[];
}

interface Props {
  token: string | null;
  onViewStudent?: (studentId: string, name: string) => void;
  onOpenExamStatus?: (request: ExamStatusNavigationRequest) => void;
}

const EXAM_TYPE_SEGMENTS = [
  { id: "comprehensive", label: "Comprehensive" },
  { id: "retake", label: "Retake" },
  { id: "diagnostic", label: "Diagnostic" },
] as const;

const VIEW_LIMIT_SEGMENTS = [
  { id: "all", label: "All" },
  { id: "top10", label: "Top 10" },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function examTypeLabel(examType: ExamTypeTab) {
  if (examType === "comprehensive") return "comprehensive";
  if (examType === "retake") return "retake";
  return "diagnostic";
}

function matchesRankingSearch(row: RankingRow, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const haystack = `${row.firstName} ${row.lastName} ${row.name}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export default function AnalyticsRankings({ token, onViewStudent, onOpenExamStatus }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const { appendExamYear, seasonLabel } = useAnalyticsSeason();
  const [examType, setExamType] = useState<ExamTypeTab>("comprehensive");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [viewLimit, setViewLimit] = useState<ViewLimit>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("examType", examType);
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    appendExamYear(params);
    return `?${params.toString()}`;
  }, [examType, courseFilter, yearFilter, appendExamYear]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<RankingsData>(`/analytics/rankings${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load rankings"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  const rankings = data?.rankings ?? [];
  const filteredRankings = useMemo(
    () => rankings.filter((row) => matchesRankingSearch(row, searchQuery)),
    [rankings, searchQuery]
  );
  const visibleRankings =
    viewLimit === "top10" ? filteredRankings.slice(0, 10) : filteredRankings;
  const searchTrimmed = searchQuery.trim();
  const missingCount = Math.max(0, (data?.studentsInScope ?? 0) - (data?.studentsRanked ?? 0));
  const canOpenExamStatus =
    examType === "comprehensive" && missingCount > 0 && onOpenExamStatus != null;

  const filterSubtitle = [
    examType === "comprehensive"
      ? "Comprehensive"
      : examType === "retake"
        ? "Retake"
        : "Diagnostic",
    viewLimit === "top10" ? "Top 10" : "All ranks",
    courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
    yearFilter === "ALL" ? "All incoming years" : `Incoming year ${yearFilter}`,
    seasonLabel,
  ].join(" · ");

  if (loading && !data) {
    return (
      <section className="card analytics-rankings">
        <p className="muted">Loading rankings...</p>
      </section>
    );
  }

  return (
    <AnalyticsPrintArea
      id="analytics-print-rankings"
      title="Analytics — Rankings"
      subtitle={filterSubtitle}
    >
      <section className={`card analytics-rankings${refreshing ? " is-refreshing" : ""}`}>
        <div className="analytics-rankings-top">
        <AnalyticsSeasonControl />

        <header className="analytics-rankings-header">
          <div>
            <h2>Score rankings</h2>
          </div>
        </header>

        <div className="analytics-reports-filter analytics-no-print">
          <div className="analytics-reports-filter-primary">
            <SegmentedControl
              segments={[...EXAM_TYPE_SEGMENTS]}
              value={examType}
              onChange={(value) => setExamType(value as ExamTypeTab)}
              scrollable
            />
          </div>
          <div className="analytics-reports-filters">
            <label className="analytics-reports-filter-field">
              Course
              <select
                value={courseFilter}
                onChange={(event) =>
                  setCourseFilter(event.target.value as ProgramCourseFilter)
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
              Year level
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value as YearLevelFilter)}
              >
                <option value="ALL">All</option>
                {incomingYearLevelsForFilter(courseFilter).map((level) => (
                  <option key={level} value={String(level)}>
                    Incoming year {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="analytics-reports-filter-field analytics-rankings-limit-field">
              Show
              <SegmentedControl
                segments={[...VIEW_LIMIT_SEGMENTS]}
                value={viewLimit}
                onChange={(value) => setViewLimit(value as ViewLimit)}
              />
            </label>
            <label className="analytics-reports-filter-field analytics-rankings-search">
              Search
              <input
                type="search"
                placeholder="Student name…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="analytics-rankings-summary">
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">Students in scope</span>
            <strong>{data?.studentsInScope ?? 0}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">Ranked</span>
            <strong>{data?.studentsRanked ?? 0}</strong>
          </article>
          {examType === "comprehensive" ? (
            <article className="analytics-trends-stat">
              <span className="analytics-trends-stat-label">Not yet assessed</span>
              {canOpenExamStatus ? (
                <button
                  type="button"
                  className="analytics-trends-stat-link"
                  onClick={() =>
                    onOpenExamStatus?.({
                      category: "first_not_taken",
                      courseFilter,
                      yearFilter,
                    })
                  }
                >
                  {missingCount}
                </button>
              ) : (
                <strong>{missingCount}</strong>
              )}
            </article>
          ) : null}
        </div>

        {error ? <p className="error">{error}</p> : null}
        </div>

        {!data || data.studentsRanked === 0 ? (
          <p className="muted analytics-rankings-empty">No {examTypeLabel(examType)} exam scores yet for this filter.</p>
        ) : filteredRankings.length === 0 ? (
          <p className="muted analytics-rankings-empty">
            No students match{searchTrimmed ? ` "${searchTrimmed}"` : " your search"}.
          </p>
        ) : (
          <div className="analytics-rankings-body">
          <ListPanel
            className="analytics-rankings-list-panel"
            footer={
              visibleRankings.length > 0 ? (
                <p className="muted analytics-rankings-footer-summary">
                  {viewLimit === "top10" && filteredRankings.length > visibleRankings.length
                    ? `Showing top ${visibleRankings.length} of ${filteredRankings.length} ranked student${filteredRankings.length === 1 ? "" : "s"}${searchTrimmed ? ` matching "${searchTrimmed}"` : ""}.`
                    : `${visibleRankings.length} ranked student${visibleRankings.length === 1 ? "" : "s"}${searchTrimmed ? ` matching "${searchTrimmed}"` : ""}${searchTrimmed && filteredRankings.length < rankings.length ? ` (${rankings.length} total)` : ""}.`}
                </p>
              ) : null
            }
          >
            <div className="modal-table-wrap">
              <table className="analytics-rankings-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Year</th>
                    <th>Course</th>
                    <th>Score</th>
                    <th>Result</th>
                    {examType !== "retake" ? <th>Attempt</th> : null}
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRankings.map((row) => (
                    <tr
                      key={row.studentId}
                      className={onViewStudent ? "analytics-rankings-row-clickable" : undefined}
                      tabIndex={onViewStudent ? 0 : undefined}
                      role={onViewStudent ? "button" : undefined}
                      onClick={
                        onViewStudent
                          ? () => onViewStudent(row.studentId, row.name)
                          : undefined
                      }
                      onKeyDown={
                        onViewStudent
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onViewStudent(row.studentId, row.name);
                              }
                            }
                          : undefined
                      }
                    >
                      <td className="analytics-rankings-rank">{row.rank}</td>
                      <td>{formatFullName(row.firstName, row.lastName)}</td>
                      <td>{row.yearLevel ?? "—"}</td>
                      <td>
                        {row.programCourse ? formatProgramCourse(row.programCourse) : "—"}
                      </td>
                      <td className="analytics-rankings-score">
                        <strong>{row.percentage.toFixed(1)}%</strong>
                        <span className="muted">
                          {row.score}/{row.totalItems}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`analytics-rankings-result analytics-rankings-result-${
                            row.passed ? "pass" : "fail"
                          }`}
                        >
                          {row.passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                      {examType !== "retake" ? (
                        <td>{formatAttemptType(row.attemptType)}</td>
                      ) : null}
                      <td>{formatDate(row.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListPanel>
          </div>
        )}
      </section>
    </AnalyticsPrintArea>
  );
}
