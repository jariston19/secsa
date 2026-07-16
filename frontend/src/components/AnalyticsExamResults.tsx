import { useEffect, useMemo, useRef, useState } from "react";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import AnalyticsRosterLayout, {
  formatRosterDate,
  formatRosterScore,
  rosterCourseLabel,
  type RosterYearFilter,
} from "./AnalyticsRosterLayout";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";
import { useAnalyticsSeason } from "../lib/analyticsSeason";
import { formatFullName } from "../lib/names";
import { printExamResultsRoster } from "../lib/printExamResultsRoster";
import { formatProgramCourse, type ProgramCourseFilter } from "../lib/programCourse";

export type ExamResultsCategory = "passed" | "failed_after_retake";

export type ExamResultsNavigationRequest = {
  category?: ExamResultsCategory;
  courseFilter?: ProgramCourseFilter;
  yearFilter?: RosterYearFilter;
};

type ExamResultsRow = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  outcome?: "first_take" | "retake";
  passingScore?: number | null;
  passingPercentage?: number | null;
  passedAt?: string | null;
  firstAttemptScore?: number | null;
  firstAttemptPercentage?: number | null;
  firstAttemptSubmittedAt?: string | null;
  retakeScore?: number | null;
  retakePercentage?: number | null;
  retakeSubmittedAt?: string | null;
};

interface ExamResultsData {
  category: ExamResultsCategory;
  examYear: number;
  studentsInScope: number;
  assessedCount: number;
  count: number;
  students: ExamResultsRow[];
}

interface Props {
  token: string | null;
  navigationRequest?: ExamResultsNavigationRequest | null;
  onNavigationConsumed?: () => void;
}

const CATEGORY_SEGMENTS = [
  { id: "passed", label: "Passed" },
  { id: "failed_after_retake", label: "Failed (retake)" },
] as const;

function formatOutcome(outcome: "first_take" | "retake" | undefined) {
  if (outcome === "retake") return "Retake";
  if (outcome === "first_take") return "First take";
  return "—";
}

function matchesSearch(row: ExamResultsRow, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const haystack = `${row.firstName} ${row.lastName} ${row.name} ${row.email}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function ExamResultsTable({
  rows,
  category,
  startIndex = 0,
}: {
  rows: ExamResultsRow[];
  category: ExamResultsCategory;
  startIndex?: number;
}) {
  return (
    <table className="analytics-rankings-table analytics-roster-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Student</th>
          <th>Email</th>
          <th>Year</th>
          <th>Course</th>
          {category === "passed" ? (
            <>
              <th>Outcome</th>
              <th>Score</th>
              <th>Date</th>
            </>
          ) : (
            <>
              <th>First attempt</th>
              <th>Retake</th>
              <th>Retake date</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id}>
            <td>{startIndex + index + 1}</td>
            <td>{formatFullName(row.firstName, row.lastName)}</td>
            <td className="analytics-roster-email">{row.email}</td>
            <td>{row.yearLevel ?? "—"}</td>
            <td>{rosterCourseLabel(row.programCourse)}</td>
            {category === "passed" ? (
              <>
                <td>{formatOutcome(row.outcome)}</td>
                <td>{formatRosterScore(row.passingPercentage, row.passingScore)}</td>
                <td>{formatRosterDate(row.passedAt)}</td>
              </>
            ) : (
              <>
                <td>{formatRosterScore(row.firstAttemptPercentage, row.firstAttemptScore)}</td>
                <td>{formatRosterScore(row.retakePercentage, row.retakeScore)}</td>
                <td>{formatRosterDate(row.retakeSubmittedAt)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsExamResults({
  token,
  navigationRequest,
  onNavigationConsumed,
}: Props) {
  const { appendExamYear, examYear, seasonLabel } = useAnalyticsSeason();
  const [category, setCategory] = useState<ExamResultsCategory>("passed");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<RosterYearFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<ExamResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!navigationRequest) return;
    if (navigationRequest.category) {
      setCategory(navigationRequest.category);
    }
    if (navigationRequest.courseFilter) {
      setCourseFilter(navigationRequest.courseFilter);
    }
    if (navigationRequest.yearFilter) {
      setYearFilter(navigationRequest.yearFilter);
    }
    onNavigationConsumed?.();
  }, [navigationRequest, onNavigationConsumed]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    appendExamYear(params);
    return `?${params.toString()}`;
  }, [category, courseFilter, yearFilter, appendExamYear]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<ExamResultsData>(`/analytics/exam-results${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load exam results")
      )
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  const students = data?.students ?? [];
  const filteredStudents = useMemo(
    () => students.filter((row) => matchesSearch(row, searchQuery)),
    [students, searchQuery]
  );

  const paginationResetKey = `${category}|${courseFilter}|${yearFilter}|${searchQuery}|${filteredStudents.length}`;
  const {
    page,
    setPage,
    totalPages,
    paginatedItems: paginatedStudents,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredStudents, { resetKey: paginationResetKey, pageSize: 25 });

  const categoryLabel = category === "passed" ? "Passed" : "Failed (retake)";

  const filterSubtitle = [
    categoryLabel,
    courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
    yearFilter === "ALL" ? "All years" : `Year ${yearFilter}`,
    examYear === "ALL" && data?.examYear
      ? `Exam year ${data.examYear} (latest)`
      : seasonLabel,
  ].join(" · ");

  const emptyMessage = useMemo(() => {
    if (students.length > 0 && filteredStudents.length === 0) {
      return "No students match your search.";
    }
    if ((data?.studentsInScope ?? 0) === 0) {
      return "No students match the selected course and year filters.";
    }
    if ((data?.count ?? 0) === 0) {
      if (category === "passed") {
        return "No students have passed the comprehensive exam for this filter yet.";
      }
      return "No students failed after retaking for this filter.";
    }
    return "";
  }, [students.length, filteredStudents.length, data, category]);

  const seasonNote =
    examYear === "ALL"
      ? `Comprehensive results for exam year ${data?.examYear ?? "…"}. Pending retakes are under Exam Status.`
      : undefined;

  if (loading && !data) {
    return (
      <section className="card analytics-exam-status analytics-roster-page">
        <p className="muted">Loading exam results...</p>
      </section>
    );
  }

  function handlePrint() {
    printExamResultsRoster({
      title: "Exam Results",
      subtitle: filterSubtitle,
      category,
      rows: filteredStudents,
    });
  }

  return (
    <section
      className={`card analytics-exam-status analytics-roster-page${refreshing ? " is-refreshing" : ""}`}
    >
      <AnalyticsRosterLayout
        title="Exam results"
        tabs={CATEGORY_SEGMENTS}
        activeTab={category}
        onTabChange={(value) => setCategory(value as ExamResultsCategory)}
        courseFilter={courseFilter}
        onCourseFilterChange={setCourseFilter}
        yearFilter={yearFilter}
        onYearFilterChange={setYearFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        stats={[
          { label: "Students in scope", value: data?.studentsInScope ?? 0 },
          { label: "Assessed", value: data?.assessedCount ?? 0 },
          {
            label: category === "passed" ? "Passed" : "Failed after retake",
            value: data?.count ?? 0,
          },
        ]}
        note={seasonNote}
        error={error}
        printDisabled={filteredStudents.length === 0}
        onPrint={handlePrint}
      >
        {filteredStudents.length === 0 ? (
          <p className="muted analytics-roster-empty">{emptyMessage}</p>
        ) : (
          <div className="analytics-roster-body">
            <ListPanel
              className="analytics-rankings-list-panel analytics-no-print"
              footer={
                <ModalPagination
                  page={page}
                  totalPages={totalPages}
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  totalItems={totalItems}
                  onPageChange={setPage}
                  itemNoun="student"
                  searchQuery={searchQuery}
                  layout="split"
                />
              }
            >
              <div className="modal-table-wrap">
                <ExamResultsTable
                  rows={paginatedStudents}
                  category={category}
                  startIndex={pageStart - 1}
                />
              </div>
            </ListPanel>
          </div>
        )}
      </AnalyticsRosterLayout>
    </section>
  );
}
