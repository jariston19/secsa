import { prisma } from "../lib/prisma.js";
import { submittedAtFilter } from "../lib/analyticsSeason.js";
import { nonQaStudentWhere } from "../lib/studentFilters.js";
import {
  buildMilestoneMap,
  inferIntakeYear,
  studentMilestonesForTrendsScope,
  type MilestoneDef,
  type MilestoneAttemptRow,
} from "../lib/studentMilestones.js";
import { MIN_YEAR_LEVEL } from "../lib/yearLevel.js";

type AttemptRow = MilestoneAttemptRow;

type MilestoneSummary = {
  yearLevel: number;
  kind: string;
  label: string;
  studentsAssessed: number;
  averageScore: number;
  passRate: number;
};

type TransitionSummary = {
  fromYear: number;
  toYear: number;
  fromLabel: string;
  toLabel: string;
  studentCount: number;
  avgFromScore: number;
  avgToScore: number;
  fromPassRate: number;
  toPassRate: number;
  avgDelta: number;
  improvedCount: number;
  declinedCount: number;
  stableCount: number;
};

type BatchJourney = {
  intakeYear: number;
  studentCount: number;
  milestones: MilestoneSummary[];
  transitions: TransitionSummary[];
  correlations: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    studentCount: number;
    points: Array<{ studentId: string; fromScore: number; toScore: number }>;
  }>;
};

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function passRate(attempts: Array<{ passed: boolean | null }>) {
  if (attempts.length === 0) return 0;
  return (attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100;
}

function buildBatchJourney(
  studentMilestones: Map<string, Map<number, AttemptRow>>,
  milestoneDefs: MilestoneDef[]
): Omit<BatchJourney, "intakeYear" | "studentCount"> & {
  correlations: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    studentCount: number;
    points: Array<{ studentId: string; fromScore: number; toScore: number }>;
  }>;
} {
  const milestones = milestoneDefs.map((milestone) => {
    const rows = [...studentMilestones.values()]
      .map((map) => map.get(milestone.yearLevel))
      .filter((row): row is AttemptRow => Boolean(row));

    return {
      yearLevel: milestone.yearLevel,
      kind: milestone.kind,
      label: milestone.label,
      studentsAssessed: rows.length,
      averageScore: average(rows.map((row) => row.percentage ?? 0)),
      passRate: passRate(rows),
    };
  });

  const transitions: TransitionSummary[] = [];
  const correlations: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    studentCount: number;
    points: Array<{ studentId: string; fromScore: number; toScore: number }>;
  }> = [];

  for (let index = 0; index < milestoneDefs.length - 1; index += 1) {
    const from = milestoneDefs[index];
    const to = milestoneDefs[index + 1];
    const pairs: Array<{
      studentId: string;
      fromScore: number;
      toScore: number;
      fromPassed: boolean | null;
      toPassed: boolean | null;
    }> = [];

    for (const [studentId, map] of studentMilestones.entries()) {
      const fromAttempt = map.get(from.yearLevel);
      const toAttempt = map.get(to.yearLevel);
      if (!fromAttempt || !toAttempt) continue;
      pairs.push({
        studentId,
        fromScore: fromAttempt.percentage ?? 0,
        toScore: toAttempt.percentage ?? 0,
        fromPassed: fromAttempt.passed,
        toPassed: toAttempt.passed,
      });
    }

    const deltas = pairs.map((pair) => pair.toScore - pair.fromScore);
    transitions.push({
      fromYear: from.yearLevel,
      toYear: to.yearLevel,
      fromLabel: from.label,
      toLabel: to.label,
      studentCount: pairs.length,
      avgFromScore: average(pairs.map((pair) => pair.fromScore)),
      avgToScore: average(pairs.map((pair) => pair.toScore)),
      fromPassRate: passRate(pairs.map((pair) => ({ passed: pair.fromPassed }))),
      toPassRate: passRate(pairs.map((pair) => ({ passed: pair.toPassed }))),
      avgDelta: average(deltas),
      improvedCount: deltas.filter((delta) => delta > 1).length,
      declinedCount: deltas.filter((delta) => delta < -1).length,
      stableCount: deltas.filter((delta) => Math.abs(delta) <= 1).length,
    });

    correlations.push({
      fromYear: from.yearLevel,
      toYear: to.yearLevel,
      fromLabel: from.label,
      toLabel: to.label,
      studentCount: pairs.length,
      points: pairs.map((pair) => ({
        studentId: pair.studentId,
        fromScore: pair.fromScore,
        toScore: pair.toScore,
      })),
    });
  }

  return { milestones, transitions, correlations };
}

export async function buildCohortTrends(filters: {
  programCourse?: string;
  intakeYear?: number;
  examYear?: number;
}) {
  const students = await prisma.user.findMany({
    where: nonQaStudentWhere(undefined, filters.programCourse),
    select: { id: true, yearLevel: true, programCourse: true, createdAt: true },
  });

  if (students.length === 0) {
    return {
      studentsInScope: 0,
      availableBatches: [] as Array<{ intakeYear: number; studentCount: number }>,
      batchJourneys: [] as BatchJourney[],
      selectedBatch: null as BatchJourney | null,
    };
  }

  const studentIds = students.map((student) => student.id);

  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId: { in: studentIds },
      submittedAt: submittedAtFilter(filters.examYear),
    },
    select: {
      studentId: true,
      percentage: true,
      passed: true,
      submittedAt: true,
      attemptType: true,
      questionSet: { select: { yearLevel: true, type: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const attemptsByStudent = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    if (!attempt.submittedAt) continue;
    const row: AttemptRow = {
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      attemptType: attempt.attemptType,
      questionSet: attempt.questionSet,
    };
    const list = attemptsByStudent.get(attempt.studentId) ?? [];
    list.push(row);
    attemptsByStudent.set(attempt.studentId, list);
  }

  const studentsByIntake = new Map<number, string[]>();
  for (const student of students) {
    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const intakeYear = inferIntakeYear(studentAttempts, student);
    if (intakeYear == null) continue;
    const list = studentsByIntake.get(intakeYear) ?? [];
    list.push(student.id);
    studentsByIntake.set(intakeYear, list);
  }

  const milestoneDefs = studentMilestonesForTrendsScope(filters.programCourse, students);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const batchJourneys: BatchJourney[] = [];

  for (const [intakeYear, batchStudentIds] of [...studentsByIntake.entries()].sort(
    (a, b) => b[0] - a[0]
  )) {
    const studentMilestones = new Map<string, Map<number, AttemptRow>>();

    for (const studentId of batchStudentIds) {
      const student = studentsById.get(studentId);
      const studentAttempts = attemptsByStudent.get(studentId) ?? [];
      const milestoneMap = buildMilestoneMap(studentAttempts, student?.programCourse);
      if (milestoneMap.size > 0) {
        studentMilestones.set(studentId, milestoneMap);
      }
    }

    batchJourneys.push({
      intakeYear,
      studentCount: batchStudentIds.length,
      ...buildBatchJourney(studentMilestones, milestoneDefs),
    });
  }

  const availableBatches = batchJourneys.map((batch) => ({
    intakeYear: batch.intakeYear,
    studentCount: batch.studentCount,
  }));

  const selectedBatch =
    filters.intakeYear != null
      ? (batchJourneys.find((batch) => batch.intakeYear === filters.intakeYear) ?? null)
      : null;

  return {
    studentsInScope: students.length,
    availableBatches,
    batchJourneys: filters.intakeYear != null && selectedBatch ? [selectedBatch] : batchJourneys,
    selectedBatch,
    yearRange: {
      min: MIN_YEAR_LEVEL,
      max: milestoneDefs[milestoneDefs.length - 1]?.yearLevel ?? MIN_YEAR_LEVEL,
    },
  };
}
