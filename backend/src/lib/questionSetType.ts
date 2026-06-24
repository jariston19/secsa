import { QuestionSetType } from "@prisma/client";
import { maxYearLevelForProgram, MIN_YEAR_LEVEL } from "./yearLevel.js";

export function isPreboardQuestionSetType(type: QuestionSetType | string) {
  return type === QuestionSetType.PREBOARD;
}

/** Incoming year level when students take the preboard (final year of the program). */
export function preboardStudentYearForProgram(programCourse: string) {
  return maxYearLevelForProgram(programCourse);
}

/** Preboard pools may include subjects from curriculum year 1 through the program max. */
export function preboardMaxCurriculumYearForProgram(programCourse: string) {
  return maxYearLevelForProgram(programCourse);
}

export function isPreboardCurriculumYear(subjectYearLevel: number, programCourse: string) {
  return (
    subjectYearLevel >= MIN_YEAR_LEVEL &&
    subjectYearLevel <= preboardMaxCurriculumYearForProgram(programCourse)
  );
}
