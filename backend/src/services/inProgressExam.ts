import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type InProgressExamAttempt = Prisma.ExamAttemptGetPayload<{
  include: { questionSet: { select: { timeLimitMinutes: true } } };
}>;

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export async function findInProgressAttempt(
  studentId: string,
  client: PrismaClientLike = prisma
): Promise<InProgressExamAttempt | null> {
  return client.examAttempt.findFirst({
    where: { studentId, submittedAt: null },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    include: { questionSet: { select: { timeLimitMinutes: true } } },
  });
}

export async function createExamAttemptIfNoneInProgress<T>(
  studentId: string,
  create: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<{ type: "resume"; attempt: InProgressExamAttempt } | { type: "created"; result: T }> {
  return prisma.$transaction(async (tx) => {
    const existing = await findInProgressAttempt(studentId, tx);
    if (existing) {
      return { type: "resume" as const, attempt: existing };
    }

    const result = await create(tx);
    return { type: "created" as const, result };
  });
}
