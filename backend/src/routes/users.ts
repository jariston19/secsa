import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { Role, Gender, SchoolType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { programCourseSlugSchema, assertActiveProgramSlug } from "../lib/programCourse.js";
import { MIN_YEAR_LEVEL, assertYearLevelForProgram, maxYearLevelForProgram, yearLevelSchema } from "../lib/yearLevel.js";
import {
  executeBulkGraduate,
  executeBulkPromote,
  executeSchoolYearRollover,
  previewBulkGraduate,
  previewBulkPromote,
  previewSchoolYearRollover,
} from "../services/bulkStudentYearOps.js";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
  yearLevel: yearLevelSchema.optional(),
  programCourse: programCourseSlugSchema.optional(),
  gender: z.nativeEnum(Gender).optional(),
  schoolType: z.nativeEnum(SchoolType).optional(),
  qaUnlimited: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  yearLevel: yearLevelSchema.optional().nullable(),
  programCourse: programCourseSlugSchema.optional().nullable(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  schoolType: z.nativeEnum(SchoolType).optional().nullable(),
  isActive: z.boolean().optional(),
  qaUnlimited: z.boolean().optional(),
});

const bulkProgramSchema = z.object({
  programCourse: programCourseSlugSchema,
});

const bulkPromoteSchema = bulkProgramSchema.extend({
  fromYearLevel: yearLevelSchema,
}).superRefine((body, ctx) => {
  const maxYearLevel = maxYearLevelForProgram(body.programCourse);
  if (body.fromYearLevel < MIN_YEAR_LEVEL || body.fromYearLevel >= maxYearLevel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fromYearLevel"],
      message: `Promote only applies to incoming years ${MIN_YEAR_LEVEL}–${maxYearLevel - 1}. Use graduate for incoming year ${maxYearLevel}.`,
    });
  }
});

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  yearLevel: true,
  programCourse: true,
  gender: true,
  schoolType: true,
  isActive: true,
  qaUnlimited: true,
  createdAt: true,
} as const;

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const users = await prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: userSelect,
    });

    return { users };
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const body = updateUserSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found." });

    const nextRole = body.role ?? existing.role;
    const nextYearLevel =
      nextRole === Role.STUDENT
        ? body.yearLevel !== undefined
          ? body.yearLevel
          : existing.yearLevel
        : null;
    const nextProgramCourse =
      nextRole === Role.STUDENT
        ? body.programCourse !== undefined
          ? body.programCourse
          : existing.programCourse
        : null;
    const nextGender =
      nextRole === Role.STUDENT
        ? body.gender !== undefined
          ? body.gender
          : existing.gender
        : null;
    const nextSchoolType =
      nextRole === Role.STUDENT
        ? body.schoolType !== undefined
          ? body.schoolType
          : existing.schoolType
        : null;

    if (nextRole === Role.STUDENT && !nextYearLevel) {
      return reply.code(400).send({ error: "Students require a year level." });
    }

    if (nextRole === Role.STUDENT && !nextProgramCourse) {
      return reply.code(400).send({ error: "Students require a program course." });
    }

    if (nextRole === Role.STUDENT && nextProgramCourse) {
      await assertActiveProgramSlug(nextProgramCourse);
    }

    if (nextRole === Role.STUDENT && nextYearLevel && nextProgramCourse) {
      try {
        assertYearLevelForProgram(nextProgramCourse, nextYearLevel);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid year level.";
        return reply.code(400).send({ error: message });
      }
    }

    if (body.isActive === false && id === user.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account." });
    }

    try {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.qaUnlimited !== undefined ? { qaUnlimited: body.qaUnlimited } : {}),
          yearLevel: nextYearLevel,
          programCourse: nextProgramCourse,
          gender: nextGender,
          schoolType: nextSchoolType,
          ...(body.password
            ? { passwordHash: await bcrypt.hash(body.password, 10) }
            : {}),
        },
        select: userSelect,
      });

      return { user: updated };
    } catch {
      return reply.code(400).send({ error: "A user with this email already exists." });
    }
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = createUserSchema.parse(request.body);
    if (body.role === Role.STUDENT && !body.yearLevel) {
      return reply.code(400).send({ error: "Students require a year level." });
    }

    if (body.role === Role.STUDENT && !body.programCourse) {
      return reply.code(400).send({ error: "Students require a program course." });
    }

    if (body.role === Role.STUDENT && !body.gender) {
      return reply.code(400).send({ error: "Students require a gender." });
    }

    if (body.role === Role.STUDENT && !body.schoolType) {
      return reply.code(400).send({ error: "Students require a school type." });
    }

    if (body.role === Role.STUDENT && body.programCourse) {
      await assertActiveProgramSlug(body.programCourse);
    }

    if (body.role === Role.STUDENT && body.yearLevel && body.programCourse) {
      try {
        assertYearLevelForProgram(body.programCourse, body.yearLevel);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid year level.";
        return reply.code(400).send({ error: message });
      }
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        yearLevel: body.role === Role.STUDENT ? body.yearLevel : null,
        programCourse: body.role === Role.STUDENT ? body.programCourse : null,
        gender: body.role === Role.STUDENT ? body.gender : null,
        schoolType: body.role === Role.STUDENT ? body.schoolType : null,
        qaUnlimited: body.role === Role.STUDENT ? Boolean(body.qaUnlimited) : false,
      },
      select: userSelect,
    });

    return reply.code(201).send({ user: created });
  });

  app.post("/bulk/promote/preview", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkPromoteSchema.parse(request.body);
    try {
      return await previewBulkPromote(body.programCourse, body.fromYearLevel);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to preview promote.";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/bulk/promote", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkPromoteSchema.parse(request.body);
    try {
      return await executeBulkPromote(body.programCourse, body.fromYearLevel);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to promote students.";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/bulk/graduate/preview", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkProgramSchema.parse(request.body);
    try {
      return await previewBulkGraduate(body.programCourse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to preview graduate.";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/bulk/graduate", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkProgramSchema.parse(request.body);
    try {
      return await executeBulkGraduate(body.programCourse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to graduate students.";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/bulk/rollover/preview", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkProgramSchema.parse(request.body);
    try {
      return await previewSchoolYearRollover(body.programCourse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to preview rollover.";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/bulk/rollover", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = bulkProgramSchema.parse(request.body);
    try {
      return await executeSchoolYearRollover(body.programCourse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rollover students.";
      return reply.code(400).send({ error: message });
    }
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { id } = request.params as { id: string };

    if (id === user.id) {
      return reply.code(400).send({ error: "You cannot delete your own account." });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        _count: {
          select: {
            subjectsCreated: true,
            questionsCreated: true,
            questionSetsCreated: true,
          },
        },
      },
    });

    if (!existing) return reply.code(404).send({ error: "User not found." });

    if (existing.role === Role.SUPERADMIN) {
      return reply.code(400).send({
        error: "Admin accounts cannot be deleted. Disable the account instead.",
      });
    }

    const { subjectsCreated, questionsCreated, questionSetsCreated } = existing._count;
    if (subjectsCreated > 0 || questionsCreated > 0 || questionSetsCreated > 0) {
      return reply.code(400).send({
        error:
          "Cannot delete this user because they created subjects, questions, or question sets. Deactivate the account instead.",
      });
    }

    await prisma.$transaction([
      prisma.retakeApproval.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      }),
      prisma.retakeApproval.deleteMany({ where: { studentId: id } }),
      prisma.examAttempt.deleteMany({ where: { studentId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return { success: true };
  });
}
