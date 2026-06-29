import { QuestionSetStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { uploadDir } from "../lib/paths.js";

export async function verifyUserPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

type DeleteSuccess = { success: true; archivedSets: number };
type DeleteFailure = { success: false; error: string };

export async function deleteSubjectRecord(id: string): Promise<DeleteSuccess | DeleteFailure> {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      questions: { select: { id: true, imagePath: true } },
    },
  });

  if (!subject) {
    return { success: false, error: "Subject not found." };
  }

  const usedInExams = await prisma.examAnswer.findFirst({
    where: {
      question: { subjectId: id },
      selectedOption: { not: null },
    },
  });

  if (usedInExams) {
    return {
      success: false,
      error: "Cannot delete because its questions were already used in student exams.",
    };
  }

  const deployedConfigs = await prisma.questionSetConfig.findMany({
    where: {
      subjectId: id,
      questionSet: { status: QuestionSetStatus.DEPLOYED },
    },
    select: { questionSetId: true },
  });

  const deployedSetIds = [...new Set(deployedConfigs.map((config) => config.questionSetId))];

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

  return { success: true, archivedSets: deployedSetIds.length };
}

export async function deleteTopicRecord(id: string): Promise<DeleteSuccess | DeleteFailure> {
  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      questions: { select: { imagePath: true } },
    },
  });

  if (!topic) {
    return { success: false, error: "Topic not found." };
  }

  const usedInExams = await prisma.examAnswer.findFirst({
    where: {
      question: { topicId: id },
      selectedOption: { not: null },
    },
  });

  if (usedInExams) {
    return {
      success: false,
      error: "Cannot delete because its questions were already used in student exams.",
    };
  }

  const deployedConfigs = await prisma.questionSetConfig.findMany({
    where: {
      topicId: id,
      questionSet: { status: QuestionSetStatus.DEPLOYED },
    },
    select: { questionSetId: true },
  });

  const deployedSetIds = [...new Set(deployedConfigs.map((config) => config.questionSetId))];

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
    prisma.question.deleteMany({ where: { topicId: id } }),
    prisma.topic.delete({ where: { id } }),
  ]);

  return { success: true, archivedSets: deployedSetIds.length };
}

export async function bulkDeleteSubjects(ids: string[]) {
  let deleted = 0;
  let archivedSets = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const result = await deleteSubjectRecord(id);
    if (result.success) {
      deleted += 1;
      archivedSets += result.archivedSets;
    } else {
      failed.push({ id, error: result.error });
    }
  }

  return { deleted, archivedSets, failed };
}

export async function bulkDeleteTopics(ids: string[]) {
  let deleted = 0;
  let archivedSets = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const result = await deleteTopicRecord(id);
    if (result.success) {
      deleted += 1;
      archivedSets += result.archivedSets;
    } else {
      failed.push({ id, error: result.error });
    }
  }

  return { deleted, archivedSets, failed };
}
