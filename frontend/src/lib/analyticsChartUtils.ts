export type ScoreTone = "strong" | "moderate" | "weak";

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
  if (tone === "strong") return "#22c55e";
  if (tone === "moderate") return "#f59e0b";
  return "#ef4444";
}

export function scoreToTone(score: number): ScoreTone {
  if (score >= 75) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

export function toneClass(tone: ScoreTone) {
  return `chart-tone-${tone}`;
}
