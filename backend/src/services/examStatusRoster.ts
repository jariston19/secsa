import { AttemptType, ApprovalStatus, QuestionSetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { formatFullName } from "../lib/names.js";
import { nonQaExamAttemptWhere, nonQaStudentWhere } from "../lib/studentFilters.js";
import { submittedAtFilter, listAvailableExamYears } from "../lib/analyticsSeason.js";
import { MIN_YEAR_LEVEL } from "../lib/yearLevel.js";
import {
  isComprehensiveFirstInProgress,
  isDiagnosticInProgress,
  isRetakeInProgress,
  mapNextActionToRetakePipelineStatus,
  resolveExamNextAction,
  type FirstTakeRosterStatus,
  type RetakePipelineRosterStatus,
} from "../lib/examNextAction.js";

export type ExamStatusCategory = "first_not_taken" | "retake_pending";

export type ExamStatusStudent = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  status: FirstTakeRosterStatus | RetakePipelineRosterStatus;
  firstAttemptScore?: number | null;
  firstAttemptPercentage?: number | null;
  firstAttemptSubmittedAt?: string | null;
  approvalStatus?: string | null;
  approvedAt?: string | null;
};

function rosterStudentWhere(yearLevel?: number, programCourse?: string) {
  return nonQaStudentWhere(yearLevel, programCourse);
}

function sortStudents(left: ExamStatusStudent, right: ExamStatusStudent) {
  const lastNameDelta = left.lastName.localeCompare(right.lastName);
  if (lastNameDelta !== 0) return lastNameDelta;
  return left.firstName.localeCompare(right.firstName);
}

function isIncomingYearOne(studentYearLevel: number | null) {
  return studentYearLevel === MIN_YEAR_LEVEL;
}

export async function buildExamStatusRoster(filters: {
  category: ExamStatusCategory;
  yearLevel?: number;
  programCourse?: string;
  examYear?: number;
}) {
  const { category, yearLevel, programCourse, examYear } = filters;

  let effectiveExamYear = examYear;
  if (!Number.isFinite(effectiveExamYear)) {
    const years = await listAvailableExamYears();
    effectiveExamYear = years[0] ?? new Date().getUTCFullYear();
  }

  const studentWhere = rosterStudentWhere(yearLevel, programCourse);
  const submittedSeasonFilter = submittedAtFilter(effectiveExamYear);

  const [students, submittedComprehensiveFirst, submittedDiagnostic, inProgressAttempts, retakeApprovals] =
    await Promise.all([
      prisma.user.findMany({
        where: studentWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          yearLevel: true,
          programCourse: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.examAttempt.findMany({
        where: {
          ...nonQaExamAttemptWhere(yearLevel, programCourse),
          submittedAt: submittedSeasonFilter,
          questionSet: { type: QuestionSetType.COMPREHENSIVE },
          attemptType: AttemptType.FIRST,
        },
        select: {
          studentId: true,
          score: true,
          percentage: true,
          passed: true,
          submittedAt: true,
        },
      }),
      prisma.examAttempt.findMany({
        where: {
          ...nonQaExamAttemptWhere(yearLevel, programCourse),
          submittedAt: submittedSeasonFilter,
          questionSet: { type: QuestionSetType.DIAGNOSTIC, yearLevel: MIN_YEAR_LEVEL },
        },
        select: {
          studentId: true,
          score: true,
          percentage: true,
          passed: true,
          submittedAt: true,
        },
      }),
      prisma.examAttempt.findMany({
        where: {
          ...nonQaExamAttemptWhere(yearLevel, programCourse),
          submittedAt: null,
          OR: [
            {
              attemptType: AttemptType.FIRST,
              questionSet: { type: QuestionSetType.COMPREHENSIVE },
            },
            {
              attemptType: AttemptType.RETAKE,
              questionSet: { type: QuestionSetType.RETAKE },
            },
            {
              questionSet: { type: QuestionSetType.DIAGNOSTIC, yearLevel: MIN_YEAR_LEVEL },
            },
          ],
        },
        select: {
          studentId: true,
          attemptType: true,
          passed: true,
          submittedAt: true,
          questionSet: { select: { type: true } },
        },
      }),
      prisma.retakeApproval.findMany({
        where: {
          student: nonQaStudentWhere(yearLevel, programCourse),
          status: ApprovalStatus.APPROVED,
        },
        select: {
          studentId: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const studentsInScope = students.length;
  const submittedComprehensiveByStudent = new Map(
    submittedComprehensiveFirst.map((attempt) => [attempt.studentId, attempt])
  );
  const submittedDiagnosticByStudent = new Map(
    submittedDiagnostic.map((attempt) => [attempt.studentId, attempt])
  );
  const inProgressByStudent = new Map(
    inProgressAttempts.map((attempt) => [attempt.studentId, attempt])
  );

  const approvedRetakeCountByStudent = new Map<string, number>();
  const latestApprovalByStudent = new Map<
    string,
    { status: string; updatedAt: Date }
  >();
  for (const approval of retakeApprovals) {
    approvedRetakeCountByStudent.set(
      approval.studentId,
      (approvedRetakeCountByStudent.get(approval.studentId) ?? 0) + 1
    );
    if (!latestApprovalByStudent.has(approval.studentId)) {
      latestApprovalByStudent.set(approval.studentId, {
        status: approval.status,
        updatedAt: approval.updatedAt,
      });
    }
  }

  if (category === "first_not_taken") {
    const rosterStudents: ExamStatusStudent[] = [];

    for (const student of students) {
      const inProgress = inProgressByStudent.get(student.id) ?? null;

      if (isIncomingYearOne(student.yearLevel)) {
        if (submittedDiagnosticByStudent.has(student.id)) continue;

        const status: FirstTakeRosterStatus = isDiagnosticInProgress(inProgress)
          ? "in_progress"
          : "not_started";

        rosterStudents.push({
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          name: formatFullName(student.firstName, student.lastName),
          email: student.email,
          yearLevel: student.yearLevel,
          programCourse: student.programCourse,
          status,
        });
        continue;
      }

      if (submittedComprehensiveByStudent.has(student.id)) continue;

      const status: FirstTakeRosterStatus = isComprehensiveFirstInProgress(inProgress)
        ? "in_progress"
        : "not_started";

      rosterStudents.push({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        name: formatFullName(student.firstName, student.lastName),
        email: student.email,
        yearLevel: student.yearLevel,
        programCourse: student.programCourse,
        status,
      });
    }

    rosterStudents.sort(sortStudents);

    return {
      category,
      examYear: effectiveExamYear,
      studentsInScope,
      count: rosterStudents.length,
      students: rosterStudents,
    };
  }

  const allSubmittedForRetake = await prisma.examAttempt.findMany({
    where: {
      ...nonQaExamAttemptWhere(yearLevel, programCourse),
      submittedAt: submittedSeasonFilter,
    },
    select: {
      studentId: true,
      attemptType: true,
      passed: true,
      score: true,
      percentage: true,
      submittedAt: true,
      questionSet: { select: { type: true } },
    },
    orderBy: [{ submittedAt: "asc" }],
  });

  const attemptsByStudent = new Map<string, typeof allSubmittedForRetake>();
  for (const attempt of allSubmittedForRetake) {
    if (!attempt.submittedAt) continue;
    const list = attemptsByStudent.get(attempt.studentId) ?? [];
    list.push(attempt);
    attemptsByStudent.set(attempt.studentId, list);
  }

  const rosterStudents: ExamStatusStudent[] = [];

  for (const student of students) {
    if (isIncomingYearOne(student.yearLevel)) continue;

    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const firstComprehensiveAttempts = studentAttempts.filter(
      (attempt) =>
        attempt.attemptType === AttemptType.FIRST &&
        attempt.questionSet.type === QuestionSetType.COMPREHENSIVE
    );
    if (firstComprehensiveAttempts.length === 0) continue;

    const latestFirstComprehensive = firstComprehensiveAttempts.reduce((latest, attempt) =>
      attempt.submittedAt! > latest.submittedAt! ? attempt : latest
    );

    if (latestFirstComprehensive.passed !== false) continue;

    const hasRetakeAfterFailure = studentAttempts.some(
      (attempt) =>
        attempt.attemptType === AttemptType.RETAKE &&
        attempt.submittedAt! > latestFirstComprehensive.submittedAt!
    );
    if (hasRetakeAfterFailure) continue;

    const inProgress = inProgressByStudent.get(student.id) ?? null;
    const allAttemptsForAction = [
      ...studentAttempts.map((attempt) => ({
        attemptType: attempt.attemptType,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
        questionSet: attempt.questionSet,
      })),
      ...(inProgress
        ? [
            {
              attemptType: inProgress.attemptType,
              passed: null as boolean | null,
              submittedAt: null as Date | null,
              questionSet: inProgress.questionSet,
            },
          ]
        : []),
    ];

    const nextAction = resolveExamNextAction({
      yearLevel: student.yearLevel ?? MIN_YEAR_LEVEL + 1,
      inProgressAttempt: inProgress,
      attempts: allAttemptsForAction,
      approvedRetakes: approvedRetakeCountByStudent.get(student.id) ?? 0,
    });

    let status = mapNextActionToRetakePipelineStatus(nextAction);
    if (status === "in_progress" && !isRetakeInProgress(inProgress)) {
      status = null;
    }
    if (!status) continue;

    const latestApproval = latestApprovalByStudent.get(student.id);

    rosterStudents.push({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      name: formatFullName(student.firstName, student.lastName),
      email: student.email,
      yearLevel: student.yearLevel,
      programCourse: student.programCourse,
      status,
      firstAttemptScore: latestFirstComprehensive.score,
      firstAttemptPercentage: latestFirstComprehensive.percentage,
      firstAttemptSubmittedAt: latestFirstComprehensive.submittedAt?.toISOString() ?? null,
      approvalStatus: latestApproval?.status ?? null,
      approvedAt: latestApproval?.updatedAt.toISOString() ?? null,
    });
  }

  rosterStudents.sort(sortStudents);

  return {
    category,
    examYear: effectiveExamYear,
    studentsInScope,
    count: rosterStudents.length,
    students: rosterStudents,
  };
}
