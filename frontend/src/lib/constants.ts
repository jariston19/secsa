export const MIN_YEAR_LEVEL = 1;
export const MAX_YEAR_LEVEL = 4;
export const EXAM_SECONDS_PER_QUESTION = 60;

export function sanitizeYearInput(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseYearLevel(value: string): number {
  if (!value.trim()) return MIN_YEAR_LEVEL;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_YEAR_LEVEL;
  return Math.min(MAX_YEAR_LEVEL, Math.max(MIN_YEAR_LEVEL, Math.floor(parsed)));
}

export function curriculumYearForStudentYear(studentYear: number): number {
  return Math.max(MIN_YEAR_LEVEL, studentYear - 1);
}

export type QuestionSetExamType = "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE";

export function formatExamType(type: string): string {
  if (type === "COMPREHENSIVE") return "Comprehensive";
  if (type === "DIAGNOSTIC") return "Diagnostic";
  if (type === "RETAKE") return "Retake";
  return type;
}
