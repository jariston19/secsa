import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export type QuestionDuplicateInput = {
  subjectId: string;
  topicId?: string | null;
  text: string;
};

export type QuestionDuplicateLookupInput = QuestionDuplicateInput & {
  excludeId?: string;
};

export function normalizeQuestionText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function questionDuplicateKey(input: QuestionDuplicateInput) {
  return [
    input.subjectId,
    input.topicId ?? "NO_TOPIC",
    normalizeQuestionText(input.text),
  ].join("::");
}

export async function findDuplicateQuestion(
  prisma: PrismaClientLike,
  input: QuestionDuplicateLookupInput
) {
  const normalizedText = normalizeQuestionText(input.text);
  if (!normalizedText) return null;

  const candidates = await prisma.question.findMany({
    where: {
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
      text: true,
    },
  });

  return (
    candidates.find((question) => normalizeQuestionText(question.text) === normalizedText) ?? null
  );
}

