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

function expandRowsForBandTargets<
  T extends { itemCount: number; sortKey?: string; key?: string },
>(
  rows: T[],
  bandTargets: ExamDifficultyCounts,
  pools: TopicDifficultyPool | TopicDifficultyPool[]
): Array<T & ExamDifficultyCounts> {
  if (rows.length === 0) return [];

  const itemCounts = rows.map((row) => row.itemCount);
  const sortKeys = rows.map((row, index) => row.sortKey ?? String(index));
  const perRowPools = Array.isArray(pools);
  const poolList = perRowPools ? pools : rows.map(() => pools);

  const subjectTotal = itemCounts.reduce((sum, count) => sum + count, 0);
  if (subjectTotal <= 0) {
    return rows.map((row) => ({
      ...row,
      easyCount: 0,
      mediumCount: 0,
      hardCount: 0,
    }));
  }

  const hardCaps = perRowPools
    ? itemCounts.map((count, index) => Math.min(count, poolList[index]?.hard ?? 0))
    : itemCounts;
  const maxHard = perRowPools
    ? hardCaps.reduce((sum, count) => sum + count, 0)
    : Math.min(pools.hard, subjectTotal);
  const hardTarget = Math.min(bandTargets.hardCount, maxHard, subjectTotal);
  const hardCounts = distributeDifficultyBucket(hardCaps, hardTarget, sortKeys);
  const hardShortfall = bandTargets.hardCount - hardCounts.reduce((sum, count) => sum + count, 0);

  const remainingAfterHard = itemCounts.map((count, index) => count - hardCounts[index]);
  const remainingTotal = remainingAfterHard.reduce((sum, count) => sum + count, 0);
  const mediumCaps = perRowPools
    ? remainingAfterHard.map((count, index) => Math.min(count, poolList[index]?.medium ?? 0))
    : remainingAfterHard;
  const maxMedium = perRowPools
    ? mediumCaps.reduce((sum, count) => sum + count, 0)
    : Math.min(pools.medium, remainingTotal);
  const mediumTarget = Math.min(bandTargets.mediumCount + hardShortfall, maxMedium, remainingTotal);
  const mediumCounts = distributeDifficultyBucket(mediumCaps, mediumTarget, sortKeys);

  return rows.map((row, index) => {
    const hardCount = hardCounts[index] ?? 0;
    const mediumCount = mediumCounts[index] ?? 0;
    return {
      ...row,
      hardCount,
      mediumCount,
      easyCount: itemCounts[index] - hardCount - mediumCount,
    };
  });
}

export type ExamSubjectDifficultyInput = {
  subjectId: string;
  sortKey?: string;
  itemCount: number;
  pool: TopicDifficultyPool;
  topics: Array<{ key: string; itemCount: number; sortKey?: string }>;
};

/** Apply 30/50/20 to the exam total, apportion by subject, then split across topics. */
export function expandExamDifficultyAllocations(subjects: ExamSubjectDifficultyInput[]) {
  const result = new Map<
    string,
    ExamDifficultyCounts & { subjectShortfall: SubjectDifficultyShortfall }
  >();

  const examTotal = subjects.reduce((sum, subject) => sum + subject.itemCount, 0);
  if (examTotal <= 0) return result;

  const examTargets = difficultyCountsForTotal(examTotal);
  const subjectPools = subjects.map((subject) => subject.pool);

  const subjectBandRows = expandRowsForBandTargets(
    subjects.map((subject) => ({
      itemCount: subject.itemCount,
      sortKey: subject.sortKey ?? subject.subjectId,
    })),
    examTargets,
    subjectPools
  );

  subjects.forEach((subject, index) => {
    const bandTargets = subjectBandRows[index] ?? {
      easyCount: 0,
      mediumCount: 0,
      hardCount: 0,
    };
    const subjectShortfall: SubjectDifficultyShortfall = {
      easy: Math.max(0, bandTargets.easyCount - subject.pool.easy),
      medium: Math.max(0, bandTargets.mediumCount - subject.pool.medium),
      hard: Math.max(0, bandTargets.hardCount - subject.pool.hard),
    };

    const topicRows = expandRowsForBandTargets(
      subject.topics.filter((topic) => topic.itemCount > 0),
      bandTargets,
      subject.pool
    );

    for (const row of topicRows) {
      if (!row.key) continue;
      result.set(row.key, {
        easyCount: row.easyCount,
        mediumCount: row.mediumCount,
        hardCount: row.hardCount,
        subjectShortfall,
      });
    }
  });

  return result;
}

/** Apply 30/50/20 to the config total, rebalance across rows using real pool caps. */
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

  const topicRows = expandRowsForBandTargets(
    configs.map((config, index) => ({
      itemCount: config.itemCount,
      sortKey: config.sortKey ?? String(index),
    })),
    targets,
    poolTotals
  );

  return configs.map((config, index) => ({
    ...config,
    easyCount: topicRows[index]?.easyCount ?? 0,
    mediumCount: topicRows[index]?.mediumCount ?? 0,
    hardCount: topicRows[index]?.hardCount ?? 0,
    subjectShortfall,
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
