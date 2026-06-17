import type { DiagnosticProfile } from "../components/DiagnosticResultProfile";
import { formatExamType } from "./constants";
import {
  type DomainProgressionSeries,
  renderDomainProgressionSvg,
} from "./domainProgressionChart";
import { escapeHtml, printHtmlDocument } from "./printHtmlDocument";

type SubmissionAnswer = {
  text: string;
  subject: string;
  topic: string | null;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean | null;
};

type SubmissionPrintInput = {
  studentName: string;
  studentEmail: string;
  yearLevel: number | null;
  questionSetName: string;
  questionSetType: string;
  attemptType: string;
  attemptNumber: number;
  submittedAt: string | null;
  score: number | null;
  totalItems: number;
  percentage: number | null;
  passed: boolean | null;
  passThreshold: number;
  answers: SubmissionAnswer[];
  profile: DiagnosticProfile | null;
  profileVariant: "diagnostic" | "comprehensive" | null;
  domainProgression?: {
    hasAnyData: boolean;
    domains: DomainProgressionSeries[];
  };
};

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function reportHeader(input: SubmissionPrintInput) {
  return `
    <header class="report-header">
      <h1>${escapeHtml(input.studentName)}</h1>
      <p class="muted">${escapeHtml(input.studentEmail)} · Year ${input.yearLevel ?? "—"}</p>
      <p class="muted">
        ${escapeHtml(input.questionSetName)} · ${escapeHtml(formatExamType(input.questionSetType))} ·
        ${formatAttemptType(input.attemptType)} attempt #${input.attemptNumber}
        ${input.submittedAt ? ` · ${escapeHtml(formatDate(input.submittedAt))}` : ""}
      </p>
    </header>
  `;
}

function toneBarWidth(tone: "strong" | "moderate" | "weak") {
  if (tone === "strong") return 85;
  if (tone === "moderate") return 60;
  return 35;
}

function toneLabel(tone: "strong" | "moderate" | "weak") {
  if (tone === "strong") return "Strong";
  if (tone === "moderate") return "Developing";
  return "Needs focus";
}

function toneFillColor(tone: "strong" | "moderate" | "weak") {
  if (tone === "strong") return "#22c55e";
  if (tone === "moderate") return "#f59e0b";
  return "#ef4444";
}

function displayBarWidth(row: { score?: number; tone: "strong" | "moderate" | "weak" }) {
  const width = row.score ?? toneBarWidth(row.tone);
  return Math.max(4, Math.min(100, width));
}

function renderProfileHtml(
  profile: DiagnosticProfile,
  variant: "diagnostic" | "comprehensive"
) {
  const leadCopy =
    variant === "comprehensive"
      ? "Evaluation of strengths and areas to develop based on exam responses."
      : "Learning profile based on diagnostic responses — not a graded score.";

  const qualities =
    profile.qualities.length > 0
      ? `<section><h3>Learning profile</h3><ul>${profile.qualities
          .map((quality) => `<li>${escapeHtml(quality)}</li>`)
          .join("")}</ul></section>`
      : "";

  const strengths =
    profile.strongAreas.length > 0
      ? `<section><h3>Strengths</h3><ul>${profile.strongAreas
          .map(
            (area) =>
              `<li class="area-strong"><strong>${escapeHtml(area.label)}</strong> ${escapeHtml(area.message)}</li>`
          )
          .join("")}</ul></section>`
      : "";

  const weaknesses =
    profile.weakAreas.length > 0
      ? `<section><h3>Areas to develop</h3><ul>${profile.weakAreas
          .map(
            (area) =>
              `<li class="area-weak"><strong>${escapeHtml(area.label)}</strong> ${escapeHtml(area.message)}</li>`
          )
          .join("")}</ul></section>`
      : "";

  const bloom =
    profile.bloomLevels.length > 0
      ? `<section><h3>Cognitive domains</h3><p class="muted">How the student performed across recall, application, and higher-order thinking.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:0.5rem;">
          <tbody>
          ${profile.bloomLevels
            .map(
              (row) => `
            <tr>
              <td style="width:34%;padding:0.35rem 0.5rem 0.35rem 0;border:none;vertical-align:middle;">${escapeHtml(row.label)}</td>
              <td style="padding:0.35rem 0.5rem;border:none;vertical-align:middle;">
                <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                  <div style="width:${displayBarWidth(row)}%;height:10px;background:${toneFillColor(row.tone)};border-radius:999px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
                </div>
              </td>
              <td style="width:18%;padding:0.35rem 0 0.35rem 0.5rem;border:none;text-align:right;vertical-align:middle;color:${toneFillColor(row.tone)};font-weight:600;font-size:11px;">
                ${toneLabel(row.tone)}${row.score != null ? ` · ${row.score}%` : ""}
              </td>
            </tr>
          `
            )
            .join("")}
          </tbody>
        </table>
      </section>`
      : "";

  return `<p class="muted">${escapeHtml(leadCopy)}</p>${qualities}${strengths}${weaknesses}${bloom}`;
}

function examSummaryHtml(input: SubmissionPrintInput) {
  const isDiagnostic = input.questionSetType === "DIAGNOSTIC";
  if (isDiagnostic) {
    return `
      <div class="summary-box">
        <strong>Diagnostic profile complete</strong>
        <p class="muted">
          Score is recorded internally (${input.score ?? 0} / ${input.totalItems},
          ${input.percentage?.toFixed(1) ?? "0.0"}%) but not shown to the student as pass/fail.
        </p>
      </div>
    `;
  }

  return `
    <div class="summary-box">
      <p><strong>${input.score ?? 0} / ${input.totalItems}</strong> (${input.percentage?.toFixed(1) ?? "0.0"}%)</p>
      <p class="${input.passed ? "success" : "error"}">
        ${input.passed ? "Passed" : "Failed"} · pass threshold ${input.passThreshold}%
      </p>
    </div>
  `;
}

function answersTableHtml(answers: SubmissionAnswer[]) {
  const rows = answers
    .map((answer, index) => {
      const result =
        answer.isCorrect == null ? "—" : answer.isCorrect ? "Correct" : "Wrong";
      const resultClass = answer.isCorrect ? "success" : answer.isCorrect === false ? "error" : "";
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="question-text">${escapeHtml(answer.text)}</div>
            ${answer.topic ? `<div class="topic">${escapeHtml(answer.topic)}</div>` : ""}
          </td>
          <td>${escapeHtml(answer.subject)}</td>
          <td>${escapeHtml(answer.selectedOption ?? "—")}</td>
          <td>${escapeHtml(answer.correctOption)}</td>
          <td class="${resultClass}">${result}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <h2>Question responses</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Subject</th>
          <th>Selected</th>
          <th>Correct</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function printSubmissionExamReport(input: SubmissionPrintInput) {
  const title = `${input.studentName} — ${formatExamType(input.questionSetType)} Responses`;
  const bodyHtml = `
    ${reportHeader(input)}
    ${examSummaryHtml(input)}
    ${answersTableHtml(input.answers)}
  `;
  printHtmlDocument(title, bodyHtml);
}

export function printSubmissionProfileReport(input: SubmissionPrintInput) {
  if (!input.profile) return;

  const profileLabel =
    input.profileVariant === "comprehensive" ? "Exam evaluation" : "Diagnostic profile";
  const title = `${input.studentName} — ${profileLabel}`;

  const bodyHtml = `
    ${reportHeader(input)}
    <h2>${escapeHtml(profileLabel)}</h2>
    ${renderProfileHtml(input.profile, input.profileVariant ?? "diagnostic")}
  `;
  printHtmlDocument(title, bodyHtml);
}

export function printSubmissionDomainsReport(input: SubmissionPrintInput) {
  if (!input.domainProgression?.hasAnyData) return;

  const title = `${input.studentName} — Domain progression`;
  const bodyHtml = `
    ${reportHeader(input)}
    <h2>Domain progression</h2>
    <p class="muted">Cognitive domain scores (L1–L6) across Year 1 to Year 4 for this student.</p>
    ${renderDomainProgressionSvg(input.domainProgression.domains)}
  `;
  printHtmlDocument(title, bodyHtml);
}
