import { prisma } from "../lib/prisma.js";
import { nonQaStudentWhere } from "../lib/studentFilters.js";

export async function buildLiveExamMonitor(filters: {
  programCourse?: string;
  yearLevel?: number;
}) {
  const yearLevel =
    filters.yearLevel != null && Number.isFinite(filters.yearLevel)
      ? filters.yearLevel
      : undefined;

  const attempts = await prisma.examAttempt.findMany({
    where: {
      submittedAt: null,
      student: {
        ...nonQaStudentWhere(yearLevel, filters.programCourse),
        isActive: true,
      },
    },
    select: {
      id: true,
      totalItems: true,
      currentQuestionIndex: true,
      focusWarningCount: true,
      startedAt: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          yearLevel: true,
          programCourse: true,
        },
      },
      questionSet: {
        select: {
          name: true,
          type: true,
          timeLimitMinutes: true,
        },
      },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  const now = Date.now();

  return {
    activeCount: attempts.length,
    refreshedAt: new Date().toISOString(),
    sessions: attempts.map((attempt) => {
      const endsAt =
        attempt.startedAt.getTime() + attempt.questionSet.timeLimitMinutes * 60 * 1000;
      const questionNumber = Math.min(
        Math.max(attempt.currentQuestionIndex, 0) + 1,
        attempt.totalItems
      );

      return {
        attemptId: attempt.id,
        student: attempt.student,
        questionSetName: attempt.questionSet.name,
        questionSetType: attempt.questionSet.type,
        currentQuestionNumber: questionNumber,
        totalQuestions: attempt.totalItems,
        secondsRemaining: Math.max(0, Math.floor((endsAt - now) / 1000)),
        focusWarningCount: attempt.focusWarningCount,
        startedAt: attempt.startedAt.toISOString(),
      };
    }),
  };
}
