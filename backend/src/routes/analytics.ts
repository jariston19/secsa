import type { FastifyInstance } from "fastify";
import { AttemptType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/overview", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const yearLevel = Number((request.query as { yearLevel?: string }).yearLevel);
    const attemptFilter = Number.isFinite(yearLevel)
      ? { student: { yearLevel } }
      : {};

    const [students, submittedAttempts, firstTakers, retakers, passed, failed] =
      await Promise.all([
        prisma.user.count({ where: { role: Role.STUDENT, yearLevel: Number.isFinite(yearLevel) ? yearLevel : undefined } }),
        prisma.examAttempt.count({ where: { ...attemptFilter, submittedAt: { not: null } } }),
        prisma.examAttempt.count({ where: { ...attemptFilter, attemptType: AttemptType.FIRST, submittedAt: { not: null } } }),
        prisma.examAttempt.count({ where: { ...attemptFilter, attemptType: AttemptType.RETAKE, submittedAt: { not: null } } }),
        prisma.examAttempt.count({ where: { ...attemptFilter, passed: true } }),
        prisma.examAttempt.count({ where: { ...attemptFilter, passed: false } }),
      ]);

    const avgScore = await prisma.examAttempt.aggregate({
      where: { ...attemptFilter, submittedAt: { not: null } },
      _avg: { percentage: true },
    });

    return {
      students,
      examsTaken: submittedAttempts,
      firstTakers,
      retakers,
      passed,
      failed,
      passRate: submittedAttempts > 0 ? (passed / submittedAttempts) * 100 : 0,
      averageScore: avgScore._avg.percentage ?? 0,
    };
  });

  app.get("/questions", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const topicId = (request.query as { topicId?: string }).topicId;
    const answers = await prisma.examAnswer.findMany({
      where: {
        selectedOption: { not: null },
        question: topicId ? { topicId } : undefined,
      },
      include: {
        question: {
          include: {
            topic: true,
            subject: true,
          },
        },
      },
    });

    const byQuestion = new Map<
      string,
      {
        questionId: string;
        text: string;
        topic: string | null;
        subject: string;
        difficulty: string;
        total: number;
        correct: number;
        incorrect: number;
        optionCounts: Record<string, number>;
      }
    >();

    for (const answer of answers) {
      const key = answer.questionId;
      if (!byQuestion.has(key)) {
        byQuestion.set(key, {
          questionId: answer.questionId,
          text: answer.question.text,
          topic: answer.question.topic?.name ?? null,
          subject: `${answer.question.subject.courseCode} ${answer.question.subject.courseTitle}`,
          difficulty: answer.question.difficulty,
          total: 0,
          correct: 0,
          incorrect: 0,
          optionCounts: { A: 0, B: 0, C: 0, D: 0 },
        });
      }

      const row = byQuestion.get(key)!;
      row.total += 1;
      if (answer.isCorrect) row.correct += 1;
      else row.incorrect += 1;
      if (answer.selectedOption) {
        row.optionCounts[answer.selectedOption] += 1;
      }
    }

    const questions = [...byQuestion.values()]
      .map((q) => ({
        ...q,
        correctRate: q.total > 0 ? (q.correct / q.total) * 100 : 0,
        incorrectRate: q.total > 0 ? (q.incorrect / q.total) * 100 : 0,
      }))
      .sort((a, b) => a.correctRate - b.correctRate);

    return { questions };
  });

  app.get("/difficulty", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const answers = await prisma.examAnswer.findMany({
      where: { selectedOption: { not: null } },
      include: { question: true },
    });

    const stats: Record<string, { total: number; correct: number }> = {
      EASY: { total: 0, correct: 0 },
      MEDIUM: { total: 0, correct: 0 },
      HARD: { total: 0, correct: 0 },
    };

    for (const answer of answers) {
      const bucket = stats[answer.question.difficulty];
      bucket.total += 1;
      if (answer.isCorrect) bucket.correct += 1;
    }

    return {
      difficulties: Object.entries(stats).map(([difficulty, value]) => ({
        difficulty,
        total: value.total,
        correct: value.correct,
        correctRate: value.total > 0 ? (value.correct / value.total) * 100 : 0,
      })),
    };
  });

  app.get("/cohorts", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const yearLevel = Number((request.query as { yearLevel?: string }).yearLevel);
    const baseWhere = {
      submittedAt: { not: null as Date | null },
      student: Number.isFinite(yearLevel) ? { yearLevel } : undefined,
    };

    const [firstStats, retakeStats] = await Promise.all([
      prisma.examAttempt.aggregate({
        where: { ...baseWhere, attemptType: AttemptType.FIRST },
        _avg: { percentage: true },
        _count: true,
      }),
      prisma.examAttempt.aggregate({
        where: { ...baseWhere, attemptType: AttemptType.RETAKE },
        _avg: { percentage: true },
        _count: true,
      }),
    ]);

    const firstPassed = await prisma.examAttempt.count({
      where: { ...baseWhere, attemptType: AttemptType.FIRST, passed: true },
    });

    const retakePassed = await prisma.examAttempt.count({
      where: { ...baseWhere, attemptType: AttemptType.RETAKE, passed: true },
    });

    return {
      firstTakers: {
        count: firstStats._count,
        averageScore: firstStats._avg.percentage ?? 0,
        passRate: firstStats._count > 0 ? (firstPassed / firstStats._count) * 100 : 0,
      },
      retakers: {
        count: retakeStats._count,
        averageScore: retakeStats._avg.percentage ?? 0,
        passRate: retakeStats._count > 0 ? (retakePassed / retakeStats._count) * 100 : 0,
      },
    };
  });
}
