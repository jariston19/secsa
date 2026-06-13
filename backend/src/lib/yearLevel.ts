import { z } from "zod";

export const MIN_YEAR_LEVEL = 1;
export const MAX_YEAR_LEVEL = 4;

export const yearLevelSchema = z
  .number()
  .int()
  .min(MIN_YEAR_LEVEL)
  .max(MAX_YEAR_LEVEL);

export function curriculumYearForStudentYear(studentYear: number): number {
  return Math.max(MIN_YEAR_LEVEL, studentYear - 1);
}
