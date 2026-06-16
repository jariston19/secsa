import { type PrismaClient } from "@prisma/client";
import { bloomLevelForSeed } from "../src/lib/bloomLevel.js";

export async function ensureAllQuestionBloomLevels(prisma: PrismaClient) {
  const questions = await prisma.question.findMany({
    select: { id: true, difficulty: true, bloomLevel: true },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;

  for (const [index, question] of questions.entries()) {
    const target = bloomLevelForSeed(question.difficulty, index);
    if (question.bloomLevel !== target) {
      await prisma.question.update({
        where: { id: question.id },
        data: { bloomLevel: target },
      });
      updated += 1;
    }
  }

  return updated;
}
