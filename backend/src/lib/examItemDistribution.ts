/** Even split: every slot gets floor(n/k) or ceil(n/k); extras differ by at most 1. */
export function distributeItemsBalanced(slotCount: number, totalItems: number) {
  if (slotCount <= 0 || totalItems <= 0) return [];

  const base = Math.floor(totalItems / slotCount);
  const extra = totalItems % slotCount;

  return Array.from({ length: slotCount }, (_, index) => base + (index < extra ? 1 : 0));
}

/** Assign balanced counts independent of input order using a stable sort key. */
export function assignBalancedCounts<T>(
  items: readonly T[],
  totalItems: number,
  sortKey: (item: T) => string
) {
  if (items.length === 0) return [];

  const balanced = distributeItemsBalanced(items.length, totalItems);
  const order = items
    .map((item, index) => ({ index, key: sortKey(item) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index);

  const counts = new Array<number>(items.length).fill(0);
  order.forEach(({ index }, rank) => {
    counts[index] = balanced[rank] ?? 0;
  });

  return counts;
}

export function distributeItemsAcrossSlots(slotCount: number, totalItems: number) {
  return distributeItemsBalanced(slotCount, totalItems);
}

export type TopicAllocation = {
  subjectId: string;
  topicId: string | null;
  itemCount: number;
};

export function buildExamAllocations(
  examTotalItems: number,
  subjects: Array<{
    subjectId: string;
    sortKey?: string;
    topics: Array<{ topicId: string }>;
  }>
): TopicAllocation[] {
  if (examTotalItems <= 0 || subjects.length === 0) return [];

  const perSubject = assignBalancedCounts(
    subjects,
    examTotalItems,
    (subject) => subject.sortKey ?? subject.subjectId
  );
  const allocations: TopicAllocation[] = [];

  for (const [index, subject] of subjects.entries()) {
    const subjectTotal = perSubject[index] ?? 0;
    const topicSlots =
      subject.topics.length > 0
        ? subject.topics.map((topic) => ({ topicId: topic.topicId }))
        : [{ topicId: null as string | null }];

    const perTopic = assignBalancedCounts(
      topicSlots,
      subjectTotal,
      (slot) => slot.topicId ?? "whole-subject"
    );

    for (const [topicIndex, slot] of topicSlots.entries()) {
      allocations.push({
        subjectId: subject.subjectId,
        topicId: slot.topicId,
        itemCount: perTopic[topicIndex] ?? 0,
      });
    }
  }

  return allocations;
}
