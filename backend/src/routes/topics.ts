import type { FastifyInstance } from "fastify";
import { QuestionSetStatus, Role } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { uploadDir } from "../lib/paths.js";

const topicSchema = z.object({
  name: z.string().min(1),
  subjectId: z.string().min(1),
});

export async function topicRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const subjectId = (request.query as { subjectId?: string }).subjectId;
    const topics = await prisma.topic.findMany({
      where: subjectId ? { subjectId } : undefined,
      include: {
        subject: { select: { courseCode: true, courseTitle: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { name: "asc" },
    });
    return { topics };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = topicSchema.parse(request.body);
    const topic = await prisma.topic.create({ data: body });
    return reply.code(201).send({ topic });
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const body = topicSchema.parse(request.body);

    const existing = await prisma.topic.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Topic not found." });

    try {
      const topic = await prisma.topic.update({
        where: { id },
        data: body,
        include: {
          subject: { select: { courseCode: true, courseTitle: true } },
          _count: { select: { questions: true } },
        },
      });
      return { topic };
    } catch {
      return reply.code(400).send({
        error: "A topic with this name already exists under the selected subject.",
      });
    }
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        questions: { select: { imagePath: true } },
      },
    });

    if (!topic) return reply.code(404).send({ error: "Topic not found." });

    const usedInExams = await prisma.examAnswer.findFirst({
      where: {
        question: { topicId: id },
        selectedOption: { not: null },
      },
    });

    if (usedInExams) {
      return reply.code(400).send({
        error: "Cannot delete this topic because its questions were already used in student exams.",
      });
    }

    const deployedConfigs = await prisma.questionSetConfig.findMany({
      where: {
        topicId: id,
        questionSet: { status: QuestionSetStatus.DEPLOYED },
      },
      select: { questionSetId: true },
    });

    const deployedSetIds = [...new Set(deployedConfigs.map((c) => c.questionSetId))];

    for (const question of topic.questions) {
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
      prisma.topic.delete({ where: { id } }),
    ]);

    return {
      success: true,
      archivedSets: deployedSetIds.length,
    };
  });
}
