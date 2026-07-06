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

export function toneClass(tone: ScoreTone) {
  return `chart-tone-${tone}`;
}
