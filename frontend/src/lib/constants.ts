export const MIN_YEAR_LEVEL = 1;
export const MAX_YEAR_LEVEL = 4;

export function formatExamTimeLimit(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  return `${minutes} min`;
}

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
