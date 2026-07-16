import { AttemptType, QuestionSetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { formatFullName } from "../lib/names.js";
import { nonQaExamAttemptWhere, nonQaStudentWhere } from "../lib/studentFilters.js";
import { submittedAtFilter, listAvailableExamYears } from "../lib/analyticsSeason.js";
import { MIN_YEAR_LEVEL } from "../lib/yearLevel.js";

export type ExamResultsCategory = "passed" | "failed_after_retake";

export type ExamResultsStudent = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  yearLevel: number | null;
  programCourse: string | null;
  outcome?: "first_take" | "retake";
  passingScore?: number | null;
  passingPercentage?: number | null;
  passedAt?: string | null;
  firstAttemptScore?: number | null;
  firstAttemptPercentage?: number | null;
  firstAttemptSubmittedAt?: string | null;
  retakeScore?: number | null;
  retakePercentage?: number | null;
  retakeSubmittedAt?: string | null;
};

function sortStudents(left: ExamResultsStudent, right: ExamResultsStudent) {
  const lastNameDelta = left.lastName.localeCompare(right.lastName);
  if (lastNameDelta !== 0) return lastNameDelta;
  return left.firstName.localeCompare(right.firstName);
}

function isIncomingYearOne(yearLevel: number | null) {
  return yearLevel === MIN_YEAR_LEVEL;
}

export async function buildExamResultsRoster(filters: {
  category: ExamResultsCategory;
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

  const studentWhere = nonQaStudentWhere(yearLevel, programCourse);
  const submittedSeasonFilter = submittedAtFilter(effectiveExamYear);

  const [students, submittedAttempts] = await Promise.all([
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
        OR: [
          {
            attemptType: AttemptType.FIRST,
            questionSet: { type: QuestionSetType.COMPREHENSIVE },
          },
          {
            attemptType: AttemptType.RETAKE,
            questionSet: { type: QuestionSetType.RETAKE },
          },
        ],
      },
      select: {
        studentId: true,
        attemptType: true,
        score: true,
        percentage: true,
        passed: true,
        submittedAt: true,
      },
      orderBy: [{ submittedAt: "asc" }],
    }),
  ]);

  const attemptsByStudent = new Map<string, typeof submittedAttempts>();
  for (const attempt of submittedAttempts) {
    if (!attempt.submittedAt) continue;
    const list = attemptsByStudent.get(attempt.studentId) ?? [];
    list.push(attempt);
    attemptsByStudent.set(attempt.studentId, list);
  }

  const rosterStudents: ExamResultsStudent[] = [];

  for (const student of students) {
    if (isIncomingYearOne(student.yearLevel)) continue;

    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const firstComprehensiveAttempts = studentAttempts.filter(
      (attempt) => attempt.attemptType === AttemptType.FIRST
    );
    if (firstComprehensiveAttempts.length === 0) continue;

    const latestFirstComprehensive = firstComprehensiveAttempts.reduce((latest, attempt) =>
      attempt.submittedAt! > latest.submittedAt! ? attempt : latest
    );

    const retakeAttempts = studentAttempts.filter(
      (attempt) => attempt.attemptType === AttemptType.RETAKE
    );
    const latestRetake =
      retakeAttempts.length > 0
        ? retakeAttempts.reduce((latest, attempt) =>
            attempt.submittedAt! > latest.submittedAt! ? attempt : latest
          )
        : null;

    const baseRow = {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      name: formatFullName(student.firstName, student.lastName),
      email: student.email,
      yearLevel: student.yearLevel,
      programCourse: student.programCourse,
    };

    if (category === "passed") {
      if (latestFirstComprehensive.passed === true) {
        rosterStudents.push({
          ...baseRow,
          outcome: "first_take",
          passingScore: latestFirstComprehensive.score,
          passingPercentage: latestFirstComprehensive.percentage,
          passedAt: latestFirstComprehensive.submittedAt?.toISOString() ?? null,
        });
        continue;
      }

      const passingRetake = [...retakeAttempts]
        .reverse()
        .find((attempt) => attempt.passed === true);
      if (!passingRetake) continue;

      rosterStudents.push({
        ...baseRow,
        outcome: "retake",
        passingScore: passingRetake.score,
        passingPercentage: passingRetake.percentage,
        passedAt: passingRetake.submittedAt?.toISOString() ?? null,
        firstAttemptScore: latestFirstComprehensive.score,
        firstAttemptPercentage: latestFirstComprehensive.percentage,
        firstAttemptSubmittedAt: latestFirstComprehensive.submittedAt?.toISOString() ?? null,
      });
      continue;
    }

    if (!latestRetake || latestRetake.passed !== false) continue;
    if (latestFirstComprehensive.passed !== false) continue;

    rosterStudents.push({
      ...baseRow,
      firstAttemptScore: latestFirstComprehensive.score,
      firstAttemptPercentage: latestFirstComprehensive.percentage,
      firstAttemptSubmittedAt: latestFirstComprehensive.submittedAt?.toISOString() ?? null,
      retakeScore: latestRetake.score,
      retakePercentage: latestRetake.percentage,
      retakeSubmittedAt: latestRetake.submittedAt?.toISOString() ?? null,
    });
  }

  rosterStudents.sort(sortStudents);

  const assessedCount = [...attemptsByStudent.keys()].filter((studentId) => {
    const student = students.find((row) => row.id === studentId);
    return student && !isIncomingYearOne(student.yearLevel);
  }).length;

  return {
    category,
    examYear: effectiveExamYear,
    studentsInScope: students.filter((student) => !isIncomingYearOne(student.yearLevel)).length,
    assessedCount,
    count: rosterStudents.length,
    students: rosterStudents,
  };
}
