import { formatFullName } from "./names";
import { formatProgramCourse } from "./programCourse";
import { escapeHtml, printHtmlDocument } from "./printHtmlDocument";

export type RankingsPrintExamType = "comprehensive" | "diagnostic" | "retake";

export type RankingsPrintRow = {
  rank: number;
  firstName: string;
  lastName: string;
  yearLevel: number | null;
  programCourse: string | null;
  percentage: number;
  score: number;
  totalItems: number;
  passed: boolean;
  attemptType: string;
  submittedAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function formatScore(row: RankingsPrintRow) {
  return `${row.percentage.toFixed(1)}% (${row.score}/${row.totalItems})`;
}

function renderTable(rows: RankingsPrintRow[], examType: RankingsPrintExamType) {
  const showAttempt = examType !== "retake";
  const headers = [
    "Rank",
    "Student",
    "Year",
    "Course",
    "Score",
    "Result",
    ...(showAttempt ? ["Attempt"] : []),
    "Submitted",
  ];

  const headerHtml = headers.map((label) => `<th>${escapeHtml(label)}</th>`).join("");

  const bodyHtml = rows
    .map((row) => {
      const cells = [
        String(row.rank),
        formatFullName(row.firstName, row.lastName),
        row.yearLevel != null ? String(row.yearLevel) : "—",
        row.programCourse ? formatProgramCourse(row.programCourse) : "—",
        formatScore(row),
        row.passed ? "Pass" : "Fail",
        ...(showAttempt ? [formatAttemptType(row.attemptType)] : []),
        formatDate(row.submittedAt),
      ];

      const resultClass = row.passed ? "success" : "error";
      return `<tr>${cells
        .map((cell, index) => {
          if (index === 5) {
            return `<td class="${resultClass}">${escapeHtml(cell)}</td>`;
          }
          return `<td>${escapeHtml(cell)}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}

export function printRankingsList(params: {
  title: string;
  subtitle: string;
  examType: RankingsPrintExamType;
  rows: RankingsPrintRow[];
  studentsInScope: number;
  studentsRanked: number;
}) {
  const bodyHtml = `
    <header class="report-header">
      <h1>${escapeHtml(params.title)}</h1>
      <p class="muted">${escapeHtml(params.subtitle)}</p>
      <p class="muted">${params.rows.length} student${params.rows.length === 1 ? "" : "s"} listed · ${params.studentsRanked} ranked · ${params.studentsInScope} in scope</p>
    </header>
    ${renderTable(params.rows, params.examType)}
  `;

  printHtmlDocument(params.title, bodyHtml);
}
