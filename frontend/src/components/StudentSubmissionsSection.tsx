import { useEffect, useMemo, useState } from "react";
import ModalPagination from "./ModalPagination";
import SegmentedControl from "./SegmentedControl";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL, formatExamType } from "../lib/constants";

interface SubmissionRow {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    yearLevel: number | null;
  };
  questionSetName: string;
  questionSetYear: number;
  questionSetType: string;
  attemptType: string;
  attemptNumber: number;
  score: number | null;
  totalItems: number;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

const YEAR_SEGMENTS = [
  { id: "all", label: "All years" },
  ...Array.from({ length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 }, (_, index) => {
    const year = MIN_YEAR_LEVEL + index;
    return { id: String(year), label: `Year ${year}` };
  }),
];

const PAGE_SIZE = 20;

interface Props {
  token: string | null;
  onViewSubmission: (submissionId: string) => void;
}

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function StudentSubmissionsSection({ token, onViewSubmission }: Props) {
  const [yearFilter, setYearFilter] = useState("all");
  const [firstNameFilter, setFirstNameFilter] = useState("");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [page, setPage] = useState(1);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    setError("");

    const query = yearFilter === "all" ? "" : `?yearLevel=${yearFilter}`;
    api<{ submissions: SubmissionRow[] }>(`/analytics/submissions${query}`, {}, token)
      .then((data) => setSubmissions(data.submissions))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [token, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [yearFilter, firstNameFilter, lastNameFilter]);

  const filteredSubmissions = useMemo(() => {
    const first = firstNameFilter.trim().toLowerCase();
    const last = lastNameFilter.trim().toLowerCase();

    return submissions.filter((submission) => {
      if (first && !submission.student.firstName.toLowerCase().includes(first)) return false;
      if (last && !submission.student.lastName.toLowerCase().includes(last)) return false;
      return true;
    });
  }, [submissions, firstNameFilter, lastNameFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));

  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSubmissions.slice(start, start + PAGE_SIZE);
  }, [filteredSubmissions, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const countLabel = useMemo(() => {
    const count = filteredSubmissions.length;
    return `${count} submission${count === 1 ? "" : "s"}`;
  }, [filteredSubmissions.length]);

  const pageStart = filteredSubmissions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, filteredSubmissions.length);

  return (
    <section className="card student-submissions-panel">
      <div className="student-submissions-header">
        <div>
          <h2>Student Submissions</h2>
          <p className="muted section-desc">
            View each submitted exam by student, including score and per-question answers.
          </p>
        </div>
        <span className="muted student-submissions-count">{countLabel}</span>
      </div>

      <div className="student-submissions-toolbar">
        <SegmentedControl segments={YEAR_SEGMENTS} value={yearFilter} onChange={setYearFilter} />
        <div className="student-submissions-name-filters">
          <label>
            First name
            <input
              type="search"
              placeholder="Filter first name"
              value={firstNameFilter}
              onChange={(e) => setFirstNameFilter(e.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              type="search"
              placeholder="Filter last name"
              value={lastNameFilter}
              onChange={(e) => setLastNameFilter(e.target.value)}
            />
          </label>
        </div>
      </div>

      {!loading && !error && filteredSubmissions.length > 0 && (
        <ModalPagination
          page={page}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          totalItems={filteredSubmissions.length}
          onPageChange={setPage}
        />
      )}

      <div className="student-submissions-table-wrap">
        {loading ? (
          <p className="muted">Loading submissions...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : filteredSubmissions.length === 0 ? (
          <p className="muted">No submissions match your filters.</p>
        ) : (
          <table className="student-submissions-table">
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Year</th>
                <th>Exam set</th>
                <th>Attempt</th>
                <th>Score</th>
                <th>Result</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSubmissions.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <strong>{submission.student.firstName}</strong>
                    <div className="muted table-subtext">{submission.student.email}</div>
                  </td>
                  <td>{submission.student.lastName}</td>
                  <td>{submission.student.yearLevel ?? "—"}</td>
                  <td>
                    {submission.questionSetName}
                    <div className="muted table-subtext">
                      {formatExamType(submission.questionSetType)} · set year{" "}
                      {submission.questionSetYear}
                    </div>
                  </td>
                  <td>
                    {formatAttemptType(submission.attemptType)} #{submission.attemptNumber}
                  </td>
                  <td>
                    {submission.score ?? 0}/{submission.totalItems}
                    <div className="muted table-subtext">
                      {submission.percentage?.toFixed(1) ?? "0.0"}%
                    </div>
                  </td>
                  <td className={submission.passed ? "success" : "error"}>
                    {submission.passed ? "Pass" : "Fail"}
                  </td>
                  <td>{formatDate(submission.submittedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      onClick={() => onViewSubmission(submission.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </section>
  );
}
