import { type PrismaClient } from "@prisma/client";
import { bloomLevelForSeed } from "../src/lib/bloomLevel.js";

export async function ensureAllQuestionBloomLevels(prisma: PrismaClient) {
  const questions = await prisma.question.findMany({
    select: { id: true, difficulty: true, bloomLevel: true, text: true, topicId: true, subjectId: true },
    orderBy: [{ subjectId: "asc" }, { topicId: "asc" }, { createdAt: "asc" }],
  });

  let updated = 0;
  let topicIndex = 0;
  let lastTopicKey = "";

  for (const question of questions) {
    if (question.text.startsWith("[Demo]")) continue;

    const topicKey = `${question.subjectId}:${question.topicId ?? "none"}`;
    if (topicKey !== lastTopicKey) {
      lastTopicKey = topicKey;
      topicIndex = 0;
    }

    const target = bloomLevelForSeed(question.difficulty, topicIndex);
    topicIndex += 1;
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
