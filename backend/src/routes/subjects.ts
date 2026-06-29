import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { programCourseSlugSchema, assertActiveProgramSlugs } from "../lib/programCourse.js";
import {
  programCoursesSchema,
  subjectProgramCoursesInclude,
} from "../lib/subjectPrograms.js";
import { yearLevelSchema } from "../lib/yearLevel.js";
import {
  formatCourseCode,
  findDuplicateCourseCode,
} from "../services/subjectDuplicates.js";
import {
  bulkDeleteSubjects,
  deleteSubjectRecord,
  verifyUserPassword,
} from "../services/subjectTopicDelete.js";

const subjectSchema = z.object({
  courseCode: z.string().min(1),
  courseTitle: z.string().min(1),
  yearLevel: yearLevelSchema,
  programCourses: programCoursesSchema,
});

const bulkDeleteSubjectsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

const deleteAllSubjectsSchema = z.object({
  password: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(500).optional(),
  programCourse: programCourseSlugSchema.optional(),
  yearLevel: yearLevelSchema.optional(),
});

async function loadSubject(id: string) {
  return prisma.subject.findUnique({
    where: { id },
    include: {
      ...subjectProgramCoursesInclude,
      topics: true,
      _count: { select: { questions: true } },
    },
  });
}

export async function subjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const { yearLevel: yearLevelRaw, programCourse: programCourseRaw } = request.query as {
      yearLevel?: string;
      programCourse?: string;
    };
    const yearLevel = Number(yearLevelRaw);

    const subjects = await prisma.subject.findMany({
      where: {
        ...(Number.isFinite(yearLevel) ? { yearLevel } : {}),
        ...(programCourseRaw
          ? {
              programCourses: {
                some: { programCourse: programCourseSlugSchema.parse(programCourseRaw) },
              },
            }
          : {}),
      },
      include: {
        ...subjectProgramCoursesInclude,
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
    await assertActiveProgramSlugs(body.programCourses);
    const courseCode = formatCourseCode(body.courseCode);
    if (!courseCode) {
      return reply.code(400).send({ error: "Course code is required." });
    }

    const duplicate = await findDuplicateCourseCode(prisma, courseCode);
    if (duplicate) {
      if (duplicate.yearLevel !== body.yearLevel) {
        return reply.code(409).send({
          error: `Course code "${duplicate.courseCode}" is already used by ${duplicate.courseTitle} (curriculum year ${duplicate.yearLevel}).`,
        });
      }

      const existing = await loadSubject(duplicate.id);
      if (!existing) {
        return reply.code(500).send({ error: "Subject lookup failed." });
      }

      const linked = new Set(existing.programCourses.map((item) => item.programCourse));
      const toAdd = body.programCourses.filter((course) => !linked.has(course));

      if (toAdd.length === 0) {
        return reply.code(409).send({
          error: `Course code "${existing.courseCode}" is already used by ${existing.courseTitle}.`,
        });
      }

      await prisma.subjectProgramCourse.createMany({
        data: toAdd.map((programCourse) => ({
          subjectId: existing.id,
          programCourse,
        })),
      });

      const subject = await loadSubject(existing.id);
      return reply.code(200).send({ subject, linkedPrograms: true });
    }

    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          courseCode,
          courseTitle: body.courseTitle.trim(),
          yearLevel: body.yearLevel,
          createdById: user.id,
        },
      });

      await tx.subjectProgramCourse.createMany({
        data: body.programCourses.map((programCourse) => ({
          subjectId: created.id,
          programCourse,
        })),
      });

      return tx.subject.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          ...subjectProgramCoursesInclude,
          topics: true,
          _count: { select: { questions: true } },
        },
      });
    });

    return reply.code(201).send({ subject });
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const body = subjectSchema.parse(request.body);
    await assertActiveProgramSlugs(body.programCourses);
    const courseCode = formatCourseCode(body.courseCode);
    if (!courseCode) {
      return reply.code(400).send({ error: "Course code is required." });
    }

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Subject not found." });

    const duplicate = await findDuplicateCourseCode(prisma, courseCode, id);
    if (duplicate) {
      return reply.code(409).send({
        error: `Course code "${duplicate.courseCode}" is already used by ${duplicate.courseTitle} (curriculum year ${duplicate.yearLevel}).`,
      });
    }

    try {
      const subject = await prisma.$transaction(async (tx) => {
        await tx.subject.update({
          where: { id },
          data: {
            courseCode,
            courseTitle: body.courseTitle.trim(),
            yearLevel: body.yearLevel,
          },
        });

        await tx.subjectProgramCourse.deleteMany({ where: { subjectId: id } });
        await tx.subjectProgramCourse.createMany({
          data: body.programCourses.map((programCourse) => ({
            subjectId: id,
            programCourse,
          })),
        });

        return tx.subject.findUniqueOrThrow({
          where: { id },
          include: {
            ...subjectProgramCoursesInclude,
            topics: true,
            _count: { select: { questions: true } },
          },
        });
      });

      return { subject };
    } catch {
      return reply.code(409).send({
        error: `Course code "${courseCode}" is already in use.`,
      });
    }
  });

  app.post("/bulk-delete", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = bulkDeleteSubjectsSchema.parse(request.body);
    const result = await bulkDeleteSubjects(body.ids);

    if (result.deleted === 0) {
      return reply.code(400).send({
        error: "No subjects were deleted.",
        ...result,
      });
    }

    return result;
  });

  app.post("/delete-all", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const body = deleteAllSubjectsSchema.parse(request.body);
    const validPassword = await verifyUserPassword(user.id, body.password);
    if (!validPassword) {
      return reply.code(403).send({ error: "Incorrect password." });
    }

    const subjects = body.ids?.length
      ? body.ids.map((id) => ({ id }))
      : await prisma.subject.findMany({
          where: {
            ...(body.yearLevel != null ? { yearLevel: body.yearLevel } : {}),
            ...(body.programCourse
              ? {
                  programCourses: {
                    some: { programCourse: body.programCourse },
                  },
                }
              : {}),
          },
          select: { id: true },
        });

    const result = await bulkDeleteSubjects(subjects.map((subject) => subject.id));
    if (result.deleted === 0) {
      return reply.code(400).send({
        error: "No subjects were deleted.",
        ...result,
      });
    }

    return result;
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.TEACHER, Role.SUPERADMIN]);

    const { id } = request.params as { id: string };
    const result = await deleteSubjectRecord(id);

    if (!result.success) {
      const status = result.error === "Subject not found." ? 404 : 400;
      return reply.code(status).send({ error: result.error });
    }

    return {
      success: true,
      archivedSets: result.archivedSets,
    };
  });
}
