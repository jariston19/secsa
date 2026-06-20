import { unlink } from "fs/promises";
import path from "path";
import type { FastifyInstance } from "fastify";
import { Difficulty, Role, BloomLevel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { isBloomLevelAllowed } from "../lib/bloomLevel.js";
import { uploadDir } from "../lib/paths.js";
import { findDuplicateQuestion } from "../services/questionDuplicates.js";
import { saveOptimizedImage } from "../services/imageUpload.js";
import { importQuestionsFromCsv, questionCsvTemplate } from "../services/questionCsvImport.js";

const questionSchema = z
  .object({
    subjectId: z.string().min(1),
    topicId: z.string().optional().nullable(),
    difficulty: z.nativeEnum(Difficulty),
    bloomLevel: z.nativeEnum(BloomLevel),
    text: z.string().min(1),
    optionA: z.string().min(1),
    optionB: z.string().min(1),
    optionC: z.string().min(1),
    optionD: z.string().min(1),
    correctOption: z.enum(["A", "B", "C", "D"]),
  })
  .superRefine((data, ctx) => {
    if (!isBloomLevelAllowed(data.difficulty, data.bloomLevel)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Domain ${data.bloomLevel} is not allowed for ${data.difficulty} difficulty.`,
        path: ["bloomLevel"],
      });
    }
  });

export async function questionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as { subjectId?: string; topicId?: string };
    const questions = await prisma.question.findMany({
      where: {
        subjectId: query.subjectId,
        ...(query.topicId === ""
          ? { topicId: null }
          : query.topicId
            ? { topicId: query.topicId }
            : {}),
      },
      include: {
        subject: { select: { courseCode: true, courseTitle: true } },
        topic: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { questions };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const parts = request.parts();
    const fields: Record<string, string> = {};
    let imageBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        imageBuffer = await part.toBuffer();
      } else if (part.type === "field") {
        fields[part.fieldname] = String(part.value);
      }
    }

    const body = questionSchema.parse({
      ...fields,
      topicId: fields.topicId || null,
    });

    const duplicate = await findDuplicateQuestion(prisma, body);
    if (duplicate) {
      return reply.code(409).send({
        error: "A question with the same text already exists for this subject and topic.",
      });
    }

    let imagePath: string | undefined;
    if (imageBuffer) {
      imagePath = await saveOptimizedImage(imageBuffer, uploadDir);
    }

    const question = await prisma.question.create({
      data: {
        ...body,
        imagePath,
        createdById: user.id,
      },
    });

    return reply.code(201).send({ question });
  });

  app.get("/import/template.csv", async (_request, reply) => {
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="questions-import-template.csv"');
    return questionCsvTemplate();
  });

  app.post("/import/csv", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const parts = request.parts();
    let csvText: string | null = null;

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "csv") {
        csvText = (await part.toBuffer()).toString("utf8");
      }
    }

    if (!csvText?.trim()) {
      return reply.code(400).send({ error: "Upload a CSV file in the csv field." });
    }

    const result = await importQuestionsFromCsv(prisma, csvText, user.id);
    if (result.created === 0) {
      return reply.code(400).send({
        error: "No questions were imported.",
        ...result,
      });
    }

    return reply.code(201).send(result);
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const question = await prisma.question.findUnique({ where: { id } });

    if (!question) return reply.code(404).send({ error: "Question not found." });

    await prisma.question.delete({ where: { id } });

    if (question.imagePath) {
      await unlink(path.join(uploadDir, question.imagePath)).catch(() => {});
    }

    return { success: true };
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Question not found." });

    const parts = request.parts();
    const fields: Record<string, string> = {};
    let imageBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        imageBuffer = await part.toBuffer();
      } else if (part.type === "field") {
        fields[part.fieldname] = String(part.value);
      }
    }

    const body = questionSchema.parse({
      ...fields,
      topicId: fields.topicId || null,
    });

    const duplicate = await findDuplicateQuestion(prisma, { ...body, excludeId: id });
    if (duplicate) {
      return reply.code(409).send({
        error: "A question with the same text already exists for this subject and topic.",
      });
    }

    let imagePath = existing.imagePath;
    if (fields.removeImage === "true") {
      if (existing.imagePath) {
        await unlink(path.join(uploadDir, existing.imagePath)).catch(() => {});
      }
      imagePath = null;
    } else if (imageBuffer) {
      if (existing.imagePath) {
        await unlink(path.join(uploadDir, existing.imagePath)).catch(() => {});
      }
      imagePath = await saveOptimizedImage(imageBuffer, uploadDir);
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        ...body,
        imagePath,
      },
    });

    return { question };
  });
}
