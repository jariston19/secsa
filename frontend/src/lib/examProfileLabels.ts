export type ExamProfileVariant = "diagnostic" | "comprehensive";

export type ExamProfileScoreBand =
  | "beginning"
  | "emerging"
  | "developing"
  | "proficient"
  | "advance";

const BAND_LABELS: Record<ExamProfileScoreBand, string> = {
  advance: "Advance",
  proficient: "Proficient",
  developing: "Developing",
  emerging: "Emerging",
  beginning: "Beginning",
};

const BAND_BAR_COLORS: Record<ExamProfileScoreBand, string> = {
  advance: "#007aff",
  proficient: "#34c759",
  developing: "#ffcc00",
  emerging: "#ff9500",
  beginning: "#ff3b30",
};

const BAND_TEXT_COLORS: Record<ExamProfileScoreBand, string> = {
  advance: "#007aff",
  proficient: "#248a3d",
  developing: "#ca8a04",
  emerging: "#ff9500",
  beginning: "#ff3b30",
};

export function scoreToExamProfileBand(score: number): ExamProfileScoreBand {
  if (score >= 100) return "advance";
  if (score >= 75) return "proficient";
  if (score >= 50) return "developing";
  if (score >= 25) return "emerging";
  return "beginning";
}

export function examProfileQualitativeLabel(score: number) {
  return BAND_LABELS[scoreToExamProfileBand(score)];
}

export function examProfileBandBarColor(band: ExamProfileScoreBand) {
  return BAND_BAR_COLORS[band];
}

export function examProfileBandTextColor(band: ExamProfileScoreBand) {
  return BAND_TEXT_COLORS[band];
}

export function examProfileBarStyle(score: number) {
  const band = scoreToExamProfileBand(score);
  const width = Math.max(4, Math.min(100, score));
  return {
    width: `${width}%`,
    background: examProfileBandBarColor(band),
  };
}

export function examProfileLegendItems() {
  const bands: Array<{ band: ExamProfileScoreBand; range: string }> = [
    { band: "advance", range: "100%" },
    { band: "proficient", range: "75–99%" },
    { band: "developing", range: "50–74%" },
    { band: "emerging", range: "25–49%" },
    { band: "beginning", range: "0–24%" },
  ];

  return bands.map((item) => ({
    ...item,
    label: BAND_LABELS[item.band],
    color: examProfileBandBarColor(item.band),
  }));
}
