export const BLOOM_LEVEL_ORDER = [
  "KNOWLEDGE",
  "COMPREHENSION",
  "APPLICATION",
  "ANALYSIS",
  "SYNTHESIS",
  "EVALUATION",
] as const;

export type BloomLevelId = (typeof BLOOM_LEVEL_ORDER)[number];

export const BLOOM_LEVELS_BY_DIFFICULTY: Record<string, BloomLevelId[]> = {
  EASY: ["KNOWLEDGE", "COMPREHENSION"],
  MEDIUM: ["APPLICATION"],
  HARD: ["ANALYSIS", "SYNTHESIS", "EVALUATION"],
};

export const BLOOM_LEVEL_LABELS: Record<BloomLevelId, string> = {
  KNOWLEDGE: "L1 Knowledge",
  COMPREHENSION: "L2 Comprehension",
  APPLICATION: "L3 Application",
  ANALYSIS: "L4 Analysis",
  SYNTHESIS: "L5 Synthesis",
  EVALUATION: "L6 Evaluation",
};

export const BLOOM_LEVEL_SHORT_LABELS: Record<BloomLevelId, string> = {
  KNOWLEDGE: "L1",
  COMPREHENSION: "L2",
  APPLICATION: "L3",
  ANALYSIS: "L4",
  SYNTHESIS: "L5",
  EVALUATION: "L6",
};

export const BLOOM_LEVEL_COLORS: Record<BloomLevelId, string> = {
  KNOWLEDGE: "#1d4ed8",
  COMPREHENSION: "#0891b2",
  APPLICATION: "#15803d",
  ANALYSIS: "#a16207",
  SYNTHESIS: "#be185d",
  EVALUATION: "#7e22ce",
};

export function defaultBloomLevelForDifficulty(difficulty: string): BloomLevelId {
  return BLOOM_LEVELS_BY_DIFFICULTY[difficulty]?.[0] ?? "KNOWLEDGE";
}

export function bloomOptionsForDifficulty(difficulty: string) {
  return BLOOM_LEVELS_BY_DIFFICULTY[difficulty] ?? BLOOM_LEVEL_ORDER;
}

export type BloomCognitiveProfile = {
  type: "surface" | "deep" | "mixed";
  message: string;
};

export function buildBloomCognitiveProfile(
  rows: Array<{ bloomLevel: string; score: number; total: number }>
): BloomCognitiveProfile | null {
  const scored = rows.filter((row) => row.total > 0);
  if (scored.length < 3) return null;

  const scoreFor = (level: BloomLevelId) =>
    scored.find((row) => row.bloomLevel === level)?.score ?? null;

  const recallLevels = (["KNOWLEDGE", "COMPREHENSION"] as const)
    .map(scoreFor)
    .filter((value): value is number => value !== null);
  const higherLevels = (["ANALYSIS", "SYNTHESIS", "EVALUATION"] as const)
    .map(scoreFor)
    .filter((value): value is number => value !== null);

  if (!recallLevels.length || !higherLevels.length) return null;

  const recallAvg = recallLevels.reduce((sum, value) => sum + value, 0) / recallLevels.length;
  const higherAvg = higherLevels.reduce((sum, value) => sum + value, 0) / higherLevels.length;
  const spread =
    Math.max(...scored.map((row) => row.score)) - Math.min(...scored.map((row) => row.score));

  if (recallAvg >= 70 && higherAvg < 50 && recallAvg - higherAvg >= 20) {
    return {
      type: "surface",
      message:
        "Surface-level retention: recalls facts well but struggles to apply, analyze, and evaluate. Needs depth practice.",
    };
  }

  if (spread <= 18 && scored.every((row) => row.score >= 55)) {
    return {
      type: "deep",
      message: "Deep, consistent retention: performs evenly across cognitive levels.",
    };
  }

  const weakLevels = scored
    .filter((row) => row.score < 50)
    .map((row) => BLOOM_LEVEL_SHORT_LABELS[row.bloomLevel as BloomLevelId] ?? row.bloomLevel);

  if (weakLevels.length > 0) {
    return {
      type: "mixed",
      message: `Mixed profile: strongest at recall levels (${recallAvg.toFixed(0)}%) but weaker at ${weakLevels.join(", ")}.`,
    };
  }

  return {
    type: "mixed",
    message: "Mixed cognitive profile across domains — review L1–L6 bars for specific gaps.",
  };
}
