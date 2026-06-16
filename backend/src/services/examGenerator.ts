import { BloomLevel, Difficulty, type Question, type QuestionSetConfig } from "@prisma/client";
import { BLOOM_LEVEL_ORDER } from "../lib/bloomLevel.js";
import { prisma } from "../lib/prisma.js";

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function distributeCountAcrossSlots(slotCount: number, total: number) {
  const counts: number[] = [];
  let remaining = total;

  for (let index = 0; index < slotCount; index += 1) {
    const slotsLeft = slotCount - index;
    const share = Math.ceil(remaining / slotsLeft);
    counts.push(share);
    remaining -= share;
  }

  return counts;
}

function pickBalancedByDomain(pool: Question[], count: number): Question[] {
  if (count <= 0) return [];
  if (pool.length <= count) return shuffle(pool);

  const domainsPresent = BLOOM_LEVEL_ORDER.filter((domain) =>
    pool.some((question) => question.bloomLevel === domain)
  );
  const domainTargets = distributeCountAcrossSlots(domainsPresent.length, count);
  const selected: Question[] = [];
  const usedIds = new Set<string>();

  for (const [index, domain] of domainsPresent.entries()) {
    const need = domainTargets[index] ?? 0;
    const domainPool = pool.filter(
      (question) => question.bloomLevel === domain && !usedIds.has(question.id)
    );
    for (const question of shuffle(domainPool).slice(0, need)) {
      usedIds.add(question.id);
      selected.push(question);
    }
  }

  if (selected.length < count) {
    const remainder = pool.filter((question) => !usedIds.has(question.id));
    for (const question of shuffle(remainder).slice(0, count - selected.length)) {
      selected.push(question);
    }
  }

  return selected.slice(0, count);
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

function domainLabel(domain: BloomLevel) {
  return domain.toLowerCase();
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
        continue;
      }

      const domainsPresent = BLOOM_LEVEL_ORDER.filter((domain) =>
        pool.some((question) => question.bloomLevel === domain)
      );
      const domainTargets = distributeCountAcrossSlots(domainsPresent.length, count);
      for (const [index, domain] of domainsPresent.entries()) {
        const need = domainTargets[index] ?? 0;
        const available = pool.filter((question) => question.bloomLevel === domain).length;
        if (available < need) {
          errors.push(
            `${label} needs ${need} ${domainLabel(domain)} domain question(s) within ${difficulty.toLowerCase()} but only ${available} available.`
          );
        }
      }
    }
  }

  return errors;
}

export async function generateCanonicalExamQuestions(
  configs: QuestionSetConfig[]
): Promise<Question[]> {
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
      selected.push(...pickBalancedByDomain(pool, count));
    }
  }

  return selected;
}

export async function resolveCanonicalQuestionIds(questionSet: {
  id: string;
  examQuestionIds: string | null;
  configs: QuestionSetConfig[];
}) {
  if (questionSet.examQuestionIds) {
    try {
      const ids = JSON.parse(questionSet.examQuestionIds) as string[];
      if (ids.length > 0) return ids;
    } catch {
      // fall through and rebuild the canonical set
    }
  }

  const questions = await generateCanonicalExamQuestions(questionSet.configs);
  const ids = questions.map((question) => question.id);

  await prisma.questionSet.update({
    where: { id: questionSet.id },
    data: { examQuestionIds: JSON.stringify(ids) },
  });

  return ids;
}

export async function loadQuestionsInOrder(ids: string[]) {
  const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
  const map = new Map(questions.map((question) => [question.id, question]));
  return ids.map((id) => map.get(id)).filter((question): question is Question => Boolean(question));
}

export async function prepareAttemptExamQuestions(questionSet: {
  id: string;
  examQuestionIds: string | null;
  configs: QuestionSetConfig[];
}) {
  const canonicalIds = await resolveCanonicalQuestionIds(questionSet);
  const orderedIds = shuffle(canonicalIds);
  const questions = await loadQuestionsInOrder(orderedIds);
  return { orderedIds, questions };
}

/** @deprecated Use prepareAttemptExamQuestions for student attempts. */
export async function generateExamQuestions(configs: QuestionSetConfig[]): Promise<Question[]> {
  return shuffle(await generateCanonicalExamQuestions(configs));
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
