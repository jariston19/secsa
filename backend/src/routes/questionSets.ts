import type { FastifyInstance } from "fastify";
import { QuestionSetStatus, QuestionSetType, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { yearLevelSchema, curriculumYearForStudentYear } from "../lib/yearLevel.js";
import { programCourseSlugSchema, assertActiveProgramSlug, SHARED_DIAGNOSTIC_PROGRAM } from "../lib/programCourse.js";
import { isSharedDiagnosticProgram } from "../lib/incomingDiagnostic.js";
import { subjectIncludesProgram } from "../lib/subjectPrograms.js";
import {
  generateCanonicalExamQuestions,
  getConfigPoolQuestions,
  validateQuestionSetConfigs,
} from "../services/examGenerator.js";

const configSchema = z
  .object({
    subjectId: z.string().min(1),
    topicId: z.string().optional().nullable(),
    easyCount: z.number().int().min(0),
    mediumCount: z.number().int().min(0),
    hardCount: z.number().int().min(0),
  })
  .refine(
    (config) => config.easyCount + config.mediumCount + config.hardCount > 0,
    { message: "Each config must include at least one item." }
  );

function expandConfigs(configs: z.infer<typeof configSchema>[]) {
  return configs.map((config, index) => ({
    id: `draft-${index}`,
    questionSetId: "draft",
    subjectId: config.subjectId,
    topicId: config.topicId ?? null,
    easyCount: config.easyCount,
    mediumCount: config.mediumCount,
    hardCount: config.hardCount,
  }));
}

const createSetSchema = z.object({
  name: z.string().min(1),
  yearLevel: yearLevelSchema,
  programCourse: programCourseSlugSchema,
  type: z.nativeEnum(QuestionSetType),
  totalItems: z.number().int().min(1),
  passThreshold: z.number().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(480),
  configs: z.array(configSchema).min(1),
});

const updateSetSchema = z.object({
  name: z.string().min(1),
  totalItems: z.number().int().min(1),
  passThreshold: z.number().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(480),
  configs: z.array(configSchema).min(1),
});

async function validateSetConfigsForYear(
  yearLevel: number,
  programCourse: string,
  configs: z.infer<typeof configSchema>[]
) {
  const expanded = expandConfigs(configs);
  const configTotal = expanded.reduce(
    (sum, c) => sum + c.easyCount + c.mediumCount + c.hardCount,
    0
  );

  const curriculumYear = curriculumYearForStudentYear(yearLevel);
  const subjectIds = [...new Set(configs.map((c) => c.subjectId))];
  const subjectsInConfigs = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: {
      id: true,
      courseCode: true,
      yearLevel: true,
      programCourses: { select: { programCourse: true } },
    },
  });

  if (subjectsInConfigs.length !== subjectIds.length) {
    return { error: "One or more subjects in this set were not found." };
  }

  const mismatchedYear = subjectsInConfigs.find((s) => s.yearLevel !== curriculumYear);
  if (mismatchedYear) {
    return {
      error: `${mismatchedYear.courseCode} is curriculum year ${mismatchedYear.yearLevel}, but student year ${yearLevel} requires curriculum year ${curriculumYear} subjects only.`,
    };
  }

  const mismatchedCourse = subjectsInConfigs.find(
    (s) =>
      !isSharedDiagnosticProgram(programCourse) &&
      !subjectIncludesProgram(s.programCourses, programCourse)
  );
  if (mismatchedCourse) {
    return {
      error: `${mismatchedCourse.courseCode} is not linked to this program course.`,
    };
  }

  const errors = await validateQuestionSetConfigs(expanded);

  if (errors.length > 0) {
    return { error: "Insufficient questions in pools.", details: errors, configTotal };
  }

  return { configTotal };
}

export async function questionSetRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const query = request.query as {
      yearLevel?: string;
      programCourse?: string;
      type?: QuestionSetType;
      status?: QuestionSetStatus;
      includeArchived?: string;
    };
    const programCourse = query.programCourse
      ? programCourseSlugSchema.parse(query.programCourse)
      : undefined;
    const status =
      query.status ??
      (query.includeArchived === "true" ? undefined : { not: QuestionSetStatus.ARCHIVED });
    const sets = await prisma.questionSet.findMany({
      where: {
        yearLevel: query.yearLevel ? Number(query.yearLevel) : undefined,
        programCourse,
        type: query.type,
        status,
      },
      include: {
        configs: { include: { subject: true, topic: true } },
        _count: { select: { examAttempts: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { questionSets: sets };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = createSetSchema.parse(request.body);
    const programCourse =
      body.type === QuestionSetType.DIAGNOSTIC ? SHARED_DIAGNOSTIC_PROGRAM : body.programCourse;
    await assertActiveProgramSlug(programCourse);
    const validation = await validateSetConfigsForYear(
      body.yearLevel,
      programCourse,
      body.configs
    );
    if (validation.error) {
      return reply
        .code(400)
        .send({ error: validation.error, details: validation.details });
    }

    if (validation.configTotal !== body.totalItems) {
      return reply.code(400).send({
        error: `Config counts (${validation.configTotal}) must equal totalItems (${body.totalItems}).`,
      });
    }

    if (body.type === QuestionSetType.DIAGNOSTIC && body.yearLevel !== 1) {
      return reply.code(400).send({
        error: "Incoming diagnostic sets must use year level 1.",
      });
    }

    const questionSet = await prisma.questionSet.create({
      data: {
        name: body.name,
        yearLevel: body.yearLevel,
        programCourse,
        type: body.type,
        totalItems: body.totalItems,
        passThreshold: body.passThreshold ?? 75,
        timeLimitMinutes: body.timeLimitMinutes,
        createdById: user.id,
        configs: {
          create: expandConfigs(body.configs).map((c) => ({
            subjectId: c.subjectId,
            topicId: c.topicId,
            easyCount: c.easyCount,
            mediumCount: c.mediumCount,
            hardCount: c.hardCount,
          })),
        },
      },
      include: { configs: { include: { subject: true, topic: true } } },
    });

    return reply.code(201).send({ questionSet });
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const existing = await prisma.questionSet.findUnique({
      where: { id },
      include: { configs: true },
    });

    if (!existing) return reply.code(404).send({ error: "Question set not found." });

    if (existing.status === QuestionSetStatus.ARCHIVED) {
      return reply.code(400).send({ error: "Archived question sets cannot be edited." });
    }

    const body = updateSetSchema.parse(request.body);
    const validation = await validateSetConfigsForYear(
      existing.yearLevel,
      existing.programCourse,
      body.configs
    );
    if (validation.error) {
      return reply
        .code(400)
        .send({ error: validation.error, details: validation.details });
    }

    if (validation.configTotal !== body.totalItems) {
      return reply.code(400).send({
        error: `Config counts (${validation.configTotal}) must equal totalItems (${body.totalItems}).`,
      });
    }

    const questionSet = await prisma.$transaction(async (tx) => {
      await tx.questionSetConfig.deleteMany({ where: { questionSetId: id } });

      return tx.questionSet.update({
        where: { id },
        data: {
          name: body.name,
          totalItems: body.totalItems,
          passThreshold: body.passThreshold ?? existing.passThreshold,
          timeLimitMinutes: body.timeLimitMinutes,
          examQuestionIds:
            existing.status === QuestionSetStatus.DEPLOYED ? undefined : null,
          configs: {
            create: expandConfigs(body.configs).map((c) => ({
              subjectId: c.subjectId,
              topicId: c.topicId,
              easyCount: c.easyCount,
              mediumCount: c.mediumCount,
              hardCount: c.hardCount,
            })),
          },
        },
        include: { configs: { include: { subject: true, topic: true } } },
      });
    });

    if (existing.status === QuestionSetStatus.DEPLOYED) {
      const canonicalQuestions = await generateCanonicalExamQuestions(questionSet.configs);
      const refreshed = await prisma.questionSet.update({
        where: { id },
        data: {
          examQuestionIds: JSON.stringify(canonicalQuestions.map((question) => question.id)),
          totalItems: canonicalQuestions.length,
        },
        include: { configs: { include: { subject: true, topic: true } } },
      });
      return { questionSet: refreshed };
    }

    return { questionSet };
  });

  app.get("/:id/preview", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({
      where: { id },
      include: {
        configs: { include: { subject: true, topic: true } },
        _count: { select: { examAttempts: true } },
      },
    });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    const sections = await Promise.all(
      set.configs.map(async (config) => {
        const questions = await getConfigPoolQuestions(config.subjectId, config.topicId);
        const easy = questions.filter((q) => q.difficulty === "EASY");
        const medium = questions.filter((q) => q.difficulty === "MEDIUM");
        const hard = questions.filter((q) => q.difficulty === "HARD");

        return {
          configId: config.id,
          subject: config.subject,
          topic: config.topic,
          required: {
            easy: config.easyCount,
            medium: config.mediumCount,
            hard: config.hardCount,
          },
          available: {
            easy: easy.length,
            medium: medium.length,
            hard: hard.length,
          },
          questions: questions.map((q) => ({
            id: q.id,
            text: q.text,
            difficulty: q.difficulty,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            imagePath: q.imagePath,
            topic: q.topic?.name ?? null,
            subject: `${q.subject.courseCode} ${q.subject.courseTitle}`,
          })),
        };
      })
    );

    const validationErrors = await validateQuestionSetConfigs(set.configs);

    return {
      questionSet: set,
      sections,
      isReady: validationErrors.length === 0,
      validationErrors,
    };
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({
      where: { id },
      include: { _count: { select: { examAttempts: true } } },
    });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    if (set.status === QuestionSetStatus.DEPLOYED) {
      return reply.code(400).send({
        error: "Cannot delete a deployed question set. Cancel deploy first.",
      });
    }

    if (set._count.examAttempts > 0) {
      return reply.code(400).send({
        error: "Cannot delete a question set that students have already used for exams.",
      });
    }

    await prisma.questionSet.delete({ where: { id } });
    return { success: true };
  });

  app.post("/:id/archive", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({ where: { id } });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    if (set.status === QuestionSetStatus.ARCHIVED) {
      return reply.code(400).send({ error: "Question set is already archived." });
    }

    const questionSet = await prisma.questionSet.update({
      where: { id },
      data: {
        status: QuestionSetStatus.ARCHIVED,
        deployedAt: null,
      },
      include: {
        configs: { include: { subject: true, topic: true } },
        _count: { select: { examAttempts: true } },
      },
    });

    return { questionSet };
  });

  app.post("/:id/restore", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({ where: { id } });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    if (set.status !== QuestionSetStatus.ARCHIVED) {
      return reply.code(400).send({ error: "Only archived question sets can be restored." });
    }

    const questionSet = await prisma.questionSet.update({
      where: { id },
      data: {
        status: QuestionSetStatus.DRAFT,
        deployedAt: null,
      },
      include: {
        configs: { include: { subject: true, topic: true } },
        _count: { select: { examAttempts: true } },
      },
    });

    return { questionSet };
  });

  app.post("/:id/deploy", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({
      where: { id },
      include: { configs: true },
    });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    const errors = await validateQuestionSetConfigs(set.configs);
    if (errors.length > 0) {
      return reply.code(400).send({ error: "Cannot deploy. Pools incomplete.", details: errors });
    }

    const canonicalQuestions = await generateCanonicalExamQuestions(set.configs);
    const examQuestionIds = JSON.stringify(canonicalQuestions.map((question) => question.id));

    await prisma.$transaction([
      prisma.questionSet.updateMany({
        where: {
          yearLevel: set.yearLevel,
          type: set.type,
          status: QuestionSetStatus.DEPLOYED,
          ...(set.type === QuestionSetType.DIAGNOSTIC
            ? {}
            : { programCourse: set.programCourse }),
        },
        data: { status: QuestionSetStatus.ARCHIVED, examQuestionIds: null },
      }),
      prisma.questionSet.update({
        where: { id },
        data: {
          status: QuestionSetStatus.DEPLOYED,
          deployedAt: new Date(),
          examQuestionIds,
          totalItems: canonicalQuestions.length,
        },
      }),
    ]);

    const deployed = await prisma.questionSet.findUnique({
      where: { id },
      include: { configs: { include: { subject: true, topic: true } } },
    });

    return { questionSet: deployed };
  });

  app.post("/:id/undeploy", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const set = await prisma.questionSet.findUnique({ where: { id } });

    if (!set) return reply.code(404).send({ error: "Question set not found." });

    if (set.status !== QuestionSetStatus.DEPLOYED) {
      return reply.code(400).send({ error: "Only deployed question sets can be undeployed." });
    }

    const updated = await prisma.questionSet.update({
      where: { id },
      data: {
        status: QuestionSetStatus.DRAFT,
        deployedAt: null,
        examQuestionIds: null,
      },
      include: { configs: { include: { subject: true, topic: true } } },
    });

    return { questionSet: updated };
  });
}
