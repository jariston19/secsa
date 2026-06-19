import { distributeItemsBalanced } from "./examItemDistribution";

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
