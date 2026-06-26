import { QuestionSetType } from "@prisma/client";
import { maxYearLevelForProgram } from "./yearLevel.js";

export type MilestoneKind = "diagnostic" | "comprehensive";

export interface MilestoneDef {
  yearLevel: number;
  kind: MilestoneKind;
  label: string;
}

const FOUR_YEAR_MILESTONES: MilestoneDef[] = [
  { yearLevel: 1, kind: "diagnostic", label: "Incoming Y1 — Diagnostic" },
  { yearLevel: 2, kind: "comprehensive", label: "Incoming Y2 — Comprehensive" },
  { yearLevel: 3, kind: "comprehensive", label: "Incoming Y3 — Comprehensive" },
  { yearLevel: 4, kind: "comprehensive", label: "Incoming Y4 — Comprehensive" },
];

const ARCHITECTURE_Y5_MILESTONE: MilestoneDef = {
  yearLevel: 5,
  kind: "comprehensive",
  label: "Incoming Y5 — Comprehensive",
};

/** Default four-year milestone track (IT, CE, ME, EE). */
export const STUDENT_MILESTONES: MilestoneDef[] = FOUR_YEAR_MILESTONES;

export function studentMilestonesForProgram(programCourse?: string | null) {
  const milestones = [...FOUR_YEAR_MILESTONES];
  if (maxYearLevelForProgram(programCourse) > FOUR_YEAR_MILESTONES.length) {
    milestones.push(ARCHITECTURE_Y5_MILESTONE);
  }
  return milestones;
}

/** Milestone columns for cohort trends when multiple programs are in scope. */
export function studentMilestonesForTrendsScope(
  programCourse?: string | null,
  students?: Array<{ programCourse: string | null }>
) {
  if (programCourse) return studentMilestonesForProgram(programCourse);
  const hasArchitecture = students?.some((student) => student.programCourse === "ARCHITECTURE");
  return hasArchitecture
    ? studentMilestonesForProgram("ARCHITECTURE")
    : studentMilestonesForProgram(null);
}

export type MilestoneAttemptRow = {
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date;
  attemptType: string;
  questionSet: { yearLevel: number; type: QuestionSetType };
};

export function matchesMilestone(attempt: MilestoneAttemptRow, milestone: MilestoneDef) {
  if (attempt.questionSet.yearLevel !== milestone.yearLevel) return false;
  if (milestone.kind === "diagnostic") {
    return attempt.questionSet.type === QuestionSetType.DIAGNOSTIC;
  }
  return (
    attempt.questionSet.type === QuestionSetType.COMPREHENSIVE ||
    attempt.questionSet.type === QuestionSetType.RETAKE
  );
}

export function pickMilestoneAttempt(attempts: MilestoneAttemptRow[], milestone: MilestoneDef) {
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

export function inferIntakeYear(
  attempts: MilestoneAttemptRow[],
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

export function buildMilestoneMap(
  attempts: MilestoneAttemptRow[],
  programCourse?: string | null
) {
  const milestoneMap = new Map<number, MilestoneAttemptRow>();
  for (const milestone of studentMilestonesForProgram(programCourse)) {
    const picked = pickMilestoneAttempt(attempts, milestone);
    if (picked) milestoneMap.set(milestone.yearLevel, picked);
  }
  return milestoneMap;
}
