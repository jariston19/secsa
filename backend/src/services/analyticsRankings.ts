import { QuestionSetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { formatFullName } from "../lib/names.js";
import { nonQaStudentWhere, nonQaSubmittedExamWhere } from "../lib/studentFilters.js";

export type RankingsExamType = "diagnostic" | "comprehensive";

function isComprehensiveExamType(type: QuestionSetType) {
  return type === QuestionSetType.COMPREHENSIVE || type === QuestionSetType.RETAKE;
}

function isDiagnosticExamType(type: QuestionSetType) {
  return type === QuestionSetType.DIAGNOSTIC;
}

function matchesExamType(type: QuestionSetType, examType: RankingsExamType) {
  return examType === "comprehensive"
    ? isComprehensiveExamType(type)
    : isDiagnosticExamType(type);
}

function assignRanks<T extends { percentage: number }>(rows: T[]) {
  let rank = 0;
  let position = 0;
  let previousScore: number | null = null;

  return rows.map((row) => {
    position += 1;
    if (previousScore === null || row.percentage < previousScore) {
      rank = position;
      previousScore = row.percentage;
    }
    return { ...row, rank };
  });
}

export async function buildAnalyticsRankings(filters: {
  examType: RankingsExamType;
  yearLevel?: number;
  programCourse?: string;
  examYear?: number;
}) {
  const { examType, yearLevel, programCourse, examYear } = filters;

  const [studentsInScope, attempts] = await Promise.all([
    prisma.user.count({
      where: nonQaStudentWhere(yearLevel, programCourse),
    }),
    prisma.examAttempt.findMany({
      where: {
        ...nonQaSubmittedExamWhere(yearLevel, programCourse, examYear),
        questionSet: {
          type:
            examType === "comprehensive"
              ? { in: [QuestionSetType.COMPREHENSIVE, QuestionSetType.RETAKE] }
              : QuestionSetType.DIAGNOSTIC,
        },
      },
      select: {
        id: true,
        studentId: true,
        attemptType: true,
        score: true,
        totalItems: true,
        percentage: true,
        passed: true,
        submittedAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            yearLevel: true,
            programCourse: true,
          },
        },
        questionSet: {
          select: { name: true, type: true, passThreshold: true },
        },
      },
      orderBy: [{ submittedAt: "desc" }],
    }),
  ]);

  const bestByStudent = new Map<
    string,
    (typeof attempts)[number] & { submittedAt: Date }
  >();

  for (const attempt of attempts) {
    if (!attempt.submittedAt || !matchesExamType(attempt.questionSet.type, examType)) {
      continue;
    }

    const percentage = attempt.percentage ?? 0;
    const existing = bestByStudent.get(attempt.studentId);
    if (!existing) {
      bestByStudent.set(attempt.studentId, attempt as typeof attempt & { submittedAt: Date });
      continue;
    }

    const existingScore = existing.percentage ?? 0;
    if (
      percentage > existingScore ||
      (percentage === existingScore && attempt.submittedAt > existing.submittedAt)
    ) {
      bestByStudent.set(attempt.studentId, attempt as typeof attempt & { submittedAt: Date });
    }
  }

  const sorted = [...bestByStudent.values()].sort((left, right) => {
    const scoreDelta = (right.percentage ?? 0) - (left.percentage ?? 0);
    if (scoreDelta !== 0) return scoreDelta;

    const lastNameDelta = left.student.lastName.localeCompare(right.student.lastName);
    if (lastNameDelta !== 0) return lastNameDelta;

    return left.student.firstName.localeCompare(right.student.firstName);
  });

  const rankings = assignRanks(
    sorted.map((attempt) => ({
      studentId: attempt.studentId,
      firstName: attempt.student.firstName,
      lastName: attempt.student.lastName,
      name: formatFullName(attempt.student.firstName, attempt.student.lastName),
      yearLevel: attempt.student.yearLevel,
      programCourse: attempt.student.programCourse,
      percentage: Math.round((attempt.percentage ?? 0) * 100) / 100,
      score: attempt.score ?? 0,
      totalItems: attempt.totalItems,
      passed: attempt.passed === true,
      passThreshold: attempt.questionSet.passThreshold,
      attemptType: attempt.attemptType,
      questionSetName: attempt.questionSet.name,
      submittedAt: attempt.submittedAt.toISOString(),
    }))
  );

  return {
    examType,
    studentsInScope,
    studentsRanked: rankings.length,
    rankings,
  };
}
