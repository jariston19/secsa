import type { FastifyInstance } from "fastify";
import { QuestionSetStatus, Role } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { uploadDir } from "../lib/paths.js";
import { programCourseSchema } from "../lib/programCourse.js";
import {
  programCoursesSchema,
  subjectProgramCoursesInclude,
} from "../lib/subjectPrograms.js";
import { yearLevelSchema } from "../lib/yearLevel.js";

const subjectSchema = z.object({
  courseCode: z.string().min(1),
  courseTitle: z.string().min(1),
  yearLevel: yearLevelSchema,
  programCourses: programCoursesSchema,
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
                some: { programCourse: programCourseSchema.parse(programCourseRaw) },
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
    const existing = await prisma.subject.findUnique({
      where: {
        courseCode_yearLevel: {
          courseCode: body.courseCode,
          yearLevel: body.yearLevel,
        },
      },
      include: subjectProgramCoursesInclude,
    });

    if (existing) {
      const linked = new Set(existing.programCourses.map((item) => item.programCourse));
      const toAdd = body.programCourses.filter((course) => !linked.has(course));

      if (toAdd.length === 0) {
        return reply.code(400).send({
          error: "This subject already exists for the selected program course(s).",
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
          courseCode: body.courseCode,
          courseTitle: body.courseTitle,
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

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Subject not found." });

    try {
      const subject = await prisma.$transaction(async (tx) => {
        await tx.subject.update({
          where: { id },
          data: {
            courseCode: body.courseCode,
            courseTitle: body.courseTitle,
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
