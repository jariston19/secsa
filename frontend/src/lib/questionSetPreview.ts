import { api } from "./api";
import { formatExamType } from "./constants";
import { escapeHtml, printHtmlDocument } from "./printHtmlDocument";

export interface QuestionSetPreviewQuestion {
  id: string;
  text: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  imagePath: string | null;
  topic: string | null;
  subject: string;
}

export interface QuestionSetPreviewSection {
  configId: string;
  subject: { courseCode: string; courseTitle: string };
  topic: { name: string } | null;
  required: { easy: number; medium: number; hard: number };
  available: { easy: number; medium: number; hard: number };
  questions: QuestionSetPreviewQuestion[];
}

export interface QuestionSetPreviewData {
  questionSet: {
    id: string;
    name: string;
    yearLevel: number;
    type: string;
    status: string;
    totalItems: number;
    _count?: { examAttempts: number };
  };
  sections: QuestionSetPreviewSection[];
  isReady: boolean;
  validationErrors: string[];
}

export async function fetchQuestionSetPreview(setId: string, token: string | null) {
  return api<QuestionSetPreviewData>(`/question-sets/${setId}/preview`, {}, token);
}

function optionLabel(letter: string) {
  return letter.toUpperCase();
}

function renderOption(
  letter: string,
  text: string,
  correctOption: string
) {
  const isCorrect = correctOption.toUpperCase() === letter.toUpperCase();
  return `<li class="${isCorrect ? "option-correct" : ""}"><strong>${escapeHtml(optionLabel(letter))}.</strong> ${escapeHtml(text)}</li>`;
}

function renderQuestion(question: QuestionSetPreviewQuestion, index: number) {
  const imageHtml = question.imagePath
    ? `<img src="/uploads/${escapeHtml(question.imagePath)}" alt="Question illustration" class="question-image" />`
    : "";

  return `
    <article class="question-block">
      <div class="question-heading">
        <strong>${index}.</strong>
        <span class="difficulty">${escapeHtml(question.difficulty)}</span>
      </div>
      <p class="question-text">${escapeHtml(question.text)}</p>
      ${imageHtml}
      <ul class="question-options">
        ${renderOption("A", question.optionA, question.correctOption)}
        ${renderOption("B", question.optionB, question.correctOption)}
        ${renderOption("C", question.optionC, question.correctOption)}
        ${renderOption("D", question.optionD, question.correctOption)}
      </ul>
      <p class="answer-key muted">Answer key: <strong>${escapeHtml(question.correctOption.toUpperCase())}</strong></p>
    </article>
  `;
}

function renderSection(section: QuestionSetPreviewSection, questionOffset: number) {
  const sectionTitle = `${section.subject.courseCode} — ${section.subject.courseTitle}${
    section.topic ? ` / ${section.topic.name}` : " / Whole subject"
  }`;

  const questionsHtml =
    section.questions.length === 0
      ? `<p class="muted">No questions in this pool.</p>`
      : section.questions
          .map((question, index) => renderQuestion(question, questionOffset + index + 1))
          .join("");

  return `
    <section class="preview-section">
      <h3>${escapeHtml(sectionTitle)}</h3>
      <p class="muted section-meta">
        Required: ${section.required.easy} easy, ${section.required.medium} medium, ${section.required.hard} hard
        · Available: ${section.available.easy} easy, ${section.available.medium} medium, ${section.available.hard} hard
      </p>
      ${questionsHtml}
    </section>
  `;
}

export function printQuestionSetPreview(data: QuestionSetPreviewData) {
  const { questionSet, sections, isReady, validationErrors } = data;
  const title = `Question Set — ${questionSet.name}`;

  let questionNumber = 0;
  const sectionsHtml = sections
    .map((section) => {
      const html = renderSection(section, questionNumber);
      questionNumber += section.questions.length;
      return html;
    })
    .join("");

  const validationHtml =
    validationErrors.length > 0
      ? `<ul class="validation-list">${validationErrors
          .map((error) => `<li>${escapeHtml(error)}</li>`)
          .join("")}</ul>`
      : "";

  const bodyHtml = `
    <header class="report-header">
      <h1>${escapeHtml(questionSet.name)}</h1>
      <p class="muted">
        Year ${questionSet.yearLevel} · ${escapeHtml(formatExamType(questionSet.type))} · ${escapeHtml(questionSet.status)}
      </p>
    </header>
    <div class="summary-box">
      <p><strong>Total exam items:</strong> ${questionSet.totalItems}</p>
      <p class="${isReady ? "success" : "error"}">${isReady ? "Ready to deploy" : "Pool incomplete"}</p>
      ${validationHtml}
    </div>
    ${sectionsHtml}
  `;

  printHtmlDocument(title, bodyHtml);
}
