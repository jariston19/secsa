import { BLOOM_LEVEL_COLORS, type BloomLevelId } from "./bloomLevel";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "./constants";

export type DomainProgressionPoint = {
  yearLevel: number;
  score: number | null;
  hasData: boolean;
};

export type DomainProgressionSeries = {
  bloomLevel: string;
  label: string;
  shortLabel: string;
  points: DomainProgressionPoint[];
};

export const DOMAIN_YEAR_LEVELS = Array.from(
  { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
  (_, index) => MIN_YEAR_LEVEL + index
);

export function domainSeriesColor(bloomLevel: string) {
  return BLOOM_LEVEL_COLORS[bloomLevel as BloomLevelId] ?? "#64748b";
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`;
  }
  return path;
}

export function domainChartLayout(width: number, height: number) {
  const pad = { top: 18, right: 18, bottom: 58, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = plotW / (DOMAIN_YEAR_LEVELS.length - 1);

  const xForYear = (yearLevel: number) => pad.left + step * (yearLevel - MIN_YEAR_LEVEL);
  const yForScore = (score: number) => pad.top + plotH - (score / 100) * plotH;

  return { width, height, pad, plotW, plotH, xForYear, yForScore };
}

export function seriesPlotPoints(
  series: DomainProgressionSeries,
  xForYear: (yearLevel: number) => number,
  yForScore: (score: number) => number
) {
  return series.points
    .filter((point) => point.hasData && point.score != null)
    .map((point) => ({
      x: xForYear(point.yearLevel),
      y: yForScore(point.score!),
      yearLevel: point.yearLevel,
      score: point.score!,
    }));
}

export function renderDomainProgressionSvg(domains: DomainProgressionSeries[]) {
  const activeDomains = domains.filter((domain) => domain.points.some((point) => point.hasData));
  if (activeDomains.length === 0) {
    return `<p class="muted">No domain progression data yet.</p>`;
  }

  const width = 520;
  const height = 260;
  const { pad, plotW, plotH, xForYear, yForScore } = domainChartLayout(width, height);

  const grid = [0, 25, 50, 75, 100]
    .map((tick) => {
      const y = pad.top + plotH - (tick / 100) * plotH;
      return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" stroke="#ddd" stroke-width="1" />
        <text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${tick}</text>`;
    })
    .join("");

  const lines = activeDomains
    .map((domain) => {
      const color = domainSeriesColor(domain.bloomLevel);
      const points = seriesPlotPoints(domain, xForYear, yForScore);
      const linePath = buildSmoothPath(points);
      const dots = points
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="${color}" />`)
        .join("");
      return `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.25" />${dots}`;
    })
    .join("");

  const xLabels = DOMAIN_YEAR_LEVELS.map(
    (yearLevel) =>
      `<text x="${xForYear(yearLevel)}" y="${height - 28}" text-anchor="middle" font-size="10" fill="#333">Year ${yearLevel}</text>`
  ).join("");

  const legend = activeDomains
    .map(
      (domain) =>
        `<div style="display:flex;align-items:center;gap:0.35rem;margin:0.15rem 0;">
          <span style="width:0.75rem;height:0.75rem;border-radius:999px;background:${domainSeriesColor(domain.bloomLevel)};display:inline-block;"></span>
          <span>${domain.shortLabel}</span>
        </div>`
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img">
      ${grid}
      ${lines}
      ${xLabels}
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#666">Incoming year progression</text>
    </svg>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem 1rem;margin-top:0.75rem;">${legend}</div>
  `;
}
