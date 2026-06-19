import { distributeItemsBalanced } from "./examItemDistribution.js";

export const EXAM_DIFFICULTY_WEIGHTS = {
  easy: 0.3,
  medium: 0.5,
  hard: 0.2,
} as const;

export type ExamDifficultyCounts = {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
};

export function difficultyCountsForTotal(totalItems: number): ExamDifficultyCounts {
  if (totalItems <= 0) {
    return { easyCount: 0, mediumCount: 0, hardCount: 0 };
  }
  if (totalItems === 1) {
    return { easyCount: 1, mediumCount: 0, hardCount: 0 };
  }
  if (totalItems === 2) {
    return { easyCount: 1, mediumCount: 1, hardCount: 0 };
  }

  const easyCount = Math.round(totalItems * EXAM_DIFFICULTY_WEIGHTS.easy);
  const mediumCount = Math.round(totalItems * EXAM_DIFFICULTY_WEIGHTS.medium);
  const hardCount = totalItems - easyCount - mediumCount;

  return { easyCount, mediumCount, hardCount };
}

/** Split a difficulty bucket across topics, respecting capacity and stable sort order. */
export function distributeDifficultyBucket(
  topicCapacities: number[],
  bucketTotal: number,
  sortKeys?: string[]
) {
  const result = topicCapacities.map(() => 0);
  let remaining = bucketTotal;
  let capacities = [...topicCapacities];

  while (remaining > 0) {
    const active = capacities
      .map((capacity, index) => ({
        index,
        capacity,
        key: sortKeys?.[index] ?? String(index),
      }))
      .filter((slot) => slot.capacity > 0)
      .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index);
    if (active.length === 0) break;

    const shares = distributeItemsBalanced(active.length, remaining);
    let assigned = 0;

    for (let slotIndex = 0; slotIndex < active.length; slotIndex += 1) {
      const { index, capacity } = active[slotIndex];
      const share = shares[slotIndex] ?? 0;
      const give = Math.min(share, capacity);
      if (give <= 0) continue;
      result[index] += give;
      capacities[index] -= give;
      assigned += give;
    }

    if (assigned === 0) break;
    remaining -= assigned;
  }

  return result;
}

/** Apply 30/50/20 at subject level, then spread each bucket across topic rows. */
export function expandTopicConfigsWithSubjectDifficulty<
  T extends { itemCount: number; sortKey?: string },
>(configs: T[]): Array<T & ExamDifficultyCounts> {
  const subjectTotal = configs.reduce((sum, config) => sum + config.itemCount, 0);
  if (subjectTotal <= 0) {
    return configs.map((config) => ({
      ...config,
      easyCount: 0,
      mediumCount: 0,
      hardCount: 0,
    }));
  }

  const targets = difficultyCountsForTotal(subjectTotal);
  const itemCounts = configs.map((config) => config.itemCount);
  const sortKeys = configs.map((config, index) => config.sortKey ?? String(index));

  const hardCounts = distributeDifficultyBucket(itemCounts, targets.hardCount, sortKeys);
  const remainingAfterHard = itemCounts.map((count, index) => count - hardCounts[index]);
  const mediumCounts = distributeDifficultyBucket(
    remainingAfterHard,
    targets.mediumCount,
    sortKeys
  );
  const easyCounts = itemCounts.map(
    (count, index) => count - hardCounts[index] - mediumCounts[index]
  );

  return configs.map((config, index) => ({
    ...config,
    easyCount: easyCounts[index],
    mediumCount: mediumCounts[index],
    hardCount: hardCounts[index],
  }));
}

export function configItemTotal(counts: ExamDifficultyCounts) {
  return counts.easyCount + counts.mediumCount + counts.hardCount;
}

export function matchesDifficultyDistribution(counts: ExamDifficultyCounts) {
  const total = configItemTotal(counts);
  if (total <= 0) return counts.easyCount === 0 && counts.mediumCount === 0 && counts.hardCount === 0;

  const expected = difficultyCountsForTotal(total);
  return (
    counts.easyCount === expected.easyCount &&
    counts.mediumCount === expected.mediumCount &&
    counts.hardCount === expected.hardCount
  );
}

export function expandConfigItemCount(itemCount: number) {
  return difficultyCountsForTotal(itemCount);
}

export function expandConfigsWithSubjectDifficulty<
  T extends { subjectId: string; topicId?: string | null; itemCount: number },
>(configs: T[]) {
  const filtered = configs.filter((config) => config.itemCount > 0);
  const bySubject = new Map<string, T[]>();

  for (const config of filtered) {
    const subjectConfigs = bySubject.get(config.subjectId) ?? [];
    subjectConfigs.push(config);
    bySubject.set(config.subjectId, subjectConfigs);
  }

  const expanded: Array<T & ExamDifficultyCounts> = [];
  for (const subjectId of [...bySubject.keys()].sort()) {
    const subjectConfigs = bySubject.get(subjectId) ?? [];
    expanded.push(
      ...expandTopicConfigsWithSubjectDifficulty(
        subjectConfigs.map((config) => ({
          ...config,
          sortKey: config.topicId ?? "whole-subject",
        }))
      )
    );
  }

  return expanded;
}
