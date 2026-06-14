import { Role } from "@prisma/client";

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

export function nonQaSubmittedExamWhere(yearLevel?: number, programCourse?: string) {
  return {
    submittedAt: { not: null as Date | null },
    ...nonQaExamAttemptWhere(yearLevel, programCourse),
  };
}

export function nonQaAnswerWhere(yearLevel?: number, programCourse?: string) {
  return {
    examAttempt: nonQaSubmittedExamWhere(yearLevel, programCourse),
  };
}
