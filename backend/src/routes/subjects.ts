import type { FastifyInstance } from "fastify";
import { QuestionSetStatus, Role } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { uploadDir } from "../lib/paths.js";
import { yearLevelSchema } from "../lib/yearLevel.js";

const subjectSchema = z.object({
  courseCode: z.string().min(1),
  courseTitle: z.string().min(1),
  yearLevel: yearLevelSchema,
});

export async function subjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const yearLevel = Number((request.query as { yearLevel?: string }).yearLevel);
    const where = Number.isFinite(yearLevel) ? { yearLevel } : {};

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        topics: true,
        _count: { select: { questions: true } },
      },
      orderBy: [{ yearLevel: "asc" }, { courseCode: "asc" }],
    });

    return { subjects };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = subjectSchema.parse(request.body);
    const subject = await prisma.subject.create({
      data: { ...body, createdById: user.id },
    });

    return reply.code(201).send({ subject });
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const body = subjectSchema.parse(request.body);

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Subject not found." });

    try {
      const subject = await prisma.subject.update({
        where: { id },
        data: body,
      });
      return { subject };
    } catch {
      return reply.code(400).send({
        error: "A subject with this course code and year level already exists.",
      });
    }
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        questions: { select: { id: true, imagePath: true } },
      },
    });

    if (!subject) return reply.code(404).send({ error: "Subject not found." });

    const usedInExams = await prisma.examAnswer.findFirst({
      where: {
        question: { subjectId: id },
        selectedOption: { not: null },
      },
    });

    if (usedInExams) {
      return reply.code(400).send({
        error: "Cannot delete this subject because its questions were already used in student exams.",
      });
    }

    const deployedConfigs = await prisma.questionSetConfig.findMany({
      where: {
        subjectId: id,
        questionSet: { status: QuestionSetStatus.DEPLOYED },
      },
      select: { questionSetId: true },
    });

    const deployedSetIds = [...new Set(deployedConfigs.map((c) => c.questionSetId))];

    for (const question of subject.questions) {
      if (question.imagePath) {
        await unlink(path.join(uploadDir, question.imagePath)).catch(() => {});
      }
    }

    await prisma.$transaction([
      ...(deployedSetIds.length > 0
        ? [
            prisma.questionSet.updateMany({
              where: { id: { in: deployedSetIds } },
              data: { status: QuestionSetStatus.ARCHIVED },
            }),
          ]
        : []),
      prisma.subject.delete({ where: { id } }),
    ]);

    return {
      success: true,
      archivedSets: deployedSetIds.length,
    };
  });
}
