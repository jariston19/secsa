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

export type TopicDifficultyPool = {
  easy: number;
  medium: number;
  hard: number;
};

export type SubjectDifficultyShortfall = {
  easy: number;
  medium: number;
  hard: number;
};

type DifficultyCountField = "easyCount" | "mediumCount" | "hardCount";

const POOL_KEY_BY_FIELD: Record<DifficultyCountField, keyof TopicDifficultyPool> = {
  easyCount: "easy",
  mediumCount: "medium",
  hardCount: "hard",
};

function decreaseAlternateField(row: ExamDifficultyCounts, skip: DifficultyCountField) {
  const order = (["easyCount", "mediumCount", "hardCount"] as DifficultyCountField[]).filter(
    (field) => field !== skip
  );
  for (const field of order) {
    if (row[field] > 0) {
      row[field] -= 1;
      return true;
    }
  }
  return false;
}

function increaseAlternateField(
  row: ExamDifficultyCounts,
  pool: TopicDifficultyPool,
  skip: DifficultyCountField
) {
  const order = (["easyCount", "mediumCount", "hardCount"] as DifficultyCountField[]).filter(
    (field) => field !== skip
  );
  for (const field of order) {
    const poolKey = POOL_KEY_BY_FIELD[field];
    if (row[field] < pool[poolKey]) {
      row[field] += 1;
      return true;
    }
  }
  return false;
}

function findDonorIndex(
  rows: ExamDifficultyCounts[],
  pools: TopicDifficultyPool[],
  field: DifficultyCountField,
  deficientIndex: number,
  sortKeys: string[]
) {
  const poolKey = POOL_KEY_BY_FIELD[field];
  const candidates = rows
    .map((row, index) => ({ row, index, key: sortKeys[index] ?? String(index) }))
    .filter(({ index }) => index !== deficientIndex)
    .filter(({ row, index }) => row[field] < pools[index][poolKey])
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index);

  for (const { index } of candidates) {
    const donor = { ...rows[index] };
    donor[field] += 1;
    if (decreaseAlternateField(donor, field)) {
      return index;
    }
  }

  return -1;
}

function rebalanceRowsForPools(
  rows: ExamDifficultyCounts[],
  pools: TopicDifficultyPool[],
  sortKeys: string[]
) {
  const result = rows.map((row) => ({ ...row }));
  const fields: DifficultyCountField[] = ["hardCount", "mediumCount", "easyCount"];

  for (const field of fields) {
    const poolKey = POOL_KEY_BY_FIELD[field];
    let changed = true;

    while (changed) {
      changed = false;
      for (let index = 0; index < result.length; index += 1) {
        while (result[index][field] > pools[index][poolKey]) {
          result[index][field] -= 1;
          if (!increaseAlternateField(result[index], pools[index], field)) {
            result[index][field] += 1;
            break;
          }

          const donorIndex = findDonorIndex(result, pools, field, index, sortKeys);
          if (donorIndex < 0) {
            result[index][field] += 1;
            decreaseAlternateField(result[index], field);
            break;
          }

          result[donorIndex][field] += 1;
          if (!decreaseAlternateField(result[donorIndex], field)) {
            result[donorIndex][field] -= 1;
            result[index][field] += 1;
            decreaseAlternateField(result[index], field);
            break;
          }

          changed = true;
        }
      }
    }
  }

  return result;
}

function subjectPoolTotals(pools: TopicDifficultyPool[]) {
  return pools.reduce(
    (totals, pool) => ({
      easy: totals.easy + pool.easy,
      medium: totals.medium + pool.medium,
      hard: totals.hard + pool.hard,
    }),
    { easy: 0, medium: 0, hard: 0 }
  );
}

/** Apply 30/50/20 per subject, rebalance across topics using real pool caps. */
export function expandTopicConfigsWithPoolAwareDifficulty<
  T extends { itemCount: number; sortKey?: string; pool: TopicDifficultyPool },
>(configs: T[]): Array<T & ExamDifficultyCounts & { subjectShortfall: SubjectDifficultyShortfall }> {
  if (configs.length === 0) return [];

  const subjectTotal = configs.reduce((sum, config) => sum + config.itemCount, 0);
  if (subjectTotal <= 0) {
    return configs.map((config) => ({
      ...config,
      easyCount: 0,
      mediumCount: 0,
      hardCount: 0,
      subjectShortfall: { easy: 0, medium: 0, hard: 0 },
    }));
  }

  const targets = difficultyCountsForTotal(subjectTotal);
  const pools = configs.map((config) => config.pool);
  const poolTotals = subjectPoolTotals(pools);
  const subjectShortfall: SubjectDifficultyShortfall = {
    easy: Math.max(0, targets.easyCount - poolTotals.easy),
    medium: Math.max(0, targets.mediumCount - poolTotals.medium),
    hard: Math.max(0, targets.hardCount - poolTotals.hard),
  };

  const ideal = expandTopicConfigsWithSubjectDifficulty(
    configs.map((config) => ({ itemCount: config.itemCount, sortKey: config.sortKey }))
  );
  const sortKeys = configs.map((config, index) => config.sortKey ?? String(index));
  const rebalanced = rebalanceRowsForPools(ideal, pools, sortKeys);

  return configs.map((config, index) => ({
    ...config,
    easyCount: rebalanced[index]?.easyCount ?? 0,
    mediumCount: rebalanced[index]?.mediumCount ?? 0,
    hardCount: rebalanced[index]?.hardCount ?? 0,
    subjectShortfall,
  }));
}
