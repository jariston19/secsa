import { Difficulty, type Question, type QuestionSetConfig } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom(pool: Question[], count: number): Question[] {
  if (count > pool.length) {
    throw new Error(`Not enough questions in pool. Need ${count}, have ${pool.length}.`);
  }
  return shuffle(pool).slice(0, count);
}

async function getPool(
  subjectId: string,
  topicId: string | null | undefined,
  difficulty: Difficulty
): Promise<Question[]> {
  return prisma.question.findMany({
    where: {
      subjectId,
      ...(topicId ? { topicId } : {}),
      difficulty,
    },
  });
}

export async function getConfigPoolQuestions(
  subjectId: string,
  topicId: string | null
) {
  return prisma.question.findMany({
    where: {
      subjectId,
      ...(topicId ? { topicId } : {}),
    },
    include: {
      subject: { select: { courseCode: true, courseTitle: true } },
      topic: { select: { name: true } },
    },
    orderBy: [{ difficulty: "asc" }, { createdAt: "desc" }],
  });
}

export async function validateQuestionSetConfigs(configs: QuestionSetConfig[]) {
  const errors: string[] = [];

  const subjectIds = [...new Set(configs.map((config) => config.subjectId))];
  const topicIds = [
    ...new Set(configs.map((config) => config.topicId).filter((id): id is string => Boolean(id))),
  ];

  const [subjects, topics] = await Promise.all([
    prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, courseCode: true },
    }),
    topicIds.length > 0
      ? prisma.topic.findMany({
          where: { id: { in: topicIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const subjectLabels = new Map(subjects.map((subject) => [subject.id, subject.courseCode]));
  const topicLabels = new Map(topics.map((topic) => [topic.id, topic.name]));

  for (const config of configs) {
    const courseCode = subjectLabels.get(config.subjectId) ?? "Unknown subject";
    const topicName = config.topicId ? topicLabels.get(config.topicId) : null;
    const label = config.topicId
      ? `${courseCode} — ${topicName ?? "Unknown topic"}`
      : `${courseCode} (whole subject)`;
    const checks: Array<[Difficulty, number]> = [
      [Difficulty.EASY, config.easyCount],
      [Difficulty.MEDIUM, config.mediumCount],
      [Difficulty.HARD, config.hardCount],
    ];

    for (const [difficulty, count] of checks) {
      if (count <= 0) continue;
      const pool = await getPool(config.subjectId, config.topicId, difficulty);
      if (pool.length < count) {
        errors.push(
          `${label} needs ${count} ${difficulty.toLowerCase()} questions but only ${pool.length} available.`
        );
      }
    }
  }

  return errors;
}

export async function generateExamQuestions(configs: QuestionSetConfig[]): Promise<Question[]> {
  const selected: Question[] = [];

  for (const config of configs) {
    const buckets: Array<[Difficulty, number]> = [
      [Difficulty.EASY, config.easyCount],
      [Difficulty.MEDIUM, config.mediumCount],
      [Difficulty.HARD, config.hardCount],
    ];

    for (const [difficulty, count] of buckets) {
      if (count <= 0) continue;
      const pool = await getPool(config.subjectId, config.topicId, difficulty);
      selected.push(...pickRandom(pool, count));
    }
  }

  return shuffle(selected);
}

export function calculateResult(score: number, totalItems: number, passThreshold: number) {
  const percentage = totalItems > 0 ? (score / totalItems) * 100 : 0;
  return {
    score,
    totalItems,
    percentage: Math.round(percentage * 100) / 100,
    passed: percentage >= passThreshold,
  };
}
