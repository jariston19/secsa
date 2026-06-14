export const SCORE_DISTRIBUTION_BUCKETS = Array.from({ length: 10 }, (_, index) => {
  const min = index * 10;
  const max = index === 9 ? 100 : min + 9.99;
  const label = index === 9 ? "90–100%" : `${min}–${min + 9}%`;

  return { label, min, max };
});

export function countStudentsInScoreBuckets(
  scores: number[],
  buckets = SCORE_DISTRIBUTION_BUCKETS
) {
  return buckets.map((bucket) => ({
    label: bucket.label,
    students: scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  }));
}
