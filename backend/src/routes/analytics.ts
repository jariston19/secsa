import type { FastifyInstance } from "fastify";
import { AttemptType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import {
  nonQaAnswerWhere,
  nonQaExamAttemptWhere,
  nonQaStudentWhere,
  nonQaSubmittedExamWhere,
} from "../lib/studentFilters.js";
import { buildAnalyticsReports, buildStudentAnalyticsReport } from "../services/analyticsReports.js";
export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  function parseYearLevelQuery(value?: string) {
    const yearLevel = Number(value);
    return Number.isFinite(yearLevel) ? yearLevel : undefined;
  }

  app.get("/overview", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const yearLevel = parseYearLevelQuery((request.query as { yearLevel?: string }).yearLevel);
    const attemptFilter = nonQaExamAttemptWhere(yearLevel);

    const [students, submittedAttempts, firstTakers, retakers, passed, failed] =
      await Promise.all([
        prisma.user.count({ where: nonQaStudentWhere(yearLevel) }),
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
        ...nonQaAnswerWhere(),
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
      where: { selectedOption: { not: null }, ...nonQaAnswerWhere() },
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

    const yearLevel = parseYearLevelQuery((request.query as { yearLevel?: string }).yearLevel);
    const baseWhere = nonQaSubmittedExamWhere(yearLevel);

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

  app.get("/submissions", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const { yearLevel: yearLevelRaw, studentId } = request.query as {
      yearLevel?: string;
      studentId?: string;
    };
    const yearLevel = parseYearLevelQuery(yearLevelRaw);

    const attempts = await prisma.examAttempt.findMany({
      where: {
        submittedAt: { not: null },
        student: {
          ...nonQaStudentWhere(yearLevel),
          ...(studentId ? { id: studentId } : {}),
        },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true, yearLevel: true } },
        questionSet: { select: { name: true, yearLevel: true, type: true } },
      },
      orderBy: [{ submittedAt: "desc" }],
    });

    return {
      submissions: attempts.map((attempt) => ({
        id: attempt.id,
        student: attempt.student,
        questionSetName: attempt.questionSet.name,
        questionSetYear: attempt.questionSet.yearLevel,
        questionSetType: attempt.questionSet.type,
        attemptType: attempt.attemptType,
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        totalItems: attempt.totalItems,
        percentage: attempt.percentage,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      })),
    };
  });

  app.get("/submissions/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const { id } = request.params as { id: string };

    const attempt = await prisma.examAttempt.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true, yearLevel: true } },
        questionSet: {
          select: { name: true, yearLevel: true, type: true, passThreshold: true },
        },
        answers: {
          include: {
            question: {
              include: {
                subject: { select: { courseCode: true, courseTitle: true } },
                topic: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!attempt || !attempt.submittedAt) {
      return reply.code(404).send({ error: "Submission not found." });
    }

    const questionOrder = JSON.parse(attempt.questionIds) as string[];
    const answersByQuestionId = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const orderedAnswers = questionOrder
      .map((questionId) => answersByQuestionId.get(questionId))
      .filter((answer): answer is NonNullable<typeof answer> => Boolean(answer));

    return {
      submission: {
        id: attempt.id,
        student: attempt.student,
        questionSet: attempt.questionSet,
        attemptType: attempt.attemptType,
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        totalItems: attempt.totalItems,
        percentage: attempt.percentage,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        answers: orderedAnswers.map((answer) => ({
          id: answer.id,
          questionId: answer.questionId,
          text: answer.question.text,
          subject: `${answer.question.subject.courseCode} ${answer.question.subject.courseTitle}`,
          topic: answer.question.topic?.name ?? null,
          difficulty: answer.question.difficulty,
          selectedOption: answer.selectedOption,
          correctOption: answer.question.correctOption,
          isCorrect: answer.isCorrect,
        })),
      },
    };
  });

  app.get("/reports", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const { yearLevel: yearLevelRaw } = request.query as { yearLevel?: string };
    return buildAnalyticsReports(parseYearLevelQuery(yearLevelRaw));
  });

  app.get("/reports/student/:studentId", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const { studentId } = request.params as { studentId: string };
    const report = await buildStudentAnalyticsReport(studentId);
    if (!report) return reply.code(404).send({ error: "Student not found." });
    return report;
  });
}
