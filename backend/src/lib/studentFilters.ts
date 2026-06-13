import { Role } from "@prisma/client";

export function nonQaStudentWhere(yearLevel?: number) {
  return {
    role: Role.STUDENT,
    qaUnlimited: false,
    ...(Number.isFinite(yearLevel) ? { yearLevel } : {}),
  };
}

export function nonQaExamAttemptWhere(yearLevel?: number) {
  return {
    student: nonQaStudentWhere(yearLevel),
  };
}

export function nonQaSubmittedExamWhere(yearLevel?: number) {
  return {
    submittedAt: { not: null as Date | null },
    ...nonQaExamAttemptWhere(yearLevel),
  };
}

export function nonQaAnswerWhere(yearLevel?: number) {
  return {
    examAttempt: nonQaSubmittedExamWhere(yearLevel),
  };
}
