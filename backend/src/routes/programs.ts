import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { resolveProgramSlug } from "../lib/programCourse.js";

const createProgramSchema = z.object({
  label: z.string().trim().min(2).max(80),
  abbr: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9]+$/, "Abbreviation must be letters and numbers only."),
});

const updateProgramSchema = createProgramSchema;

const programSelect = {
  id: true,
  slug: true,
  label: true,
  abbr: true,
  isActive: true,
  createdAt: true,
} as const;

async function loadProgram(id: string) {
  return prisma.program.findFirst({
    where: { id, isActive: true },
    select: programSelect,
  });
}

export async function programRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    getUser(request);

    const programs = await prisma.program.findMany({
      where: { isActive: true },
      orderBy: [{ label: "asc" }],
      select: programSelect,
    });

    return { programs };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = createProgramSchema.parse(request.body);
    const abbr = body.abbr.toUpperCase();
    const slug = await resolveProgramSlug(body.label, abbr);

    const program = await prisma.program.create({
      data: {
        slug,
        label: body.label.trim(),
        abbr,
      },
      select: programSelect,
    });

    return reply.code(201).send({ program });
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const body = updateProgramSchema.parse(request.body);

    const existing = await loadProgram(id);
    if (!existing) {
      return reply.code(404).send({ error: "Program course not found." });
    }

    const abbr = body.abbr.trim().toUpperCase();
    const label = body.label.trim();
    const slug = await resolveProgramSlug(label, abbr, id);

    const program = await prisma.program.update({
      where: { id },
      data: {
        slug,
        label,
        abbr,
      },
      select: programSelect,
    });

    return { program, previousSlug: existing.slug };
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const existing = await loadProgram(id);
    if (!existing) {
      return reply.code(404).send({ error: "Program course not found." });
    }

    const [students, subjectLinks, questionSets] = await Promise.all([
      prisma.user.count({ where: { programCourse: existing.slug } }),
      prisma.subjectProgramCourse.count({ where: { programCourse: existing.slug } }),
      prisma.questionSet.count({ where: { programCourse: existing.slug } }),
    ]);

    if (students > 0 || subjectLinks > 0 || questionSets > 0) {
      const parts: string[] = [];
      if (students > 0) parts.push(`${students} student${students === 1 ? "" : "s"}`);
      if (subjectLinks > 0) {
        parts.push(`${subjectLinks} subject link${subjectLinks === 1 ? "" : "s"}`);
      }
      if (questionSets > 0) {
        parts.push(`${questionSets} exam set${questionSets === 1 ? "" : "s"}`);
      }
      return reply.code(400).send({
        error: `Cannot remove this program because it is used by ${parts.join(", ")}.`,
      });
    }

    await prisma.program.delete({ where: { id } });

    return { success: true };
  });
}
