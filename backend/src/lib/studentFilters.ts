import { Role } from "@prisma/client";
import { submittedAtFilter } from "./analyticsSeason.js";

export function nonQaStudentWhere(yearLevel?: number, programCourse?: string) {
  return {
    role: Role.STUDENT,
    qaUnlimited: false,
    ...(Number.isFinite(yearLevel) ? { yearLevel } : {}),
    ...(programCourse ? { programCourse } : {}),
  };
}

export function nonQaExamAttemptWhere(yearLevel?: number, programCourse?: string) {
  return {
    student: nonQaStudentWhere(yearLevel, programCourse),
  };
}

export function nonQaSubmittedExamWhere(
  yearLevel?: number,
  programCourse?: string,
  examYear?: number
) {
  return {
    submittedAt: submittedAtFilter(examYear),
    ...nonQaExamAttemptWhere(yearLevel, programCourse),
  };
}

export function nonQaAnswerWhere(
  yearLevel?: number,
  programCourse?: string,
  examYear?: number
) {
  return {
    examAttempt: nonQaSubmittedExamWhere(yearLevel, programCourse, examYear),
  };
}
