import { BloomLevel, Difficulty } from "@prisma/client";

export const BLOOM_LEVEL_ORDER: BloomLevel[] = [
  BloomLevel.KNOWLEDGE,
  BloomLevel.COMPREHENSION,
  BloomLevel.APPLICATION,
  BloomLevel.ANALYSIS,
  BloomLevel.SYNTHESIS,
  BloomLevel.EVALUATION,
];

export const BLOOM_LEVELS_BY_DIFFICULTY: Record<Difficulty, BloomLevel[]> = {
  [Difficulty.EASY]: [BloomLevel.KNOWLEDGE, BloomLevel.COMPREHENSION],
  [Difficulty.MEDIUM]: [BloomLevel.APPLICATION],
  [Difficulty.HARD]: [BloomLevel.ANALYSIS, BloomLevel.SYNTHESIS, BloomLevel.EVALUATION],
};

export const BLOOM_LEVEL_LABELS: Record<BloomLevel, string> = {
  [BloomLevel.KNOWLEDGE]: "L1 Knowledge",
  [BloomLevel.COMPREHENSION]: "L2 Comprehension",
  [BloomLevel.APPLICATION]: "L3 Application",
  [BloomLevel.ANALYSIS]: "L4 Analysis",
  [BloomLevel.SYNTHESIS]: "L5 Synthesis",
  [BloomLevel.EVALUATION]: "L6 Evaluation",
};

export const BLOOM_LEVEL_SHORT_LABELS: Record<BloomLevel, string> = {
  [BloomLevel.KNOWLEDGE]: "L1",
  [BloomLevel.COMPREHENSION]: "L2",
  [BloomLevel.APPLICATION]: "L3",
  [BloomLevel.ANALYSIS]: "L4",
  [BloomLevel.SYNTHESIS]: "L5",
  [BloomLevel.EVALUATION]: "L6",
};

export const BLOOM_LEVEL_COLORS: Record<BloomLevel, string> = {
  [BloomLevel.KNOWLEDGE]: "#22c55e",
  [BloomLevel.COMPREHENSION]: "#22c55e",
  [BloomLevel.APPLICATION]: "#f59e0b",
  [BloomLevel.ANALYSIS]: "#ef4444",
  [BloomLevel.SYNTHESIS]: "#ef4444",
  [BloomLevel.EVALUATION]: "#ef4444",
};

export function defaultBloomLevelForDifficulty(difficulty: Difficulty): BloomLevel {
  return BLOOM_LEVELS_BY_DIFFICULTY[difficulty][0];
}

export function isBloomLevelAllowed(difficulty: Difficulty, bloomLevel: BloomLevel) {
  return BLOOM_LEVELS_BY_DIFFICULTY[difficulty].includes(bloomLevel);
}

export function bloomLevelForSeed(difficulty: Difficulty, index: number): BloomLevel {
  const options = BLOOM_LEVELS_BY_DIFFICULTY[difficulty];
  return options[index % options.length];
}

export type BloomScoreRow = {
  bloomLevel: BloomLevel;
  score: number;
  total: number;
};

export type BloomCognitiveProfile = {
  type: "surface" | "deep" | "mixed";
  message: string;
};

export function buildBloomCognitiveProfile(rows: BloomScoreRow[]): BloomCognitiveProfile | null {
  const scored = rows.filter((row) => row.total > 0);
  if (scored.length < 3) return null;

  const scoreFor = (level: BloomLevel) =>
    scored.find((row) => row.bloomLevel === level)?.score ?? null;

  const recallLevels = [BloomLevel.KNOWLEDGE, BloomLevel.COMPREHENSION]
    .map(scoreFor)
    .filter((value): value is number => value !== null);
  const higherLevels = [BloomLevel.ANALYSIS, BloomLevel.SYNTHESIS, BloomLevel.EVALUATION]
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
    .map((row) => BLOOM_LEVEL_SHORT_LABELS[row.bloomLevel]);

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
