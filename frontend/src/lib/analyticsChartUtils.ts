export type ScoreTone = "strong" | "moderate" | "weak";

export const PASS_THRESHOLD = 75;

export const DIFFICULTY_COLORS = {
  EASY: "#22c55e",
  MEDIUM: "#f59e0b",
  HARD: "#ef4444",
} as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const EXPECTED_CORRECT_RANGES: Record<string, { min: number; max: number }> = {
  EASY: { min: 70, max: 95 },
  MEDIUM: { min: 45, max: 70 },
  HARD: { min: 20, max: 45 },
};

export function toneColor(tone: ScoreTone) {
  if (tone === "strong") return "#007aff";
  return "#ef4444";
}

export function scoreToTone(score: number): ScoreTone {
  return score >= PASS_THRESHOLD ? "strong" : "weak";
}

export function scoreDonutVariant(score: number): "default" | "risk" {
  return score >= PASS_THRESHOLD ? "default" : "risk";
}

export const SCORE_DISTRIBUTION_BUCKET_LABELS = [
  "0–9%",
  "10–19%",
  "20–29%",
  "30–39%",
  "40–49%",
  "50–59%",
  "60–69%",
  "70–79%",
  "80–89%",
  "90–100%",
] as const;

export function emptyScoreDistributionBuckets() {
  return SCORE_DISTRIBUTION_BUCKET_LABELS.map((label) => ({ label, students: 0 }));
}

export function normalizeScoreDistribution(
  buckets: Array<{ label: string; students: number }> | undefined
) {
  if (!buckets || buckets.length === 0) return emptyScoreDistributionBuckets();
  return buckets;
}

export function scoreDistributionTotal(
  buckets: Array<{ label: string; students: number }>
) {
  return buckets.reduce((sum, bucket) => sum + bucket.students, 0);
}

export function toneClass(tone: ScoreTone) {
  return `chart-tone-${tone}`;
}

export type ScoreQuartile = "critical" | "emerging" | "developing" | "strong";

export function scoreToQuartile(score: number): ScoreQuartile {
  if (score >= 75) return "strong";
  if (score >= 50) return "developing";
  if (score >= 25) return "emerging";
  return "critical";
}

export function scoreQuartileLabel(score: number) {
  switch (scoreToQuartile(score)) {
    case "strong":
      return "Strong";
    case "developing":
      return "Developing";
    case "emerging":
      return "Emerging";
    default:
      return "Needs focus";
  }
}

export function scoreQuartileBarColor(score: number) {
  switch (scoreToQuartile(score)) {
    case "strong":
      return "#007aff";
    case "developing":
      return "#ffcc00";
    case "emerging":
      return "#ff9500";
    default:
      return "#ff3b30";
  }
}

export function scoreQuartileColor(score: number) {
  switch (scoreToQuartile(score)) {
    case "strong":
      return "#007aff";
    case "developing":
      return "#ca8a04";
    case "emerging":
      return "#ff9500";
    default:
      return "#ff3b30";
  }
}

export function scoreQuartileBarStyle(score: number) {
  const width = Math.max(4, Math.min(100, score));
  return {
    width: `${width}%`,
    background: scoreQuartileBarColor(score),
  };
}
