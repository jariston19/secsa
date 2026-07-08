import { BloomLevel, Difficulty, type Question, type QuestionSetConfig } from "@prisma/client";
import { BLOOM_LEVELS_BY_DIFFICULTY } from "../lib/bloomLevel.js";
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

function pickBalancedByDomain(
  pool: Question[],
  count: number,
  difficulty: Difficulty
): Question[] {
  if (count <= 0) return [];
  if (pool.length <= count) return shuffle(pool);

  const requiredDomains = BLOOM_LEVELS_BY_DIFFICULTY[difficulty];
  const domainTargets = distributeCountAcrossSlots(requiredDomains.length, count);
  const selected: Question[] = [];
  const usedIds = new Set<string>();

  for (const [index, domain] of requiredDomains.entries()) {
    const need = domainTargets[index] ?? 0;
    if (need <= 0) continue;
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

async function getPoolAcrossSubjects(subjectIds: string[], difficulty: Difficulty) {
  if (subjectIds.length === 0) return [];
  return prisma.question.findMany({
    where: {
      subjectId: { in: subjectIds },
      difficulty,
    },
  });
}

function filterUnused(pool: Question[], usedIds: Set<string>, excludeIds: Set<string> = new Set()) {
  return pool.filter((question) => !usedIds.has(question.id) && !excludeIds.has(question.id));
}

async function pickForConfig(
  config: QuestionSetConfig,
  difficulty: Difficulty,
  count: number,
  usedIds: Set<string>,
  subjectIdsInSet: string[]
): Promise<Question[]> {
  if (count <= 0) return [];

  const topicPool = filterUnused(
    await getPool(config.subjectId, config.topicId, difficulty),
    usedIds
  );
  let picked = pickBalancedByDomain(topicPool, count, difficulty);
  for (const question of picked) usedIds.add(question.id);

  if (picked.length >= count) return picked.slice(0, count);

  const pickedIds = new Set(picked.map((question) => question.id));
  const subjectPool = filterUnused(
    await getPool(config.subjectId, null, difficulty),
    usedIds,
    pickedIds
  );
  const subjectPicked = pickBalancedByDomain(subjectPool, count - picked.length, difficulty);
  for (const question of subjectPicked) usedIds.add(question.id);
  picked = [...picked, ...subjectPicked];

  if (picked.length >= count) return picked.slice(0, count);

  const pickedSoFar = new Set(picked.map((question) => question.id));
  const examPool = filterUnused(
    await getPoolAcrossSubjects(subjectIdsInSet, difficulty),
    usedIds,
    pickedSoFar
  );
  const examPicked = pickBalancedByDomain(examPool, count - picked.length, difficulty);
  for (const question of examPicked) usedIds.add(question.id);
  picked = [...picked, ...examPicked];

  return picked.slice(0, count);
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

  const requiredByDifficulty: Record<Difficulty, number> = {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
  };

  for (const config of configs) {
    requiredByDifficulty[Difficulty.EASY] += config.easyCount;
    requiredByDifficulty[Difficulty.MEDIUM] += config.mediumCount;
    requiredByDifficulty[Difficulty.HARD] += config.hardCount;
  }

  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    const required = requiredByDifficulty[difficulty];
    if (required <= 0) continue;

    const pool = await getPoolAcrossSubjects(subjectIds, difficulty);
    if (pool.length < required) {
      errors.push(
        `Set needs ${required} ${difficulty.toLowerCase()} questions but only ${pool.length} available across all subjects.`
      );
      continue;
    }

    const requiredDomains = BLOOM_LEVELS_BY_DIFFICULTY[difficulty];
    const domainTargets = distributeCountAcrossSlots(requiredDomains.length, required);
    for (const [index, domain] of requiredDomains.entries()) {
      const need = domainTargets[index] ?? 0;
      if (need <= 0) continue;
      const available = pool.filter((question) => question.bloomLevel === domain).length;
      if (available < need) {
        errors.push(
          `Set needs ${need} ${domainLabel(domain)} domain question(s) within ${difficulty.toLowerCase()} but only ${available} available across all subjects.`
        );
      }
    }
  }

  return errors;
}

export async function generateCanonicalExamQuestions(
  configs: QuestionSetConfig[]
): Promise<Question[]> {
  const selected: Question[] = [];
  const usedIds = new Set<string>();
  const subjectIdsInSet = [...new Set(configs.map((config) => config.subjectId))];

  for (const config of configs) {
    const buckets: Array<[Difficulty, number]> = [
      [Difficulty.EASY, config.easyCount],
      [Difficulty.MEDIUM, config.mediumCount],
      [Difficulty.HARD, config.hardCount],
    ];

    for (const [difficulty, count] of buckets) {
      if (count <= 0) continue;
      const picked = await pickForConfig(config, difficulty, count, usedIds, subjectIdsInSet);
      if (picked.length < count) {
        throw new Error(
          `Could not fill ${count} ${difficulty.toLowerCase()} question(s) for subject ${config.subjectId}.`
        );
      }
      selected.push(...picked);
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

const questionPreviewInclude = {
  subject: { select: { courseCode: true, courseTitle: true } },
  topic: { select: { name: true } },
} as const;

export type QuestionPreviewRow = Question & {
  subject: { courseCode: string; courseTitle: string };
  topic: { name: string } | null;
};

export async function loadQuestionsInOrderWithDetails(ids: string[]) {
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: questionPreviewInclude,
  });
  const map = new Map(questions.map((question) => [question.id, question]));
  return ids
    .map((id) => map.get(id))
    .filter((question): question is QuestionPreviewRow => Boolean(question));
}

export async function resolvePreviewExamQuestions(
  configs: QuestionSetConfig[],
  examQuestionIds: string | null
): Promise<Question[]> {
  if (examQuestionIds) {
    try {
      const ids = JSON.parse(examQuestionIds) as string[];
      if (ids.length > 0) {
        const questions = await loadQuestionsInOrder(ids);
        if (questions.length > 0) return questions;
      }
    } catch {
      // fall through and build a fresh canonical preview set
    }
  }

  return generateCanonicalExamQuestions(configs);
}

export function splitQuestionsAcrossConfigs<T extends Question>(
  configs: QuestionSetConfig[],
  questions: T[]
): T[][] {
  const sections: T[][] = [];
  let index = 0;

  for (const config of configs) {
    const count = config.easyCount + config.mediumCount + config.hardCount;
    sections.push(questions.slice(index, index + count));
    index += count;
  }

  return sections;
}

export function mapQuestionForPreview(question: QuestionPreviewRow) {
  return {
    id: question.id,
    text: question.text,
    difficulty: question.difficulty,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctOption: question.correctOption,
    imagePath: question.imagePath,
    topic: question.topic?.name ?? null,
    subject: `${question.subject.courseCode} ${question.subject.courseTitle}`,
  };
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
    passThreshold,
    passed: percentage >= passThreshold,
  };
}
