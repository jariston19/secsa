import { QuestionSetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { nonQaStudentWhere } from "../lib/studentFilters.js";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/yearLevel.js";

type MilestoneKind = "diagnostic" | "comprehensive";

interface MilestoneDef {
  yearLevel: number;
  kind: MilestoneKind;
  label: string;
}

const MILESTONES: MilestoneDef[] = [
  { yearLevel: 1, kind: "diagnostic", label: "Incoming Y1 — Diagnostic" },
  { yearLevel: 2, kind: "comprehensive", label: "Incoming Y2 — Comprehensive" },
  { yearLevel: 3, kind: "comprehensive", label: "Incoming Y3 — Comprehensive" },
  { yearLevel: 4, kind: "comprehensive", label: "Incoming Y4 — Comprehensive" },
];

type AttemptRow = {
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date;
  attemptType: string;
  questionSet: { yearLevel: number; type: QuestionSetType };
};

type MilestoneSummary = {
  yearLevel: number;
  kind: MilestoneKind;
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

function matchesMilestone(attempt: AttemptRow, milestone: MilestoneDef) {
  if (attempt.questionSet.yearLevel !== milestone.yearLevel) return false;
  if (milestone.kind === "diagnostic") {
    return attempt.questionSet.type === QuestionSetType.DIAGNOSTIC;
  }
  return (
    attempt.questionSet.type === QuestionSetType.COMPREHENSIVE ||
    attempt.questionSet.type === QuestionSetType.RETAKE
  );
}

function pickMilestoneAttempt(attempts: AttemptRow[], milestone: MilestoneDef) {
  const candidates = attempts.filter((attempt) => matchesMilestone(attempt, milestone));
  if (candidates.length === 0) return null;

  if (milestone.kind === "diagnostic") {
    return [...candidates].sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    )[0];
  }

  const comprehensive = candidates.filter(
    (attempt) => attempt.questionSet.type === QuestionSetType.COMPREHENSIVE
  );
  if (comprehensive.length > 0) {
    return [...comprehensive].sort(
      (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
    )[0];
  }

  return [...candidates].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
  )[0];
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function passRate(attempts: Array<{ passed: boolean | null }>) {
  if (attempts.length === 0) return 0;
  return (attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100;
}

function inferIntakeYear(
  attempts: AttemptRow[],
  student: { createdAt: Date; yearLevel: number | null }
) {
  const diagnostic = attempts
    .filter(
      (attempt) =>
        attempt.questionSet.type === QuestionSetType.DIAGNOSTIC &&
        attempt.questionSet.yearLevel === 1
    )
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())[0];

  if (diagnostic) return diagnostic.submittedAt.getFullYear();

  const earliest = [...attempts].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
  )[0];
  if (earliest) {
    return earliest.submittedAt.getFullYear() - (earliest.questionSet.yearLevel - 1);
  }

  if (student.yearLevel) {
    return student.createdAt.getFullYear() - (student.yearLevel - 1);
  }

  return null;
}

function buildBatchJourney(
  studentMilestones: Map<string, Map<number, AttemptRow>>
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
  const milestones = MILESTONES.map((milestone) => {
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

  for (let index = 0; index < MILESTONES.length - 1; index += 1) {
    const from = MILESTONES[index];
    const to = MILESTONES[index + 1];
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
  const studentById = new Map(students.map((student) => [student.id, student]));

  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId: { in: studentIds },
      submittedAt: { not: null },
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

  const batchJourneys: BatchJourney[] = [];

  for (const [intakeYear, batchStudentIds] of [...studentsByIntake.entries()].sort(
    (a, b) => b[0] - a[0]
  )) {
    const studentMilestones = new Map<string, Map<number, AttemptRow>>();

    for (const studentId of batchStudentIds) {
      const studentAttempts = attemptsByStudent.get(studentId) ?? [];
      const milestoneMap = new Map<number, AttemptRow>();
      for (const milestone of MILESTONES) {
        const picked = pickMilestoneAttempt(studentAttempts, milestone);
        if (picked) milestoneMap.set(milestone.yearLevel, picked);
      }
      if (milestoneMap.size > 0) {
        studentMilestones.set(studentId, milestoneMap);
      }
    }

    batchJourneys.push({
      intakeYear,
      studentCount: batchStudentIds.length,
      ...buildBatchJourney(studentMilestones),
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
    yearRange: { min: MIN_YEAR_LEVEL, max: MAX_YEAR_LEVEL },
  };
}
