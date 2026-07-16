import { formatFullName } from "./names";
import { formatProgramCourse } from "./programCourse";
import { escapeHtml, printHtmlDocument } from "./printHtmlDocument";

export type ExamStatusPrintCategory = "first_not_taken" | "retake_pending";

export type ExamStatusPrintRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  status: string;
  firstAttemptPercentage?: number | null;
  firstAttemptScore?: number | null;
  approvedAt?: string | null;
};

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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function renderTable(rows: ExamStatusPrintRow[], category: ExamStatusPrintCategory) {
  const headers =
    category === "retake_pending"
      ? ["#", "Student", "Email", "Year", "Course", "Status", "First attempt", "Approved"]
      : ["#", "Student", "Email", "Year", "Course", "Status"];

  const headerHtml = headers.map((label) => `<th>${escapeHtml(label)}</th>`).join("");

  const bodyHtml = rows
    .map((row, index) => {
      const cells = [
        String(index + 1),
        formatFullName(row.firstName, row.lastName),
        row.email,
        row.yearLevel != null ? String(row.yearLevel) : "—",
        row.programCourse ? formatProgramCourse(row.programCourse) : "—",
        formatStatus(row.status),
      ];

      if (category === "retake_pending") {
        const scoreLabel =
          row.firstAttemptPercentage != null
            ? `${row.firstAttemptPercentage.toFixed(1)}%${
                row.firstAttemptScore != null ? ` (${row.firstAttemptScore})` : ""
              }`
            : "—";
        cells.push(scoreLabel, formatDate(row.approvedAt));
      }

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

export function printExamStatusRoster(input: {
  title: string;
  subtitle: string;
  category: ExamStatusPrintCategory;
  rows: ExamStatusPrintRow[];
}) {
  const bodyHtml = `
    <header class="report-header">
      <h1>${escapeHtml(input.title)}</h1>
      <p class="muted">${escapeHtml(input.subtitle)}</p>
      <p class="muted">${input.rows.length} student${input.rows.length === 1 ? "" : "s"}</p>
    </header>
    ${renderTable(input.rows, input.category)}
  `;

  printHtmlDocument(input.title, bodyHtml);
}
