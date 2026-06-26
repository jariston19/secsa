import type { FastifyInstance } from "fastify";
import {
  ApprovalStatus,
  AttemptType,
  QuestionSetStatus,
  QuestionSetType,
  Role,
} from "@prisma/client";
import { z } from "zod";
import { buildDiagnosticStudentProfile, buildStudentExamProfile } from "../lib/diagnosticStudentProfile.js";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { calculateResult, prepareAttemptExamQuestions } from "../services/examGenerator.js";
import {
  createExamAttemptIfNoneInProgress,
  findInProgressAttempt,
  type InProgressExamAttempt,
} from "../services/inProgressExam.js";
import { maxYearLevelForProgram, MIN_YEAR_LEVEL, yearLevelSchema } from "../lib/yearLevel.js";
import {
  findDeployedIncomingDiagnostic,
  findDeployedIncomingDiagnosticWithConfigs,
  incomingDiagnosticAttemptFilter,
} from "../lib/incomingDiagnostic.js";
import { isPreboardQuestionSetType, preboardStudentYearForProgram } from "../lib/questionSetType.js";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOption: z.enum(["A", "B", "C", "D"]).optional(),
      timeSpentSeconds: z.number().int().min(0).optional(),
    })
  ),
  focusWarningCount: z.number().int().min(0).optional(),
});

const focusWarningSchema = z.object({
  count: z.number().int().min(0),
});

const saveAnswerSchema = z.object({
  selectedOption: z.enum(["A", "B", "C", "D"]),
  timeSpentSeconds: z.number().int().min(1),
});

const startExamSchema = z.object({
  examYearLevel: yearLevelSchema.optional(),
  examKind: z.enum(["comprehensive", "incoming_diagnostic", "preboard"]).optional(),
});

const MAX_RETAKES = 2;

type StudentAttemptRow = {
  id: string;
  submittedAt: Date | null;
  questionSet: { type: QuestionSetType };
};

function hasSubmittedPreboard(attempts: StudentAttemptRow[]) {
  return attempts.some(
    (attempt) => attempt.submittedAt && isPreboardQuestionSetType(attempt.questionSet.type)
  );
}

function finishedComprehensiveTrack(attempts: StudentAttemptRow[]) {
  return attempts.some(
    (attempt) =>
      attempt.submittedAt &&
      (attempt.questionSet.type === QuestionSetType.COMPREHENSIVE ||
        attempt.questionSet.type === QuestionSetType.RETAKE)
  );
}

function preboardAvailableForStudent(
  studentYearLevel: number,
  programCourse: string,
  preboardSet: { id: string } | null,
  attempts: StudentAttemptRow[]
) {
  return (
    studentYearLevel === preboardStudentYearForProgram(programCourse) &&
    Boolean(preboardSet) &&
    finishedComprehensiveTrack(attempts) &&
    !hasSubmittedPreboard(attempts)
  );
}

function hasProgressedPastDiagnostic(attempts: StudentAttemptRow[]) {
  return attempts.some(
    (attempt) =>
      attempt.submittedAt &&
      (attempt.questionSet.type === QuestionSetType.COMPREHENSIVE ||
        attempt.questionSet.type === QuestionSetType.RETAKE)
  );
}

function diagnosticProfileMeta(attempts: StudentAttemptRow[]) {
  const diagnosticAttempts = attempts.filter(
    (attempt) => attempt.questionSet.type === QuestionSetType.DIAGNOSTIC && attempt.submittedAt
  );
  const latestDiagnostic = diagnosticAttempts.at(-1) ?? null;
  const showDiagnosticProfile =
    Boolean(latestDiagnostic) && !hasProgressedPastDiagnostic(attempts);

  return {
    showDiagnosticProfile,
    diagnosticAttemptId: showDiagnosticProfile ? latestDiagnostic?.id ?? null : null,
  };
}

function comprehensiveProfileMeta(attempts: StudentAttemptRow[]) {
  const evaluationAttempts = attempts.filter(
    (attempt) =>
      attempt.submittedAt &&
      (attempt.questionSet.type === QuestionSetType.COMPREHENSIVE ||
        attempt.questionSet.type === QuestionSetType.RETAKE)
  );
  const latestEvaluation = evaluationAttempts.at(-1) ?? null;

  return {
    showComprehensiveProfile: Boolean(latestEvaluation),
    comprehensiveAttemptId: latestEvaluation?.id ?? null,
  };
}

async function getStudentProfile(userId: string) {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, yearLevel: true, programCourse: true, qaUnlimited: true },
  });

  if (!student) {
    throw Object.assign(new Error("Student not found."), { statusCode: 404 });
  }

  return student;
}

async function getQaExamOptions(programCourse: string) {
  const [diagnosticSet, comprehensiveSets] = await Promise.all([
    findDeployedIncomingDiagnostic(),
    prisma.questionSet.findMany({
      where: {
        status: QuestionSetStatus.DEPLOYED,
        programCourse,
        type: QuestionSetType.COMPREHENSIVE,
      },
      orderBy: [{ yearLevel: "asc" }, { type: "asc" }],
      select: { yearLevel: true, name: true, type: true },
    }),
  ]);

  const comprehensiveByYear = new Map(
    comprehensiveSets.map((set) => [set.yearLevel, set.name])
  );

  const maxYearLevel = maxYearLevelForProgram(programCourse);
  return Array.from({ length: maxYearLevel - MIN_YEAR_LEVEL + 1 }, (_, i) => {
    const yearLevel = MIN_YEAR_LEVEL + i;

    if (yearLevel === MIN_YEAR_LEVEL) {
      return {
        yearLevel,
        setName: diagnosticSet?.name ?? null,
        deployed: Boolean(diagnosticSet),
        examKind: "incoming_diagnostic" as const,
      };
    }

    const setName = comprehensiveByYear.get(yearLevel) ?? null;
    return {
      yearLevel,
      setName,
      deployed: Boolean(setName),
      examKind: "comprehensive" as const,
    };
  });
}

function parseQaExamYear(
  student: { yearLevel: number | null; qaUnlimited: boolean },
  value: unknown
) {
  if (!student.qaUnlimited) {
    return student.yearLevel!;
  }

  if (value == null || value === "") {
    return student.yearLevel ?? MIN_YEAR_LEVEL;
  }

  return yearLevelSchema.parse(Number(value));
}

export async function examRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/status", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const student = await getStudentProfile(user.id);

    if (!student.yearLevel) {
      return reply.code(400).send({ error: "Student year level is not set." });
    }

    if (!student.programCourse) {
      return reply.code(400).send({ error: "Student program course is not set." });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      include: { questionSet: true, retakeRequest: true },
      orderBy: { createdAt: "asc" },
    });

    const inProgressAttempt = await findInProgressAttempt(user.id);

    const comprehensiveSet = await prisma.questionSet.findFirst({
      where: {
        yearLevel: student.yearLevel,
        programCourse: student.programCourse,
        type: QuestionSetType.COMPREHENSIVE,
        status: QuestionSetStatus.DEPLOYED,
      },
    });

    const incomingDiagnosticSet =
      student.yearLevel === MIN_YEAR_LEVEL ? await findDeployedIncomingDiagnostic() : null;

    const retakeSet = await prisma.questionSet.findFirst({
      where: {
        yearLevel: student.yearLevel,
        programCourse: student.programCourse,
        type: QuestionSetType.RETAKE,
        status: QuestionSetStatus.DEPLOYED,
      },
    });

    const preboardSet =
      student.yearLevel === preboardStudentYearForProgram(student.programCourse)
        ? await prisma.questionSet.findFirst({
            where: {
              yearLevel: student.yearLevel,
              programCourse: student.programCourse,
              type: QuestionSetType.PREBOARD,
              status: QuestionSetStatus.DEPLOYED,
            },
          })
        : null;

    if (student.qaUnlimited) {
      const query = request.query as { examYearLevel?: string };
      const examYearLevel = parseQaExamYear(student, query.examYearLevel);
      const qaExamOptions = await getQaExamOptions(student.programCourse);

      const qaDiagnosticSet =
        examYearLevel === MIN_YEAR_LEVEL ? await findDeployedIncomingDiagnostic() : null;

      const qaComprehensiveSet =
        examYearLevel !== MIN_YEAR_LEVEL
          ? await prisma.questionSet.findFirst({
              where: {
                yearLevel: examYearLevel,
                programCourse: student.programCourse,
                type: QuestionSetType.COMPREHENSIVE,
                status: QuestionSetStatus.DEPLOYED,
              },
            })
          : null;

      const qaRetakeSet =
        examYearLevel !== MIN_YEAR_LEVEL
          ? await prisma.questionSet.findFirst({
              where: {
                yearLevel: examYearLevel,
                programCourse: student.programCourse,
                type: QuestionSetType.RETAKE,
                status: QuestionSetStatus.DEPLOYED,
              },
            })
          : null;

      const activeSet = qaDiagnosticSet ?? qaComprehensiveSet;
      const qaNextAction = inProgressAttempt
        ? "resume_exam"
        : qaDiagnosticSet
          ? "take_incoming_diagnostic"
          : qaComprehensiveSet
            ? "take_comprehensive"
            : "completed";
      const examTimeLimitMinutes = nextActionSetTimeLimit(qaNextAction, {
        incomingDiagnostic: qaDiagnosticSet,
        comprehensive: qaComprehensiveSet,
        retake: qaRetakeSet,
        preboard: null,
        inProgress: inProgressAttempt,
      });

      return {
        yearLevel: student.yearLevel,
        programCourse: student.programCourse,
        examYearLevel,
        attempts,
        nextAction: qaNextAction,
        inProgressAttemptId: inProgressAttempt?.id ?? null,
        comprehensiveAvailable: Boolean(qaComprehensiveSet),
        incomingDiagnosticAvailable: Boolean(qaDiagnosticSet),
        retakeAvailable: Boolean(qaRetakeSet),
        retakesUsed: attempts.filter((a) => a.attemptType === AttemptType.RETAKE).length,
        retakesRemaining: null,
        qaMode: true,
        usingSetYearLevel: activeSet?.yearLevel ?? examYearLevel,
        usingSetName: activeSet?.name ?? null,
        qaExamOptions,
        examTimeLimitMinutes,
        diagnosticTimeLimitMinutes: qaDiagnosticSet?.timeLimitMinutes ?? null,
        comprehensiveTimeLimitMinutes: qaComprehensiveSet?.timeLimitMinutes ?? null,
        retakeTimeLimitMinutes: qaRetakeSet?.timeLimitMinutes ?? null,
        diagnosticPassThreshold: qaDiagnosticSet?.passThreshold ?? null,
        comprehensivePassThreshold: qaComprehensiveSet?.passThreshold ?? null,
        retakePassThreshold: qaRetakeSet?.passThreshold ?? null,
        ...diagnosticProfileMeta(attempts),
        ...comprehensiveProfileMeta(attempts),
      };
    }

    const firstComprehensiveAttempts = attempts.filter(
      (a) =>
        a.attemptType === AttemptType.FIRST &&
        a.questionSet.type === QuestionSetType.COMPREHENSIVE
    );
    const retakeAttempts = attempts.filter((a) => a.attemptType === AttemptType.RETAKE);
    const submittedIncomingDiagnosticAttempts = attempts.filter(
      (a) => a.questionSet.type === QuestionSetType.DIAGNOSTIC && a.submittedAt
    );
    const latest = attempts[attempts.length - 1];

    const approvedRetakes = await prisma.retakeApproval.count({
      where: { studentId: user.id, status: ApprovalStatus.APPROVED },
    });

    const incomingDiagnosticAvailable =
      !inProgressAttempt &&
      student.yearLevel === MIN_YEAR_LEVEL &&
      Boolean(incomingDiagnosticSet) &&
      submittedIncomingDiagnosticAttempts.length === 0;

    let nextAction:
      | "take_comprehensive"
      | "take_incoming_diagnostic"
      | "take_retake"
      | "take_preboard"
      | "wait_approval"
      | "completed"
      | "resume_exam" = "take_comprehensive";

    if (inProgressAttempt) {
      nextAction = "resume_exam";
    } else if (incomingDiagnosticAvailable) {
      nextAction = "take_incoming_diagnostic";
    } else if (student.yearLevel === MIN_YEAR_LEVEL) {
      nextAction = "completed";
    } else if (firstComprehensiveAttempts.length === 0) {
      nextAction = "take_comprehensive";
    } else if (latest?.passed) {
      if (preboardAvailableForStudent(student.yearLevel, student.programCourse, preboardSet, attempts)) {
        nextAction = "take_preboard";
      } else {
        nextAction = "completed";
      }
    } else if (retakeAttempts.length >= MAX_RETAKES) {
      if (preboardAvailableForStudent(student.yearLevel, student.programCourse, preboardSet, attempts)) {
        nextAction = "take_preboard";
      } else {
        nextAction = "completed";
      }
    } else if (approvedRetakes > retakeAttempts.length) {
      nextAction = "take_retake";
    } else {
      nextAction = "wait_approval";
    }

    const examTimeLimitMinutes = nextActionSetTimeLimit(nextAction, {
      incomingDiagnostic: incomingDiagnosticSet,
      comprehensive: comprehensiveSet,
      retake: retakeSet,
      preboard: preboardSet,
      inProgress: inProgressAttempt,
    });

    return {
      yearLevel: student.yearLevel,
      programCourse: student.programCourse,
      attempts,
      nextAction,
      inProgressAttemptId: inProgressAttempt?.id ?? null,
      comprehensiveAvailable:
        student.yearLevel !== MIN_YEAR_LEVEL && Boolean(comprehensiveSet),
      incomingDiagnosticAvailable,
      retakeAvailable:
        student.yearLevel !== MIN_YEAR_LEVEL && Boolean(retakeSet),
      preboardAvailable: preboardAvailableForStudent(
        student.yearLevel,
        student.programCourse,
        preboardSet,
        attempts
      ),
      retakesUsed: retakeAttempts.length,
      retakesRemaining: Math.max(0, MAX_RETAKES - retakeAttempts.length),
      qaMode: false,
      examTimeLimitMinutes,
      diagnosticTimeLimitMinutes: incomingDiagnosticSet?.timeLimitMinutes ?? null,
      comprehensiveTimeLimitMinutes: comprehensiveSet?.timeLimitMinutes ?? null,
      retakeTimeLimitMinutes: retakeSet?.timeLimitMinutes ?? null,
      preboardTimeLimitMinutes: preboardSet?.timeLimitMinutes ?? null,
      diagnosticPassThreshold: incomingDiagnosticSet?.passThreshold ?? null,
      comprehensivePassThreshold: comprehensiveSet?.passThreshold ?? null,
      retakePassThreshold: retakeSet?.passThreshold ?? null,
      preboardPassThreshold: preboardSet?.passThreshold ?? null,
      ...diagnosticProfileMeta(attempts),
      ...comprehensiveProfileMeta(attempts),
    };
  });

  app.get("/diagnostic-profile", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      include: { questionSet: true },
      orderBy: { createdAt: "asc" },
    });

    const { diagnosticAttemptId } = diagnosticProfileMeta(attempts);
    if (!diagnosticAttemptId) {
      return reply.code(404).send({ error: "Diagnostic profile not available." });
    }

    const profile = await buildDiagnosticStudentProfile(diagnosticAttemptId);
    return { profile, attemptId: diagnosticAttemptId };
  });

  app.get("/comprehensive-profile", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      include: { questionSet: true },
      orderBy: { createdAt: "asc" },
    });

    const { comprehensiveAttemptId } = comprehensiveProfileMeta(attempts);
    if (!comprehensiveAttemptId) {
      return reply.code(404).send({ error: "Comprehensive evaluation not available." });
    }

    const profile = await buildStudentExamProfile(comprehensiveAttemptId, "comprehensive");
    return { profile, attemptId: comprehensiveAttemptId };
  });

  app.post("/start", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const student = await getStudentProfile(user.id);

    if (!student.yearLevel) {
      return reply.code(400).send({ error: "Student year level is not set." });
    }

    if (!student.programCourse) {
      return reply.code(400).send({ error: "Student program course is not set." });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      include: { questionSet: true },
      orderBy: { createdAt: "asc" },
    });

    const inProgress = await findInProgressAttempt(user.id);

    if (inProgress) {
      return reply.send(await buildResumeExamStartResponse(inProgress));
    }

    if (student.qaUnlimited) {
      const body = startExamSchema.parse(request.body ?? {});
      const examYearLevel = parseQaExamYear(student, body.examYearLevel);

      if (examYearLevel === MIN_YEAR_LEVEL || body.examKind === "incoming_diagnostic") {
        const diagnosticSet = await findDeployedIncomingDiagnosticWithConfigs();

        if (!diagnosticSet) {
          return reply.code(404).send({
            error: "No deployed incoming diagnostic set.",
          });
        }

        const submittedDiagnosticAttempts = attempts.filter((a) => a.submittedAt);
        const attemptNumber = submittedDiagnosticAttempts.length + 1;
        const examStart = await startNewExamAttempt({
          userId: user.id,
          questionSet: diagnosticSet,
          attemptType: AttemptType.FIRST,
          attemptNumber,
        });

        if (examStart.type === "resume") {
          return reply.send(await buildResumeExamStartResponse(examStart.attempt));
        }

        return reply.code(201).send(
          buildExamStartResponse({
            attempt: examStart.attempt,
            questions: examStart.questions.map(stripCorrectAnswer),
            savedAnswers: [],
            resumeIndex: 0,
            timeLimitMinutes: examStart.timeLimitMinutes,
          })
        );
      }

      const questionSet = await prisma.questionSet.findFirst({
        where: {
          yearLevel: examYearLevel,
          programCourse: student.programCourse,
          type: QuestionSetType.COMPREHENSIVE,
          status: QuestionSetStatus.DEPLOYED,
        },
        include: { configs: true },
      });

      if (!questionSet) {
        return reply.code(404).send({
          error: `No deployed comprehensive set for year level ${examYearLevel}.`,
        });
      }

      const submittedAttempts = attempts.filter((a) => a.submittedAt);
      const attemptNumber = submittedAttempts.length + 1;
      const attemptType = submittedAttempts.length === 0 ? AttemptType.FIRST : AttemptType.RETAKE;

      const examStart = await startNewExamAttempt({
        userId: user.id,
        questionSet,
        attemptType,
        attemptNumber,
      });

      if (examStart.type === "resume") {
        return reply.send(await buildResumeExamStartResponse(examStart.attempt));
      }

      return reply.code(201).send(
        buildExamStartResponse({
          attempt: examStart.attempt,
          questions: examStart.questions.map(stripCorrectAnswer),
          savedAnswers: [],
          resumeIndex: 0,
          timeLimitMinutes: examStart.timeLimitMinutes,
        })
      );
    }

    const body = startExamSchema.parse(request.body ?? {});

    if (body.examKind === "incoming_diagnostic") {
      if (student.yearLevel !== MIN_YEAR_LEVEL) {
        return reply.code(403).send({
          error: "Incoming diagnostic exams are only for 1st-year students.",
        });
      }

      const existingIncoming = await prisma.examAttempt.findFirst({
        where: {
          studentId: user.id,
          submittedAt: { not: null },
          questionSet: {
            type: QuestionSetType.DIAGNOSTIC,
            yearLevel: MIN_YEAR_LEVEL,
          },
        },
      });

      if (existingIncoming) {
        return reply.code(403).send({ error: "Incoming diagnostic exam already completed." });
      }

      const questionSet = await findDeployedIncomingDiagnosticWithConfigs();

      if (!questionSet) {
        return reply.code(404).send({
          error: "No deployed incoming diagnostic set.",
        });
      }

      const priorIncomingAttempts = await prisma.examAttempt.count({
        where: {
          studentId: user.id,
          ...incomingDiagnosticAttemptFilter(),
        },
      });

      const examStart = await startNewExamAttempt({
        userId: user.id,
        questionSet,
        attemptType: AttemptType.FIRST,
        attemptNumber: priorIncomingAttempts + 1,
      });

      if (examStart.type === "resume") {
        return reply.send(await buildResumeExamStartResponse(examStart.attempt));
      }

      return reply.code(201).send(
        buildExamStartResponse({
          attempt: examStart.attempt,
          questions: examStart.questions.map(stripCorrectAnswer),
          savedAnswers: [],
          resumeIndex: 0,
          timeLimitMinutes: examStart.timeLimitMinutes,
        })
      );
    }

    if (body.examKind === "preboard") {
      const preboardYear = preboardStudentYearForProgram(student.programCourse);
      if (student.yearLevel !== preboardYear) {
        return reply.code(403).send({
          error: `Preboard exams are only for incoming year ${preboardYear} students in your program.`,
        });
      }

      if (!finishedComprehensiveTrack(attempts)) {
        return reply.code(403).send({
          error: "Complete your comprehensive exam before taking the preboard.",
        });
      }

      if (hasSubmittedPreboard(attempts)) {
        return reply.code(403).send({ error: "Preboard exam already completed." });
      }

      const questionSet = await prisma.questionSet.findFirst({
        where: {
          yearLevel: preboardYear,
          programCourse: student.programCourse,
          type: QuestionSetType.PREBOARD,
          status: QuestionSetStatus.DEPLOYED,
        },
        include: { configs: true },
      });

      if (!questionSet) {
        return reply.code(404).send({ error: "No deployed preboard set for your program course." });
      }

      const priorPreboardAttempts = await prisma.examAttempt.count({
        where: {
          studentId: user.id,
          questionSet: { type: QuestionSetType.PREBOARD },
        },
      });

      const examStart = await startNewExamAttempt({
        userId: user.id,
        questionSet,
        attemptType: AttemptType.FIRST,
        attemptNumber: priorPreboardAttempts + 1,
      });

      if (examStart.type === "resume") {
        return reply.send(await buildResumeExamStartResponse(examStart.attempt));
      }

      return reply.code(201).send(
        buildExamStartResponse({
          attempt: examStart.attempt,
          questions: examStart.questions.map(stripCorrectAnswer),
          savedAnswers: [],
          resumeIndex: 0,
          timeLimitMinutes: examStart.timeLimitMinutes,
        })
      );
    }

    if (student.yearLevel === MIN_YEAR_LEVEL) {
      return reply.code(403).send({
        error: "Incoming 1st-year students take the diagnostic exam only.",
      });
    }

    const firstComprehensiveCount = await prisma.examAttempt.count({
      where: {
        studentId: user.id,
        attemptType: AttemptType.FIRST,
        questionSet: { type: QuestionSetType.COMPREHENSIVE },
      },
    });
    const retakeCount = attempts.filter((a) => a.attemptType === AttemptType.RETAKE).length;

    let setType: QuestionSetType = QuestionSetType.COMPREHENSIVE;
    let attemptType: AttemptType = AttemptType.FIRST;
    let attemptNumber = 1;

    if (firstComprehensiveCount === 0) {
      setType = QuestionSetType.COMPREHENSIVE;
      attemptType = AttemptType.FIRST;
      attemptNumber = 1;
    } else if (retakeCount < MAX_RETAKES) {
      const approvedCount = await prisma.retakeApproval.count({
        where: { studentId: user.id, status: ApprovalStatus.APPROVED },
      });

      if (approvedCount <= retakeCount) {
        return reply.code(403).send({ error: "Retake not approved yet." });
      }

      setType = QuestionSetType.RETAKE;
      attemptType = AttemptType.RETAKE;
      attemptNumber = retakeCount + 2;
    } else {
      return reply.code(403).send({ error: "No remaining exam attempts." });
    }

    const questionSet = await prisma.questionSet.findFirst({
      where: {
        yearLevel: student.yearLevel,
        programCourse: student.programCourse,
        type: setType,
        status: QuestionSetStatus.DEPLOYED,
      },
      include: { configs: true },
    });

    if (!questionSet) {
      return reply.code(404).send({ error: `No deployed ${setType.toLowerCase()} set for this year level.` });
    }

    const examStart = await startNewExamAttempt({
      userId: user.id,
      questionSet,
      attemptType,
      attemptNumber,
    });

    if (examStart.type === "resume") {
      return reply.send(await buildResumeExamStartResponse(examStart.attempt));
    }

    return reply.code(201).send(
      buildExamStartResponse({
        attempt: examStart.attempt,
        questions: examStart.questions.map(stripCorrectAnswer),
        savedAnswers: [],
        resumeIndex: 0,
        timeLimitMinutes: examStart.timeLimitMinutes,
      })
    );
  });

  app.patch("/:attemptId/answers/:questionId", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const { attemptId, questionId } = request.params as {
      attemptId: string;
      questionId: string;
    };
    const body = saveAnswerSchema.parse(request.body);

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          where: { questionId },
          include: { question: true },
        },
      },
    });

    if (!attempt || attempt.studentId !== user.id) {
      return reply.code(404).send({ error: "Attempt not found." });
    }

    if (attempt.submittedAt) {
      return reply.code(400).send({ error: "Attempt already submitted." });
    }

    const existing = attempt.answers[0];
    if (!existing) {
      return reply.code(404).send({ error: "Question not part of this attempt." });
    }

    const answerChangeCount =
      existing.selectedOption && existing.selectedOption !== body.selectedOption
        ? existing.answerChangeCount + 1
        : existing.answerChangeCount;

    const updated = await prisma.examAnswer.update({
      where: { id: existing.id },
      data: {
        selectedOption: body.selectedOption,
        timeSpentSeconds: body.timeSpentSeconds,
        answerChangeCount,
      },
      select: {
        questionId: true,
        selectedOption: true,
        timeSpentSeconds: true,
        answerChangeCount: true,
      },
    });

    return { answer: updated };
  });

  app.patch("/:attemptId/focus-warnings", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const { attemptId } = request.params as { attemptId: string };
    const body = focusWarningSchema.parse(request.body);

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, studentId: true, submittedAt: true },
    });

    if (!attempt || attempt.studentId !== user.id) {
      return reply.code(404).send({ error: "Attempt not found." });
    }

    if (attempt.submittedAt) {
      return reply.code(400).send({ error: "Attempt already submitted." });
    }

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { focusWarningCount: body.count },
      select: { id: true, focusWarningCount: true },
    });

    return { attempt: updated };
  });

  app.post("/:attemptId/submit", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    const { attemptId } = request.params as { attemptId: string };
    const body = submitSchema.parse(request.body);

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        questionSet: true,
        answers: { include: { question: true } },
      },
    });

    if (!attempt || attempt.studentId !== user.id) {
      return reply.code(404).send({ error: "Attempt not found." });
    }

    if (attempt.submittedAt) {
      return reply.code(400).send({ error: "Attempt already submitted." });
    }

    let score = 0;
    const answerPatches: Array<{
      id: string;
      data: {
        isCorrect: boolean;
        selectedOption?: string;
        timeSpentSeconds?: number;
      };
    }> = [];

    for (const answer of body.answers) {
      const existing = attempt.answers.find((a) => a.questionId === answer.questionId);
      if (!existing) continue;

      if (!answer.selectedOption) {
        answerPatches.push({
          id: existing.id,
          data: {
            isCorrect: false,
            timeSpentSeconds: answer.timeSpentSeconds,
          },
        });
        continue;
      }

      const isCorrect = existing.question.correctOption === answer.selectedOption;
      if (isCorrect) score += 1;

      answerPatches.push({
        id: existing.id,
        data: {
          selectedOption: answer.selectedOption,
          isCorrect,
          timeSpentSeconds: answer.timeSpentSeconds,
        },
      });
    }

    const result = calculateResult(
      score,
      attempt.totalItems,
      attempt.questionSet.passThreshold
    );

    const isComprehensiveFirst =
      attempt.questionSet.type === QuestionSetType.COMPREHENSIVE &&
      attempt.attemptType === AttemptType.FIRST;

    const student =
      !result.passed && attempt.attemptType === AttemptType.FIRST && isComprehensiveFirst
        ? await prisma.user.findUnique({
            where: { id: user.id },
            select: { qaUnlimited: true },
          })
        : null;

    const shouldCreateRetakeApproval =
      !result.passed &&
      attempt.attemptType === AttemptType.FIRST &&
      isComprehensiveFirst &&
      !student?.qaUnlimited;

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const current = await tx.examAttempt.findUnique({
          where: { id: attemptId },
          select: { submittedAt: true },
        });

        if (current?.submittedAt) {
          throw { statusCode: 400, message: "Attempt already submitted." };
        }

        for (const patch of answerPatches) {
          await tx.examAnswer.update({
            where: { id: patch.id },
            data: patch.data,
          });
        }

        const attemptRow = await tx.examAttempt.update({
          where: { id: attemptId },
          data: {
            score: result.score,
            percentage: result.percentage,
            passed: result.passed,
            submittedAt: new Date(),
            ...(body.focusWarningCount != null
              ? { focusWarningCount: body.focusWarningCount }
              : {}),
          },
        });

        if (shouldCreateRetakeApproval) {
          await tx.retakeApproval.create({
            data: {
              studentId: user.id,
              examAttemptId: attemptId,
              yearLevel: user.yearLevel!,
              status: ApprovalStatus.PENDING,
            },
          });
        }

        return attemptRow;
      });
    } catch (error) {
      const err = error as { statusCode?: number; message?: string };
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: err.message ?? "Request failed." });
      }
      throw error;
    }

    if (attempt.questionSet.type === QuestionSetType.DIAGNOSTIC) {
      const profile = await buildStudentExamProfile(attemptId, "diagnostic");
      return {
        attempt: updated,
        result: {
          kind: "diagnostic" as const,
          profile,
        },
      };
    }

    const profile = await buildStudentExamProfile(attemptId, "comprehensive");
    return {
      attempt: updated,
      result: {
        kind: "comprehensive" as const,
        ...result,
        profile,
        timedOut: false,
        focusViolationLimit: false,
      },
    };
  });

  app.get("/retakes", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const status = (request.query as { status?: ApprovalStatus }).status;
    const approvals = await prisma.retakeApproval.findMany({
      where: status ? { status } : undefined,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true, yearLevel: true } },
        examAttempt: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { approvals };
  });

  app.post("/retakes/approve-batch", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { ids } = request.body as { ids?: string[] };
    if (!ids?.length) {
      return reply.code(400).send({ error: "No approval IDs provided." });
    }

    const pending = await prisma.retakeApproval.findMany({
      where: { id: { in: ids }, status: ApprovalStatus.PENDING },
      select: { id: true },
    });

    if (pending.length === 0) {
      return reply.code(400).send({ error: "No pending approvals found for the given IDs." });
    }

    await prisma.retakeApproval.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: {
        status: ApprovalStatus.APPROVED,
        approvedById: user.id,
      },
    });

    return { approved: pending.length };
  });

  app.post("/retakes/:id/approve", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const notes = (request.body as { notes?: string })?.notes;

    const approval = await prisma.retakeApproval.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approvedById: user.id,
        notes,
      },
    });

    return { approval };
  });
}

function nextActionSetTimeLimit(
  nextAction: string,
  sets: {
    incomingDiagnostic: { timeLimitMinutes: number } | null;
    comprehensive: { timeLimitMinutes: number } | null;
    retake: { timeLimitMinutes: number } | null;
    preboard: { timeLimitMinutes: number } | null;
    inProgress: { questionSet: { timeLimitMinutes: number } } | null | undefined;
  }
) {
  if (nextAction === "resume_exam" && sets.inProgress) {
    return sets.inProgress.questionSet.timeLimitMinutes;
  }
  if (nextAction === "take_incoming_diagnostic" && sets.incomingDiagnostic) {
    return sets.incomingDiagnostic.timeLimitMinutes;
  }
  if (nextAction === "take_retake" && sets.retake) {
    return sets.retake.timeLimitMinutes;
  }
  if (nextAction === "take_preboard" && sets.preboard) {
    return sets.preboard.timeLimitMinutes;
  }
  if (sets.comprehensive) {
    return sets.comprehensive.timeLimitMinutes;
  }
  return 60;
}

type StartableQuestionSet = {
  id: string;
  examQuestionIds: string | null;
  configs: import("@prisma/client").QuestionSetConfig[];
  timeLimitMinutes: number;
};

async function startNewExamAttempt({
  userId,
  questionSet,
  attemptType,
  attemptNumber,
}: {
  userId: string;
  questionSet: StartableQuestionSet;
  attemptType: AttemptType;
  attemptNumber: number;
}) {
  const { orderedIds, questions } = await prepareAttemptExamQuestions(questionSet);
  const outcome = await createExamAttemptIfNoneInProgress(userId, async (tx) =>
    tx.examAttempt.create({
      data: {
        studentId: userId,
        questionSetId: questionSet.id,
        attemptType,
        attemptNumber,
        questionIds: JSON.stringify(orderedIds),
        totalItems: questions.length,
        answers: {
          create: orderedIds.map((questionId) => ({ questionId })),
        },
      },
    })
  );

  if (outcome.type === "resume") {
    return { type: "resume" as const, attempt: outcome.attempt };
  }

  return {
    type: "created" as const,
    attempt: outcome.result,
    questions,
    timeLimitMinutes: questionSet.timeLimitMinutes,
  };
}

function buildExamStartResponse({
  attempt,
  questions,
  savedAnswers,
  resumeIndex,
  timeLimitMinutes,
  resumed = false,
  focusWarningCount = 0,
}: {
  attempt: { id: string; startedAt: Date };
  questions: ReturnType<typeof stripCorrectAnswer>[];
  savedAnswers: Array<{
    questionId: string;
    selectedOption: string | null;
    timeSpentSeconds: number | null;
    answerChangeCount: number;
  }>;
  resumeIndex: number;
  timeLimitMinutes: number;
  resumed?: boolean;
  focusWarningCount?: number;
}) {
  return {
    attempt,
    questions,
    savedAnswers,
    resumeIndex,
    timeLimitMinutes,
    resumed,
    focusWarningCount,
  };
}

async function buildResumeExamStartResponse(attempt: InProgressExamAttempt) {
  const questions = await loadAttemptQuestions(attempt.questionIds);
  const savedAnswers = await prisma.examAnswer.findMany({
    where: { examAttemptId: attempt.id },
    select: {
      questionId: true,
      selectedOption: true,
      timeSpentSeconds: true,
      answerChangeCount: true,
    },
  });
  const questionIds = JSON.parse(attempt.questionIds) as string[];
  const resumeIndex = questionIds.findIndex(
    (id) => !savedAnswers.find((answer) => answer.questionId === id)?.selectedOption
  );

  return buildExamStartResponse({
    attempt,
    questions,
    savedAnswers,
    resumeIndex: resumeIndex === -1 ? questionIds.length - 1 : resumeIndex,
    timeLimitMinutes: attempt.questionSet.timeLimitMinutes,
    resumed: true,
    focusWarningCount: attempt.focusWarningCount,
  });
}

function stripCorrectAnswer(question: {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  imagePath: string | null;
  difficulty: string;
}) {
  return {
    id: question.id,
    text: question.text,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    imagePath: question.imagePath,
    difficulty: question.difficulty,
  };
}

async function loadAttemptQuestions(questionIdsJson: string) {
  const ids = JSON.parse(questionIdsJson) as string[];
  const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
  const map = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => stripCorrectAnswer(map.get(id)!)).filter(Boolean);
}
