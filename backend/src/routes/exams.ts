import type { FastifyInstance } from "fastify";
import {
  ApprovalStatus,
  AttemptType,
  QuestionSetStatus,
  QuestionSetType,
  Role,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { calculateResult, generateExamQuestions } from "../services/examGenerator.js";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOption: z.enum(["A", "B", "C", "D"]),
    })
  ),
});

const MAX_RETAKES = 2;

export async function examRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/status", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    if (!user.yearLevel) {
      return reply.code(400).send({ error: "Student year level is not set." });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      include: { questionSet: true, retakeRequest: true },
      orderBy: { createdAt: "asc" },
    });

    const firstAttempts = attempts.filter((a) => a.attemptType === AttemptType.FIRST);
    const retakeAttempts = attempts.filter((a) => a.attemptType === AttemptType.RETAKE);
    const latest = attempts[attempts.length - 1];

    const approvedRetakes = await prisma.retakeApproval.count({
      where: { studentId: user.id, status: ApprovalStatus.APPROVED },
    });

    let nextAction: "take_diagnostic" | "take_retake" | "wait_approval" | "completed" =
      "take_diagnostic";

    if (firstAttempts.length === 0) {
      nextAction = "take_diagnostic";
    } else if (latest?.passed) {
      nextAction = "completed";
    } else if (retakeAttempts.length >= MAX_RETAKES) {
      nextAction = "completed";
    } else if (approvedRetakes > retakeAttempts.length) {
      nextAction = "take_retake";
    } else {
      nextAction = "wait_approval";
    }

    const diagnosticSet = await prisma.questionSet.findFirst({
      where: {
        yearLevel: user.yearLevel,
        type: QuestionSetType.DIAGNOSTIC,
        status: QuestionSetStatus.DEPLOYED,
      },
    });

    const retakeSet = await prisma.questionSet.findFirst({
      where: {
        yearLevel: user.yearLevel,
        type: QuestionSetType.RETAKE,
        status: QuestionSetStatus.DEPLOYED,
      },
    });

    return {
      yearLevel: user.yearLevel,
      attempts,
      nextAction,
      diagnosticAvailable: Boolean(diagnosticSet),
      retakeAvailable: Boolean(retakeSet),
      retakesUsed: retakeAttempts.length,
      retakesRemaining: Math.max(0, MAX_RETAKES - retakeAttempts.length),
    };
  });

  app.post("/start", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.STUDENT]);

    if (!user.yearLevel) {
      return reply.code(400).send({ error: "Student year level is not set." });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const firstCount = attempts.filter((a) => a.attemptType === AttemptType.FIRST).length;
    const retakeCount = attempts.filter((a) => a.attemptType === AttemptType.RETAKE).length;
    const inProgress = attempts.find((a) => !a.submittedAt);

    if (inProgress) {
      const questions = await loadAttemptQuestions(inProgress.questionIds);
      return { attempt: inProgress, questions };
    }

    let setType: QuestionSetType = QuestionSetType.DIAGNOSTIC;
    let attemptType: AttemptType = AttemptType.FIRST;
    let attemptNumber = 1;

    if (firstCount === 0) {
      setType = QuestionSetType.DIAGNOSTIC;
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
        yearLevel: user.yearLevel,
        type: setType,
        status: QuestionSetStatus.DEPLOYED,
      },
      include: { configs: true },
    });

    if (!questionSet) {
      return reply.code(404).send({ error: `No deployed ${setType.toLowerCase()} set for this year level.` });
    }

    const selected = await generateExamQuestions(questionSet.configs);
    const attempt = await prisma.examAttempt.create({
      data: {
        studentId: user.id,
        questionSetId: questionSet.id,
        attemptType,
        attemptNumber,
        questionIds: JSON.stringify(selected.map((q) => q.id)),
        totalItems: selected.length,
        answers: {
          create: selected.map((q) => ({ questionId: q.id })),
        },
      },
    });

    return reply.code(201).send({
      attempt,
      questions: selected.map(stripCorrectAnswer),
    });
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
    for (const answer of body.answers) {
      const existing = attempt.answers.find((a) => a.questionId === answer.questionId);
      if (!existing) continue;

      const isCorrect = existing.question.correctOption === answer.selectedOption;
      if (isCorrect) score += 1;

      await prisma.examAnswer.update({
        where: { id: existing.id },
        data: {
          selectedOption: answer.selectedOption,
          isCorrect,
        },
      });
    }

    const result = calculateResult(
      score,
      attempt.totalItems,
      attempt.questionSet.passThreshold
    );

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: result.score,
        percentage: result.percentage,
        passed: result.passed,
        submittedAt: new Date(),
      },
    });

    if (!result.passed && attempt.attemptType === AttemptType.FIRST) {
      await prisma.retakeApproval.create({
        data: {
          studentId: user.id,
          examAttemptId: attemptId,
          yearLevel: user.yearLevel!,
          status: ApprovalStatus.PENDING,
        },
      });
    }

    return { attempt: updated, result };
  });

  app.get("/retakes", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const status = (request.query as { status?: ApprovalStatus }).status;
    const approvals = await prisma.retakeApproval.findMany({
      where: status ? { status } : undefined,
      include: {
        student: { select: { id: true, name: true, email: true, yearLevel: true } },
        examAttempt: true,
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { approvals };
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
