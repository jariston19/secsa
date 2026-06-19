export type PreparednessCategoryId =
  | "very_high"
  | "high"
  | "moderate"
  | "low"
  | "very_low";

export type PreparednessTopicRow = {
  label: string;
  score: number;
  performanceLabel: string;
};

export type PreparednessReport = {
  cohortLabel: string;
  readinessIndex: number;
  categoryId: PreparednessCategoryId;
  categoryLabel: string;
  topicPerformance: PreparednessTopicRow[];
  interpretation: string;
  suggestedIntervention: string;
  narrative: string;
  basedOnDiagnostic: boolean;
};

export function preparednessTone(categoryId: PreparednessCategoryId) {
  if (categoryId === "very_high" || categoryId === "high") return "ready";
  if (categoryId === "moderate") return "watch";
  return "risk";
}

/** @deprecated Use preparednessTone with categoryId when available. */
export function preparednessToneFromLabel(label: string) {
  if (label.includes("Very High") || label === "High Preparedness") return "ready";
  if (label.includes("Moderate")) return "watch";
  return "risk";
}
