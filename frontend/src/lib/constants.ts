import { maxYearLevelForProgram } from "./programCourse";

export const MIN_YEAR_LEVEL = 1;
export const MAX_YEAR_LEVEL = 4;
export const ABSOLUTE_MAX_YEAR_LEVEL = 5;
export const MAX_EXAM_FOCUS_VIOLATIONS = 3;

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

export function parseYearLevel(value: string, programCourse?: string | null): number {
  if (!value.trim()) return MIN_YEAR_LEVEL;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_YEAR_LEVEL;
  const max = maxYearLevelForProgram(programCourse);
  return Math.min(max, Math.max(MIN_YEAR_LEVEL, Math.floor(parsed)));
}

export function curriculumYearForStudentYear(studentYear: number): number {
  return Math.max(MIN_YEAR_LEVEL, studentYear - 1);
}

export type QuestionSetExamType = "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE" | "PREBOARD";

export function formatExamType(type: string): string {
  if (type === "COMPREHENSIVE") return "Comprehensive";
  if (type === "DIAGNOSTIC") return "Diagnostic";
  if (type === "RETAKE") return "Retake";
  if (type === "PREBOARD") return "Preboard";
  return type;
}

/** Incoming year when students take preboard (final year of their program). */
export function preboardStudentYearForProgram(programCourse?: string | null) {
  return maxYearLevelForProgram(programCourse);
}

export function preboardMaxCurriculumYearForProgram(programCourse?: string | null) {
  return maxYearLevelForProgram(programCourse);
}
