import { formatFullName } from "./names";
import { formatProgramCourse } from "./programCourse";
import { escapeHtml, printHtmlDocument } from "./printHtmlDocument";

export type ExamResultsPrintCategory = "passed" | "failed_after_retake";

export type ExamResultsPrintRow = {
  firstName: string;
  lastName: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  outcome?: "first_take" | "retake";
  passingPercentage?: number | null;
  passingScore?: number | null;
  passedAt?: string | null;
  firstAttemptPercentage?: number | null;
  firstAttemptScore?: number | null;
  retakePercentage?: number | null;
  retakeScore?: number | null;
  retakeSubmittedAt?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatScore(percentage: number | null | undefined, score: number | null | undefined) {
  if (percentage != null) {
    return `${percentage.toFixed(1)}%${score != null ? ` (${score})` : ""}`;
  }
  return "—";
}

function formatOutcome(outcome: "first_take" | "retake" | undefined) {
  if (outcome === "retake") return "Retake";
  if (outcome === "first_take") return "First take";
  return "—";
}

function renderTable(rows: ExamResultsPrintRow[], category: ExamResultsPrintCategory) {
  const headers =
    category === "passed"
      ? ["#", "Student", "Email", "Year", "Course", "Outcome", "Score", "Passed"]
      : [
          "#",
          "Student",
          "Email",
          "Year",
          "Course",
          "First attempt",
          "Retake",
          "Retake submitted",
        ];

  const headerHtml = headers.map((label) => `<th>${escapeHtml(label)}</th>`).join("");

  const bodyHtml = rows
    .map((row, index) => {
      const cells =
        category === "passed"
          ? [
              String(index + 1),
              formatFullName(row.firstName, row.lastName),
              row.email,
              row.yearLevel != null ? String(row.yearLevel) : "—",
              row.programCourse ? formatProgramCourse(row.programCourse) : "—",
              formatOutcome(row.outcome),
              formatScore(row.passingPercentage, row.passingScore),
              formatDate(row.passedAt),
            ]
          : [
              String(index + 1),
              formatFullName(row.firstName, row.lastName),
              row.email,
              row.yearLevel != null ? String(row.yearLevel) : "—",
              row.programCourse ? formatProgramCourse(row.programCourse) : "—",
              formatScore(row.firstAttemptPercentage, row.firstAttemptScore),
              formatScore(row.retakePercentage, row.retakeScore),
              formatDate(row.retakeSubmittedAt),
            ];

      return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}

export function printExamResultsRoster(params: {
  title: string;
  subtitle: string;
  category: ExamResultsPrintCategory;
  rows: ExamResultsPrintRow[];
}) {
  const bodyHtml = `
    <header class="report-header">
      <h1>${escapeHtml(params.title)}</h1>
      <p class="muted">${escapeHtml(params.subtitle)}</p>
      <p class="muted">${params.rows.length} student${params.rows.length === 1 ? "" : "s"}</p>
    </header>
    ${renderTable(params.rows, params.category)}
  `;

  printHtmlDocument(params.title, bodyHtml);
}
