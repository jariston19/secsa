import { AttemptType, QuestionSetType } from "@prisma/client";
import { MIN_YEAR_LEVEL } from "./yearLevel.js";

export const MAX_RETAKES = 1;

export type ExamNextAction =
  | "take_comprehensive"
  | "take_incoming_diagnostic"
  | "take_retake"
  | "take_preboard"
  | "wait_approval"
  | "completed"
  | "resume_exam";

export type StudentExamAttemptRow = {
  attemptType: AttemptType;
  passed: boolean | null;
  submittedAt: Date | null;
  questionSet: { type: QuestionSetType };
};

export type FirstTakeRosterStatus = "not_started" | "in_progress";
export type RetakePipelineRosterStatus = "waiting_approval" | "ready_to_retake" | "in_progress";

export function resolveExamNextAction(params: {
  yearLevel: number;
  inProgressAttempt: StudentExamAttemptRow | null;
  attempts: StudentExamAttemptRow[];
  approvedRetakes: number;
  incomingDiagnosticAvailable?: boolean;
  maxRetakes?: number;
}): ExamNextAction {
  const {
    yearLevel,
    inProgressAttempt,
    attempts,
    approvedRetakes,
    incomingDiagnosticAvailable = false,
    maxRetakes = MAX_RETAKES,
  } = params;

  const firstComprehensiveAttempts = attempts.filter(
    (attempt) =>
      attempt.attemptType === AttemptType.FIRST &&
      attempt.questionSet.type === QuestionSetType.COMPREHENSIVE
  );
  const retakeAttempts = attempts.filter((attempt) => attempt.attemptType === AttemptType.RETAKE);
  const latest = attempts[attempts.length - 1];

  if (inProgressAttempt) {
    return "resume_exam";
  }
  if (incomingDiagnosticAvailable) {
    return "take_incoming_diagnostic";
  }
  if (yearLevel === MIN_YEAR_LEVEL) {
    return "completed";
  }
  if (firstComprehensiveAttempts.length === 0) {
    return "take_comprehensive";
  }
  if (latest?.passed) {
    return "completed";
  }
  if (retakeAttempts.length >= maxRetakes) {
    return "completed";
  }
  if (approvedRetakes > retakeAttempts.length) {
    return "take_retake";
  }
  return "wait_approval";
}

export function mapNextActionToRetakePipelineStatus(
  nextAction: ExamNextAction
): RetakePipelineRosterStatus | null {
  if (nextAction === "wait_approval") return "waiting_approval";
  if (nextAction === "take_retake") return "ready_to_retake";
  if (nextAction === "resume_exam") return "in_progress";
  return null;
}

export function isRetakeInProgress(inProgressAttempt: StudentExamAttemptRow | null) {
  return (
    inProgressAttempt != null &&
    inProgressAttempt.questionSet.type === QuestionSetType.RETAKE
  );
}

export function isComprehensiveFirstInProgress(inProgressAttempt: StudentExamAttemptRow | null) {
  return (
    inProgressAttempt != null &&
    inProgressAttempt.attemptType === AttemptType.FIRST &&
    inProgressAttempt.questionSet.type === QuestionSetType.COMPREHENSIVE
  );
}

export function isDiagnosticInProgress(inProgressAttempt: StudentExamAttemptRow | null) {
  return (
    inProgressAttempt != null &&
    inProgressAttempt.questionSet.type === QuestionSetType.DIAGNOSTIC
  );
}
