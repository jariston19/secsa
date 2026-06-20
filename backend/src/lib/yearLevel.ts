import { z } from "zod";

export const MIN_YEAR_LEVEL = 1;
export const DEFAULT_MAX_YEAR_LEVEL = 4;
export const ABSOLUTE_MAX_YEAR_LEVEL = 5;

/** Programs with a longer curriculum than the default four-year track. */
export const PROGRAM_MAX_YEAR_LEVELS: Record<string, number> = {
  ARCHITECTURE: 5,
};

/** Default cap used across analytics and four-year programs. */
export const MAX_YEAR_LEVEL = DEFAULT_MAX_YEAR_LEVEL;

export function maxYearLevelForProgram(programCourse?: string | null) {
  if (!programCourse) return DEFAULT_MAX_YEAR_LEVEL;
  return PROGRAM_MAX_YEAR_LEVELS[programCourse] ?? DEFAULT_MAX_YEAR_LEVEL;
}

export const yearLevelSchema = z
  .number()
  .int()
  .min(MIN_YEAR_LEVEL)
  .max(ABSOLUTE_MAX_YEAR_LEVEL);

export function assertYearLevelForProgram(programCourse: string, yearLevel: number) {
  const max = maxYearLevelForProgram(programCourse);
  if (yearLevel < MIN_YEAR_LEVEL || yearLevel > max) {
    throw Object.assign(
      new Error(`Year level must be between ${MIN_YEAR_LEVEL} and ${max} for this program course.`),
      { statusCode: 400 }
    );
  }
}

export function curriculumYearForStudentYear(studentYear: number): number {
  return Math.max(MIN_YEAR_LEVEL, studentYear - 1);
}
