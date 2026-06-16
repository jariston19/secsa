import { QuestionSetStatus, type PrismaClient } from "@prisma/client";
import { resolveCanonicalQuestionIds } from "../src/services/examGenerator.js";

export async function ensureDeployedExamPools(prisma: PrismaClient) {
  const deployedSets = await prisma.questionSet.findMany({
    where: { status: QuestionSetStatus.DEPLOYED },
    include: { configs: true },
  });

  let updated = 0;

  for (const questionSet of deployedSets) {
    if (questionSet.examQuestionIds) continue;
    await resolveCanonicalQuestionIds(questionSet);
    updated += 1;
  }

  return updated;
}
