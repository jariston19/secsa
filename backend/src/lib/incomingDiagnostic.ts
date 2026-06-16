import { QuestionSetStatus, QuestionSetType } from "@prisma/client";
import { prisma } from "./prisma.js";

export const SHARED_DIAGNOSTIC_PROGRAM = "ALL_PROGRAMS";

export const SHARED_INCOMING_DIAGNOSTIC_NAME = "Incoming Diagnostic — Gen Ed";

export function isSharedDiagnosticProgram(programCourse: string) {
  return programCourse === SHARED_DIAGNOSTIC_PROGRAM;
}

export function incomingDiagnosticAttemptFilter() {
  return {
    questionSet: {
      type: QuestionSetType.DIAGNOSTIC,
      yearLevel: 1,
    },
  } as const;
}

export async function findDeployedIncomingDiagnostic() {
  return prisma.questionSet.findFirst({
    where: {
      yearLevel: 1,
      programCourse: SHARED_DIAGNOSTIC_PROGRAM,
      type: QuestionSetType.DIAGNOSTIC,
      status: QuestionSetStatus.DEPLOYED,
    },
  });
}

export async function findDeployedIncomingDiagnosticWithConfigs() {
  return prisma.questionSet.findFirst({
    where: {
      yearLevel: 1,
      programCourse: SHARED_DIAGNOSTIC_PROGRAM,
      type: QuestionSetType.DIAGNOSTIC,
      status: QuestionSetStatus.DEPLOYED,
    },
    include: { configs: true },
  });
}
