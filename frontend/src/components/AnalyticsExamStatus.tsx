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
import { printExamStatusRoster } from "../lib/printExamStatusRoster";
import { formatProgramCourse, type ProgramCourseFilter } from "../lib/programCourse";

export type ExamStatusCategory = "first_not_taken" | "retake_pending";

export type ExamStatusNavigationRequest = {
  category: ExamStatusCategory;
  courseFilter?: ProgramCourseFilter;
  yearFilter?: RosterYearFilter;
};

type ExamStatusRow = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  status: string;
  firstAttemptScore?: number | null;
  firstAttemptPercentage?: number | null;
  firstAttemptSubmittedAt?: string | null;
  approvalStatus?: string | null;
  approvedAt?: string | null;
};

interface ExamStatusData {
  category: ExamStatusCategory;
  examYear: number;
  studentsInScope: number;
  count: number;
  students: ExamStatusRow[];
}

interface Props {
  token: string | null;
  navigationRequest?: ExamStatusNavigationRequest | null;
  onNavigationConsumed?: () => void;
}

const CATEGORY_SEGMENTS = [
  { id: "first_not_taken", label: "Not taken" },
  { id: "retake_pending", label: "Retake pending" },
] as const;

function formatStatus(status: string) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "waiting_approval":
      return "Waiting approval";
    case "ready_to_retake":
      return "Ready to retake";
    default:
      return status;
  }
}

function matchesSearch(row: ExamStatusRow, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const haystack = `${row.firstName} ${row.lastName} ${row.name} ${row.email}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function ExamStatusTable({
  rows,
  category,
  startIndex = 0,
}: {
  rows: ExamStatusRow[];
  category: ExamStatusCategory;
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
          <th>Status</th>
          {category === "retake_pending" ? (
            <>
              <th>First attempt</th>
              <th>Approved</th>
            </>
          ) : null}
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
            <td>
              <span className={`analytics-exam-status-badge analytics-exam-status-${row.status}`}>
                {formatStatus(row.status)}
              </span>
            </td>
            {category === "retake_pending" ? (
              <>
                <td>{formatRosterScore(row.firstAttemptPercentage, row.firstAttemptScore)}</td>
                <td>{formatRosterDate(row.approvedAt)}</td>
              </>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsExamStatus({
  token,
  navigationRequest,
  onNavigationConsumed,
}: Props) {
  const { appendExamYear, examYear, seasonLabel } = useAnalyticsSeason();
  const [category, setCategory] = useState<ExamStatusCategory>("first_not_taken");
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<RosterYearFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<ExamStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!navigationRequest) return;
    setCategory(navigationRequest.category);
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

    api<ExamStatusData>(`/analytics/exam-status${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load exam status roster")
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

  const categoryLabel =
    category === "first_not_taken" ? "Not taken" : "Retake pending";

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
      if (category === "first_not_taken") {
        return `Every student in scope has submitted their first exam for ${data?.examYear ?? "this exam year"}.`;
      }
      return "No students are waiting on a retake for this filter.";
    }
    return "";
  }, [students.length, filteredStudents.length, data, category]);

  const seasonNote =
    examYear === "ALL"
      ? `Uses exam year ${data?.examYear ?? "…"} when period is set to all years.`
      : undefined;

  if (loading && !data) {
    return (
      <section className="card analytics-exam-status analytics-roster-page">
        <p className="muted">Loading exam status...</p>
      </section>
    );
  }

  function handlePrint() {
    printExamStatusRoster({
      title: "Exam Status",
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
        title="Exam status"
        tabs={CATEGORY_SEGMENTS}
        activeTab={category}
        onTabChange={(value) => setCategory(value as ExamStatusCategory)}
        courseFilter={courseFilter}
        onCourseFilterChange={setCourseFilter}
        yearFilter={yearFilter}
        onYearFilterChange={setYearFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        stats={[
          { label: "Students in scope", value: data?.studentsInScope ?? 0 },
          {
            label: category === "first_not_taken" ? "Not yet assessed" : "Retake pending",
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
                <ExamStatusTable
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
