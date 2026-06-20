/** Half-width chart footprint — matches Group Analytics “Performance by difficulty”. */
export const ANALYTICS_STANDARD_SLOT_CLASS = "analytics-chart-grid-slot-tall";

export type AnalyticsSlotSize = "default" | "square" | "wide" | "tall";

export const ANALYTICS_SLOT_CLASS: Record<AnalyticsSlotSize, string> = {
  default: ANALYTICS_STANDARD_SLOT_CLASS,
  square: ANALYTICS_STANDARD_SLOT_CLASS,
  wide: "analytics-chart-grid-slot-wide",
  tall: ANALYTICS_STANDARD_SLOT_CLASS,
};

export function chartSlotLayout(layout: Partial<Record<string, AnalyticsSlotSize>>) {
  return layout;
}

export const INDIVIDUAL_STUDENT_CHART_LAYOUT = chartSlotLayout({
  "multi-year-journey": "tall",
  "topic-tiles": "tall",
  "bloom-levels": "tall",
  "class-compare": "tall",
  "score-per-subject": "tall",
  "avg-time-difficulty": "tall",
  "score-by-difficulty": "tall",
  "insights-flags": "tall",
});

export const OVERVIEW_CHART_LAYOUT = chartSlotLayout({
  "average-score-breakdown": "tall",
  "pass-rate-comprehensive": "tall",
  "pass-rate-diagnostic": "tall",
  "score-distribution-comprehensive": "tall",
  "score-distribution-diagnostic": "tall",
  "retake-success": "tall",
  "at-risk": "tall",
  "exam-activity": "tall",
  "pass-rate-by-year": "tall",
});

export const DEMOGRAPHICS_CHART_LAYOUT = chartSlotLayout({
  "school-overall": "tall",
  "school-bloom-gap": "tall",
  "school-topic-gap": "tall",
  "gender-bloom": "tall",
  "gender-topic": "tall",
  "program-score": "tall",
  "program-readiness": "tall",
});

export const GROUP_CHART_LAYOUT = chartSlotLayout({
  "pass-rate": "tall",
  "score-distribution": "tall",
  "at-risk-topic": "tall",
  "average-score-topic": "tall",
  "performance-difficulty": "tall",
  "performance-bloom": "tall",
  "topic-difficulty-heatmap": "tall",
});

export const QUESTION_CHART_LAYOUT = chartSlotLayout({
  "distractor-analysis": "wide",
  "correct-rate-expected": "tall",
  "discrimination-index": "tall",
  "avg-time-question": "tall",
  "topic-coverage": "tall",
});

export function slotClassForChart(
  id: string,
  slotLayout: Partial<Record<string, AnalyticsSlotSize>> = {},
  legacyWideIds: readonly string[] = []
): string {
  const size = slotLayout[id] ?? (legacyWideIds.includes(id) ? "wide" : "tall");
  return ANALYTICS_SLOT_CLASS[size];
}
