import { unlink } from "fs/promises";
import path from "path";
import type { FastifyInstance } from "fastify";
import { Difficulty, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { uploadDir } from "../lib/paths.js";
import { saveOptimizedImage } from "../services/imageUpload.js";

const questionSchema = z.object({
  subjectId: z.string().min(1),
  topicId: z.string().optional().nullable(),
  difficulty: z.nativeEnum(Difficulty),
  text: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctOption: z.enum(["A", "B", "C", "D"]),
});

export async function questionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as { subjectId?: string; topicId?: string };
    const questions = await prisma.question.findMany({
      where: {
        subjectId: query.subjectId,
        topicId: query.topicId,
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
}
