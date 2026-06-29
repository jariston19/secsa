import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import {
  bulkDeleteTopics,
  deleteTopicRecord,
  verifyUserPassword,
} from "../services/subjectTopicDelete.js";

const bulkDeleteTopicsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

const deleteAllTopicsSchema = z.object({
  password: z.string().min(1),
  subjectId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(500).optional(),
});

const topicSchema = z.object({
  name: z.string().min(1),
  subjectId: z.string().min(1),
});

const batchTopicsSchema = z.object({
  topics: z.array(topicSchema).min(1).max(100),
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

  app.post("/batch", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = batchTopicsSchema.parse(request.body);
    const subjectIds = [...new Set(body.topics.map((topic) => topic.subjectId))];
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });

    if (subjects.length !== subjectIds.length) {
      return reply.code(400).send({ error: "One or more subjects were not found." });
    }

    const seen = new Set<string>();
    const created: Awaited<ReturnType<typeof prisma.topic.create>>[] = [];
    const skipped: Array<{ subjectId: string; name: string; reason: string }> = [];

    for (const item of body.topics) {
      const key = `${item.subjectId}::${item.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        skipped.push({
          subjectId: item.subjectId,
          name: item.name,
          reason: "Duplicate in this batch.",
        });
        continue;
      }
      seen.add(key);

      try {
        const topic = await prisma.topic.create({
          data: { subjectId: item.subjectId, name: item.name.trim() },
        });
        created.push(topic);
      } catch {
        skipped.push({
          subjectId: item.subjectId,
          name: item.name,
          reason: "Topic already exists for this subject.",
        });
      }
    }

    if (created.length === 0) {
      return reply.code(400).send({
        error: "No topics were created.",
        skipped,
      });
    }

    return reply.code(201).send({
      topics: created,
      created: created.length,
      skipped,
    });
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

  app.post("/bulk-delete", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = bulkDeleteTopicsSchema.parse(request.body);
    const result = await bulkDeleteTopics(body.ids);

    if (result.deleted === 0) {
      return reply.code(400).send({
        error: "No topics were deleted.",
        ...result,
      });
    }

    return result;
  });

  app.post("/delete-all", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = deleteAllTopicsSchema.parse(request.body);
    const validPassword = await verifyUserPassword(user.id, body.password);
    if (!validPassword) {
      return reply.code(403).send({ error: "Incorrect password." });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
      select: { id: true },
    });
    if (!subject) {
      return reply.code(404).send({ error: "Subject not found." });
    }

    const topics = body.ids?.length
      ? await prisma.topic.findMany({
          where: { id: { in: body.ids }, subjectId: body.subjectId },
          select: { id: true },
        })
      : await prisma.topic.findMany({
          where: { subjectId: body.subjectId },
          select: { id: true },
        });

    const result = await bulkDeleteTopics(topics.map((topic) => topic.id));
    if (result.deleted === 0) {
      return reply.code(400).send({
        error: "No topics were deleted.",
        ...result,
      });
    }

    return result;
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const topic = await prisma.topic.findUnique({
      where: { id },
      select: { _count: { select: { questions: true } } },
    });

    if (!topic) return reply.code(404).send({ error: "Topic not found." });

    const result = await deleteTopicRecord(id);

    if (!result.success) {
      const status = result.error === "Topic not found." ? 404 : 400;
      return reply.code(status).send({ error: result.error });
    }

    return {
      success: true,
      archivedSets: result.archivedSets,
      deletedQuestions: topic._count.questions,
    };
  });
}
