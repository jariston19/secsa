import type { Prisma, PrismaClient } from "@prisma/client";
import { uploadDir } from "../lib/paths.js";
import { resolveQuestionImageHash } from "./imageUpload.js";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export type QuestionDuplicateInput = {
  subjectId: string;
  topicId?: string | null;
  text: string;
  imageHash?: string | null;
};

export type QuestionDuplicateLookupInput = QuestionDuplicateInput & {
  excludeId?: string;
};

export function normalizeQuestionText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function questionsAreDuplicates(
  textA: string,
  imageHashA: string | null | undefined,
  textB: string,
  imageHashB: string | null | undefined
) {
  if (normalizeQuestionText(textA) !== normalizeQuestionText(textB)) return false;
  return (imageHashA ?? null) === (imageHashB ?? null);
}

export function questionDuplicateKey(input: QuestionDuplicateInput) {
  return [
    input.subjectId,
    input.topicId ?? "NO_TOPIC",
    normalizeQuestionText(input.text),
    input.imageHash ?? "NO_IMAGE",
  ].join("::");
}

export async function findDuplicateQuestion(
  prisma: PrismaClientLike,
  input: QuestionDuplicateLookupInput
) {
  const normalizedText = normalizeQuestionText(input.text);
  if (!normalizedText) return null;

  const inputHash = input.imageHash ?? null;

  const candidates = await prisma.question.findMany({
    where: {
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
      text: true,
      imageHash: true,
      imagePath: true,
    },
  });

  for (const candidate of candidates) {
    if (normalizeQuestionText(candidate.text) !== normalizedText) continue;

    const candidateHash = await resolveQuestionImageHash(candidate, uploadDir);
    if ((inputHash ?? null) === (candidateHash ?? null)) {
      return { id: candidate.id, text: candidate.text };
    }
  }

  return null;
}
