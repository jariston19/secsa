import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ListPanel from "./ListPanel";
import SegmentedControl from "./SegmentedControl";
import AnalyticsSeasonControl from "./AnalyticsSeasonControl";
import { api } from "../lib/api";
import { useAnalyticsSeason } from "../lib/analyticsSeason";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { formatFullName } from "../lib/names";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";
type ExamTypeTab = "comprehensive" | "diagnostic";
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
}

const EXAM_TYPE_SEGMENTS = [
  { id: "comprehensive", label: "Comprehensive" },
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

export default function AnalyticsRankings({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const { appendExamYear, seasonLabel } = useAnalyticsSeason();
  const [examType, setExamType] = useState<ExamTypeTab>("comprehensive");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [viewLimit, setViewLimit] = useState<ViewLimit>("all");
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
  const visibleRankings = viewLimit === "top10" ? rankings.slice(0, 10) : rankings;

  const filterSubtitle = [
    examType === "comprehensive" ? "Comprehensive" : "Diagnostic",
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
        <header className="analytics-rankings-header">
          <div>
            <h2>Score rankings</h2>
            <p className="muted section-desc">
              Students ranked by best {examType === "comprehensive" ? "comprehensive" : "diagnostic"}{" "}
              exam score. QA profiles are excluded.
            </p>
          </div>
        </header>

        <AnalyticsSeasonControl />

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
                {Array.from(
                  { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                  (_, index) => MIN_YEAR_LEVEL + index
                ).map((level) => (
                  <option key={level} value={String(level)}>
                    Incoming year {level}
                  </option>
                ))}
              </select>
            </label>
            <div className="analytics-reports-filter-field analytics-rankings-limit-field">
              <span>Show</span>
              <SegmentedControl
                segments={[...VIEW_LIMIT_SEGMENTS]}
                value={viewLimit}
                onChange={(value) => setViewLimit(value as ViewLimit)}
              />
            </div>
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
        </div>

        {error ? <p className="error">{error}</p> : null}
        </div>

        {!data || data.studentsRanked === 0 ? (
          <p className="muted analytics-rankings-empty">No {examType} exam scores yet for this filter.</p>
        ) : (
          <div className="analytics-rankings-body">
          <ListPanel
            className="analytics-rankings-list-panel"
            footer={
              visibleRankings.length > 0 ? (
                <p className="muted analytics-rankings-footer-summary">
                  {viewLimit === "top10" && rankings.length > visibleRankings.length
                    ? `Showing top ${visibleRankings.length} of ${rankings.length} ranked students.`
                    : `${visibleRankings.length} ranked student${visibleRankings.length === 1 ? "" : "s"}.`}
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
                    <th>Attempt</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRankings.map((row) => (
                    <tr key={row.studentId}>
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
                      <td>{formatAttemptType(row.attemptType)}</td>
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
