import { AttemptType, ApprovalStatus, QuestionSetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { nonQaExamAttemptWhere, nonQaStudentWhere } from "../lib/studentFilters.js";
import { countStudentsInScoreBuckets } from "../lib/scoreBuckets.js";

const MAX_RETAKES = 2;

function isComprehensiveExamType(type: QuestionSetType) {
  return type === QuestionSetType.COMPREHENSIVE || type === QuestionSetType.RETAKE;
}

function isDiagnosticExamType(type: QuestionSetType) {
  return type === QuestionSetType.DIAGNOSTIC;
}

function passRate(attempts: Array<{ passed: boolean | null }>) {
  if (attempts.length === 0) return 0;
  const passed = attempts.filter((attempt) => attempt.passed).length;
  return (passed / attempts.length) * 100;
}

function delta(current: number, previous: number) {
  return current - previous;
}

function periodBounds(daysAgoStart: number, daysAgoEnd: number) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    start: new Date(now - daysAgoStart * dayMs),
    end: new Date(now - daysAgoEnd * dayMs),
  };
}

function inPeriod(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

export async function buildOverviewDashboard(yearLevel?: number, programCourse?: string) {
  const attemptFilter = nonQaExamAttemptWhere(yearLevel, programCourse);

  const [students, attempts, pendingApprovals, latestSubmission] = await Promise.all([
    prisma.user.findMany({
      where: nonQaStudentWhere(yearLevel, programCourse),
      select: { id: true, yearLevel: true },
    }),
    prisma.examAttempt.findMany({
      where: { ...attemptFilter, submittedAt: { not: null } },
      select: {
        id: true,
        studentId: true,
        attemptType: true,
        attemptNumber: true,
        percentage: true,
        passed: true,
        submittedAt: true,
        questionSet: { select: { type: true } },
      },
      orderBy: [{ submittedAt: "desc" }],
    }),
    prisma.retakeApproval.count({
      where: {
        status: ApprovalStatus.PENDING,
        student: nonQaStudentWhere(yearLevel, programCourse),
      },
    }),
    prisma.examAttempt.findFirst({
      where: { ...attemptFilter, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    }),
  ]);

  const submittedAttempts = attempts.filter(
    (attempt): attempt is typeof attempt & { submittedAt: Date } => attempt.submittedAt != null
  );

  const now = new Date();
  const thisWeek = periodBounds(7, 0);
  const lastWeek = periodBounds(14, 7);
  const thisMonth = periodBounds(30, 0);
  const lastMonth = periodBounds(60, 30);

  const attemptsIn = (start: Date, end: Date) =>
    submittedAttempts.filter((attempt) => inPeriod(attempt.submittedAt, start, end));

  const weekCurrent = attemptsIn(thisWeek.start, now);
  const weekPrevious = attemptsIn(lastWeek.start, lastWeek.end);
  const monthCurrent = attemptsIn(thisMonth.start, now);
  const monthPrevious = attemptsIn(lastMonth.start, lastMonth.end);

  const overallPassRate = passRate(submittedAttempts);

  const comprehensiveAttempts = submittedAttempts.filter((attempt) =>
    isComprehensiveExamType(attempt.questionSet.type)
  );
  const diagnosticAttempts = submittedAttempts.filter((attempt) =>
    isDiagnosticExamType(attempt.questionSet.type)
  );

  const latestAttemptByStudent = new Map<string, (typeof submittedAttempts)[number]>();
  for (const attempt of submittedAttempts) {
    if (!latestAttemptByStudent.has(attempt.studentId)) {
      latestAttemptByStudent.set(attempt.studentId, attempt);
    }
  }

  const latestComprehensiveByStudent = new Map<string, (typeof submittedAttempts)[number]>();
  for (const attempt of comprehensiveAttempts) {
    if (!latestComprehensiveByStudent.has(attempt.studentId)) {
      latestComprehensiveByStudent.set(attempt.studentId, attempt);
    }
  }

  const latestDiagnosticByStudent = new Map<string, (typeof submittedAttempts)[number]>();
  for (const attempt of diagnosticAttempts) {
    if (!latestDiagnosticByStudent.has(attempt.studentId)) {
      latestDiagnosticByStudent.set(attempt.studentId, attempt);
    }
  }

  const comprehensiveScoreDistribution = countStudentsInScoreBuckets(
    [...latestComprehensiveByStudent.values()].map((attempt) => attempt.percentage ?? 0)
  );
  const diagnosticScoreDistribution = countStudentsInScoreBuckets(
    [...latestDiagnosticByStudent.values()].map((attempt) => attempt.percentage ?? 0)
  );

  const comprehensiveIn = (start: Date, end: Date) =>
    comprehensiveAttempts.filter((attempt) => inPeriod(attempt.submittedAt, start, end));
  const diagnosticIn = (start: Date, end: Date) =>
    diagnosticAttempts.filter((attempt) => inPeriod(attempt.submittedAt, start, end));

  const comprehensiveWeekCurrent = comprehensiveIn(thisWeek.start, now);
  const comprehensiveWeekPrevious = comprehensiveIn(lastWeek.start, lastWeek.end);
  const comprehensiveMonthCurrent = comprehensiveIn(thisMonth.start, now);
  const comprehensiveMonthPrevious = comprehensiveIn(lastMonth.start, lastMonth.end);

  const diagnosticWeekCurrent = diagnosticIn(thisWeek.start, now);
  const diagnosticWeekPrevious = diagnosticIn(lastWeek.start, lastWeek.end);
  const diagnosticMonthCurrent = diagnosticIn(thisMonth.start, now);
  const diagnosticMonthPrevious = diagnosticIn(lastMonth.start, lastMonth.end);

  const buildExamTypeHealth = (
    attemptsForType: typeof submittedAttempts,
    weekCurrent: typeof submittedAttempts,
    weekPrevious: typeof submittedAttempts,
    monthCurrent: typeof submittedAttempts,
    monthPrevious: typeof submittedAttempts,
    scoreDistribution: ReturnType<typeof countStudentsInScoreBuckets>
  ) => ({
    passRate: passRate(attemptsForType),
    examsTaken: attemptsForType.length,
    trend: {
      week: {
        current: passRate(weekCurrent),
        previous: passRate(weekPrevious),
        delta: delta(passRate(weekCurrent), passRate(weekPrevious)),
        exams: weekCurrent.length,
      },
      month: {
        current: passRate(monthCurrent),
        previous: passRate(monthPrevious),
        delta: delta(passRate(monthCurrent), passRate(monthPrevious)),
        exams: monthCurrent.length,
      },
    },
    scoreDistribution,
  });

  const failingStudents = [...latestAttemptByStudent.values()].filter(
    (attempt) => attempt.passed === false
  ).length;

  const failedNotRetaken = [...latestAttemptByStudent.values()].filter((attempt) => {
    if (attempt.passed !== false) return false;
    const studentAttempts = submittedAttempts.filter((row) => row.studentId === attempt.studentId);
    const hasRetakeAfterFailure = studentAttempts.some(
      (row) =>
        row.attemptType === AttemptType.RETAKE &&
        row.submittedAt > attempt.submittedAt
    );
    return !hasRetakeAfterFailure;
  }).length;

  const attemptsByStudent = new Map<string, typeof submittedAttempts>();
  for (const attempt of submittedAttempts) {
    const list = attemptsByStudent.get(attempt.studentId) ?? [];
    list.push(attempt);
    attemptsByStudent.set(attempt.studentId, list);
  }

  const retakerStudentIds = new Set(
    submittedAttempts
      .filter((attempt) => attempt.attemptType === AttemptType.RETAKE)
      .map((attempt) => attempt.studentId)
  );

  const retakersWhoEventuallyPassed = [...retakerStudentIds].filter((studentId) => {
    const studentAttempts = attemptsByStudent.get(studentId) ?? [];
    return studentAttempts.some((attempt) => attempt.passed);
  }).length;

  const attemptsToPassValues: number[] = [];
  for (const studentAttempts of attemptsByStudent.values()) {
    const chronological = [...studentAttempts].sort(
      (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
    );
    const firstPassIndex = chronological.findIndex((attempt) => attempt.passed);
    if (firstPassIndex >= 0) {
      attemptsToPassValues.push(firstPassIndex + 1);
    }
  }

  const exhaustedRetakeLimit = [...attemptsByStudent.values()].filter((studentAttempts) => {
    const retakeCount = studentAttempts.filter(
      (attempt) => attempt.attemptType === AttemptType.RETAKE
    ).length;
    return retakeCount >= MAX_RETAKES;
  }).length;

  const passRateByYear = [1, 2, 3, 4].map((year) => {
    const yearStudentIds = new Set(
      students.filter((student) => student.yearLevel === year).map((student) => student.id)
    );
    const yearLatest = [...latestAttemptByStudent.entries()]
      .filter(([studentId]) => yearStudentIds.has(studentId))
      .map(([, attempt]) => attempt);

    return {
      yearLevel: year,
      students: yearLatest.length,
      passRate: passRate(yearLatest),
    };
  });

  const firstTakerAttempts = submittedAttempts.filter(
    (attempt) => attempt.attemptType === AttemptType.FIRST
  );
  const retakeAttempts = submittedAttempts.filter(
    (attempt) => attempt.attemptType === AttemptType.RETAKE
  );

  const average = (values: number[]) =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return {
    students: students.length,
    examsTaken: submittedAttempts.length,
    passRate: overallPassRate,
    averageScore: average(submittedAttempts.map((attempt) => attempt.percentage ?? 0)),
    performanceHealth: {
      comprehensive: buildExamTypeHealth(
        comprehensiveAttempts,
        comprehensiveWeekCurrent,
        comprehensiveWeekPrevious,
        comprehensiveMonthCurrent,
        comprehensiveMonthPrevious,
        comprehensiveScoreDistribution
      ),
      diagnostic: buildExamTypeHealth(
        diagnosticAttempts,
        diagnosticWeekCurrent,
        diagnosticWeekPrevious,
        diagnosticMonthCurrent,
        diagnosticMonthPrevious,
        diagnosticScoreDistribution
      ),
      failingStudents,
    },
    retakeEffectiveness: {
      retakersWhoEventuallyPassed,
      totalRetakerStudents: retakerStudentIds.size,
      eventualPassRate:
        retakerStudentIds.size > 0
          ? (retakersWhoEventuallyPassed / retakerStudentIds.size) * 100
          : 0,
      averageAttemptsToPass: average(attemptsToPassValues),
      exhaustedRetakeLimit,
      firstTakers: {
        count: firstTakerAttempts.length,
        passRate: passRate(firstTakerAttempts),
        averageScore: average(firstTakerAttempts.map((attempt) => attempt.percentage ?? 0)),
      },
      retakers: {
        count: retakeAttempts.length,
        passRate: passRate(retakeAttempts),
        averageScore: average(retakeAttempts.map((attempt) => attempt.percentage ?? 0)),
      },
    },
    examActivity: {
      examsThisWeek: weekCurrent.length,
      examsLastWeek: weekPrevious.length,
      examsThisMonth: monthCurrent.length,
      examsLastMonth: monthPrevious.length,
      pendingRetakeApprovals: pendingApprovals,
      lastSubmissionAt: latestSubmission?.submittedAt?.toISOString() ?? null,
    },
    atRisk: {
      failedNotRetaken,
      failingStudents,
    },
    passRateByYear,
  };
}
