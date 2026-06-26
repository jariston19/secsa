import { prisma } from "../lib/prisma.js";
import {
  buildMilestoneMap,
  inferIntakeYear,
  studentMilestonesForProgram,
  type MilestoneAttemptRow,
} from "../lib/studentMilestones.js";

export async function buildStudentJourneyTrend(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, createdAt: true, yearLevel: true, programCourse: true },
  });

  if (!student) {
    return { intakeYear: null, milestones: [], transitions: [], hasJourneyData: false };
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId, submittedAt: { not: null } },
    select: {
      percentage: true,
      passed: true,
      submittedAt: true,
      attemptType: true,
      questionSet: { select: { yearLevel: true, type: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const rows: MilestoneAttemptRow[] = attempts
    .filter((attempt): attempt is typeof attempt & { submittedAt: Date } => attempt.submittedAt != null)
    .map((attempt) => ({
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      attemptType: attempt.attemptType,
      questionSet: attempt.questionSet,
    }));

  const milestoneMap = buildMilestoneMap(rows, student.programCourse);
  const intakeYear = inferIntakeYear(rows, student);
  const milestoneDefs = studentMilestonesForProgram(student.programCourse);

  const milestones = milestoneDefs.map((milestone) => {
    const attempt = milestoneMap.get(milestone.yearLevel);
    if (!attempt) {
      return {
        yearLevel: milestone.yearLevel,
        kind: milestone.kind,
        label: milestone.label,
        score: null as number | null,
        passed: null as boolean | null,
        submittedAt: null as string | null,
        hasData: false,
      };
    }

    return {
      yearLevel: milestone.yearLevel,
      kind: milestone.kind,
      label: milestone.label,
      score: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt.toISOString(),
      hasData: true,
    };
  });

  const transitions: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    fromScore: number;
    toScore: number;
    delta: number;
    direction: "improved" | "declined" | "stable";
  }> = [];

  for (let index = 0; index < milestoneDefs.length - 1; index += 1) {
    const from = milestoneDefs[index];
    const to = milestoneDefs[index + 1];
    const fromAttempt = milestoneMap.get(from.yearLevel);
    const toAttempt = milestoneMap.get(to.yearLevel);
    if (!fromAttempt || !toAttempt) continue;

    const fromScore = fromAttempt.percentage ?? 0;
    const toScore = toAttempt.percentage ?? 0;
    const delta = toScore - fromScore;
    const direction =
      delta > 1 ? ("improved" as const) : delta < -1 ? ("declined" as const) : ("stable" as const);

    transitions.push({
      fromYear: from.yearLevel,
      toYear: to.yearLevel,
      fromLabel: from.label,
      toLabel: to.label,
      fromScore,
      toScore,
      delta,
      direction,
    });
  }

  return {
    intakeYear,
    milestones,
    transitions,
    hasJourneyData: milestones.some((milestone) => milestone.hasData),
  };
}
