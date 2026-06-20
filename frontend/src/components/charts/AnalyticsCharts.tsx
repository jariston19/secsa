import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ModalPagination from "../ModalPagination";
import { usePagination } from "../../hooks/usePagination";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  EXPECTED_CORRECT_RANGES,
  toneColor,
  type ScoreTone,
} from "../../lib/analyticsChartUtils";
import { BLOOM_LEVEL_COLORS, BLOOM_LEVEL_SHORT_LABELS } from "../../lib/bloomLevel";
import {
  DOMAIN_YEAR_LEVELS,
  buildSmoothPath,
  domainChartLayout,
  domainSeriesColor,
  seriesPlotPoints,
} from "../../lib/domainProgressionChart";

interface HistogramBucket {
  label: string;
  value: number;
}

export function VerticalHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const compact = buckets.length >= 5;

  return (
    <div
      className={`chart-vertical-histogram ${compact ? "chart-vertical-histogram-compact" : ""}`.trim()}
      role="img"
      aria-label="Score distribution histogram"
    >
      <div className="chart-vertical-histogram-bars">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="chart-vertical-histogram-col">
            <span className="chart-vertical-histogram-count">{bucket.value}</span>
            <div className="chart-vertical-histogram-track">
              <span
                className="chart-vertical-histogram-fill"
                style={{ height: `${(bucket.value / max) * 100}%` }}
              />
            </div>
            <span className="chart-vertical-histogram-label">{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HorizontalBar {
  label: string;
  value: number;
  tone?: ScoreTone;
  color?: string;
}

export function HorizontalBarChart({
  bars,
  max = 100,
  suffix = "%",
  valueDecimals = 1,
}: {
  bars: HorizontalBar[];
  max?: number;
  suffix?: string;
  valueDecimals?: number;
}) {
  return (
    <div className="chart-horizontal-bars">
      {bars.map((bar) => {
        const width = Math.min(100, Math.max(0, (bar.value / max) * 100));
        const fillColor = bar.color ?? toneColor(bar.tone ?? "moderate");
        return (
          <div key={bar.label} className="chart-horizontal-bar-row">
            <span className="chart-horizontal-bar-label">{bar.label}</span>
            <div className="chart-horizontal-bar-track">
              <span
                className="chart-horizontal-bar-fill"
                style={{ width: `${width}%`, backgroundColor: fillColor }}
              />
            </div>
            <span className="chart-horizontal-bar-value">
              {bar.value.toFixed(valueDecimals)}
              {suffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PairedHorizontalBarChart({
  rows,
  leftSeries,
  rightSeries,
  suffix = "%",
  pageSize,
}: {
  rows: Array<{ label: string; left: number; right: number }>;
  leftSeries: { label: string; color: string };
  rightSeries: { label: string; color: string };
  suffix?: string;
  pageSize?: number;
}) {
  const pagination = usePagination(rows, {
    pageSize: pageSize ?? rows.length,
    resetKey: rows.map((row) => `${row.label}:${row.left}:${row.right}`).join("|"),
  });
  const visibleRows = pageSize ? pagination.paginatedItems : rows;

  if (rows.length === 0) {
    return <p className="muted">No data yet.</p>;
  }

  return (
    <div className="chart-paired-horizontal-panel">
      <div className="chart-paired-horizontal-legend">
        <span>
          <i style={{ background: leftSeries.color }} /> {leftSeries.label}
        </span>
        <span>
          <i style={{ background: rightSeries.color }} /> {rightSeries.label}
        </span>
      </div>
      <div
        className={[
          "chart-paired-horizontal-bars",
          pageSize ? "chart-paired-horizontal-bars-paged" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={pageSize ? ({ "--paired-bar-page-size": pageSize } as CSSProperties) : undefined}
      >
        {visibleRows.map((row) => (
          <div key={row.label} className="chart-paired-horizontal-row">
            <span className="chart-paired-horizontal-label">{row.label}</span>
            <div className="chart-paired-horizontal-bars-wrap">
              <div className="chart-paired-horizontal-bar-line">
                <span
                  className="chart-paired-horizontal-bar-fill"
                  style={{ width: `${Math.min(100, row.left)}%`, backgroundColor: leftSeries.color }}
                />
                <span className="chart-paired-horizontal-value">
                  {row.left.toFixed(0)}
                  {suffix}
                </span>
              </div>
              <div className="chart-paired-horizontal-bar-line">
                <span
                  className="chart-paired-horizontal-bar-fill"
                  style={{ width: `${Math.min(100, row.right)}%`, backgroundColor: rightSeries.color }}
                />
                <span className="chart-paired-horizontal-value">
                  {row.right.toFixed(0)}
                  {suffix}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {pageSize && pagination.totalPages > 1 ? (
        <div className="chart-card-pagination analytics-no-print">
          <ModalPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageStart={pagination.pageStart}
            pageEnd={pagination.pageEnd}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setPage}
            itemNoun="topic"
          />
        </div>
      ) : null}
    </div>
  );
}

export type DifficultyDomainItem = {
  bloomLevel: string;
  score: number;
  total?: number;
  classAverage?: number;
};

export function GroupedDifficultyBars({
  items,
}: {
  items: Array<{
    difficulty: string;
    score: number;
    domains?: DifficultyDomainItem[];
  }>;
}) {
  return (
    <div className="chart-difficulty-with-domains" role="img" aria-label="Performance by difficulty">
      <GroupedPercentBars
        ariaLabel="Performance by difficulty"
        items={items.map((item) => ({
          id: item.difficulty,
          label: DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty,
          score: item.score,
          color: DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] ?? "#64748b",
        }))}
      />
      {items.some((item) => item.domains && item.domains.length > 0) ? (
        <div className="chart-difficulty-domain-grid">
          {items.map((item) => (
            <div key={item.difficulty} className="chart-difficulty-domain-col">
              {(item.domains ?? []).map((domain) => {
                const color =
                  BLOOM_LEVEL_COLORS[domain.bloomLevel as keyof typeof BLOOM_LEVEL_COLORS] ??
                  "#64748b";
                const width = Math.min(100, Math.max(0, domain.score));
                const hasData = (domain.total ?? 1) > 0;
                return (
                  <div key={domain.bloomLevel} className="chart-difficulty-domain-row">
                    <span className="chart-difficulty-domain-label">
                      {BLOOM_LEVEL_SHORT_LABELS[
                        domain.bloomLevel as keyof typeof BLOOM_LEVEL_SHORT_LABELS
                      ] ?? domain.bloomLevel}
                    </span>
                    <div className="chart-difficulty-domain-bar-track">
                      <span
                        className="chart-difficulty-domain-bar-fill"
                        style={{
                          width: `${width}%`,
                          backgroundColor: color,
                          opacity: hasData ? 1 : 0.25,
                        }}
                      />
                    </div>
                    <span className="chart-difficulty-domain-score">
                      {hasData ? `${domain.score.toFixed(0)}%` : "—"}
                      {domain.classAverage != null && domain.classAverage > 0
                        ? ` · ${domain.classAverage.toFixed(0)}% class`
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function GroupedPercentBars({
  items,
  ariaLabel = "Grouped percentage bars",
}: {
  items: Array<{ id: string; label: string; score: number; color: string }>;
  ariaLabel?: string;
}) {
  const max = 100;

  if (items.length === 0) {
    return <p className="muted">No data yet.</p>;
  }

  return (
    <div className="chart-grouped-bars" role="img" aria-label={ariaLabel}>
      {items.map((item) => {
        const height = Math.min(100, Math.max(0, (item.score / max) * 100));
        return (
          <div key={item.id} className="chart-grouped-bar-col">
            <span className="chart-grouped-bar-value">{item.score.toFixed(0)}%</span>
            <div className="chart-grouped-bar-track">
              <span
                className="chart-grouped-bar-fill"
                style={{ height: `${height}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="chart-grouped-bar-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedBloomBars({
  items,
}: {
  items: Array<{ bloomLevel: string; score: number }>;
}) {
  const max = 100;

  return (
    <div className="chart-grouped-bars" role="img" aria-label="Performance by domain">
      {items.map((item) => {
        const color = BLOOM_LEVEL_COLORS[item.bloomLevel as keyof typeof BLOOM_LEVEL_COLORS] ?? "#64748b";
        const height = Math.min(100, Math.max(0, (item.score / max) * 100));
        return (
          <div key={item.bloomLevel} className="chart-grouped-bar-col">
            <span className="chart-grouped-bar-value">{item.score.toFixed(0)}%</span>
            <div className="chart-grouped-bar-track">
              <span
                className="chart-grouped-bar-fill"
                style={{ height: `${height}%`, backgroundColor: color }}
              />
            </div>
            <span className="chart-grouped-bar-label">
              {BLOOM_LEVEL_SHORT_LABELS[item.bloomLevel as keyof typeof BLOOM_LEVEL_SHORT_LABELS] ??
                item.bloomLevel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BloomCognitiveCallout({
  profile,
}: {
  profile: { type: "surface" | "deep" | "mixed"; message: string } | null | undefined;
}) {
  if (!profile) return null;

  const className =
    profile.type === "deep"
      ? "bloom-profile-callout bloom-profile-callout-deep"
      : profile.type === "surface"
        ? "bloom-profile-callout bloom-profile-callout-surface"
        : "bloom-profile-callout bloom-profile-callout-mixed";

  return <p className={className}>{profile.message}</p>;
}

interface HeatmapCell {
  score: number;
  tone: ScoreTone;
  total?: number;
}

interface HeatmapRow {
  id: string;
  label: string;
  sublabel?: string;
  cells: Array<HeatmapCell | null>;
}

export function PerformanceHeatmap({
  rows,
  columnLabels,
}: {
  rows: HeatmapRow[];
  columnLabels: string[];
}) {
  return (
    <div className="chart-heatmap-wrap">
      <table className="chart-heatmap">
        <thead>
          <tr>
            <th />
            {columnLabels.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="chart-heatmap-row-label">
                <strong>{row.label}</strong>
                {row.sublabel ? <span className="muted table-subtext">{row.sublabel}</span> : null}
              </td>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`}>
                  {cell ? (
                    <span
                      className={`chart-heatmap-cell chart-tone-${cell.tone}`}
                      title={cell.total != null ? `${cell.total} responses` : undefined}
                    >
                      {cell.score.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="chart-heatmap-cell chart-heatmap-empty">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoverageHeatmap({
  rows,
  columnLabels,
}: {
  rows: Array<{
    id: string;
    label: string;
    sublabel?: string;
    counts: number[];
  }>;
  columnLabels: string[];
}) {
  const maxCount = Math.max(...rows.flatMap((r) => r.counts), 1);

  return (
    <div className="chart-heatmap-wrap">
      <table className="chart-heatmap chart-coverage-heatmap">
        <thead>
          <tr>
            <th />
            {columnLabels.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="chart-heatmap-row-label">
                <strong>{row.label}</strong>
                {row.sublabel ? <span className="muted table-subtext">{row.sublabel}</span> : null}
              </td>
              {row.counts.map((count, index) => {
                const intensity = count / maxCount;
                return (
                  <td key={`${row.id}-${index}`}>
                    <span
                      className="chart-coverage-cell"
                      style={{
                        backgroundColor:
                          count === 0
                            ? "rgba(148, 163, 184, 0.12)"
                            : `rgba(59, 130, 246, ${0.2 + intensity * 0.7})`,
                      }}
                    >
                      {count}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DonutChart({
  value,
  label,
  passed,
  failed,
  exams,
  metric = "passRate",
  hideCenter = false,
}: {
  value: number;
  label?: string;
  passed?: number;
  failed?: number;
  exams?: number;
  metric?: "passRate" | "averageScore";
  hideCenter?: boolean;
}) {
  const hasData = metric === "averageScore" ? (exams ?? 0) > 0 : true;
  const pct = hasData ? Math.min(100, Math.max(0, value)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const centerLabel = label ?? (metric === "averageScore" ? "avg score" : "passed");
  const centerValue = hasData ? `${pct.toFixed(0)}%` : "—";

  return (
    <div className="chart-donut">
      <div className="chart-donut-ring-wrap">
        <svg viewBox="0 0 120 120" className="chart-donut-svg" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="chart-donut-ring-bg"
            strokeWidth="14"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="chart-donut-ring-fill"
            strokeWidth="14"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        {!hideCenter ? (
          <div className="chart-donut-center">
            <span className="chart-donut-value">{centerValue}</span>
            <span className="chart-donut-label">{centerLabel}</span>
          </div>
        ) : null}
      </div>
      {metric === "averageScore" ? (
        <div className="chart-donut-legend">
          <span>
            <i className="chart-legend-dot chart-legend-pass" /> {exams ?? 0}{" "}
            {(exams ?? 0) === 1 ? "exam" : "exams"}
          </span>
        </div>
      ) : (
        <div className="chart-donut-legend">
          <span>
            <i className="chart-legend-dot chart-legend-pass" /> {passed ?? 0} passed
          </span>
          <span>
            <i className="chart-legend-dot chart-legend-fail" /> {failed ?? 0} failed
          </span>
        </div>
      )}
    </div>
  );
}

export function TopicFlagGrid({
  topics,
}: {
  topics: Array<{ label: string; score: number; tone: ScoreTone }>;
}) {
  return (
    <div className="chart-topic-flags">
      {topics.map((topic) => (
        <div key={topic.label} className={`chart-topic-flag chart-tone-${topic.tone}`}>
          <span className="chart-topic-flag-label">{topic.label}</span>
          <span className="chart-topic-flag-score">{topic.score.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

export function RadarChart({
  topics,
  studentScores,
  classScores,
}: {
  topics: string[];
  studentScores: number[];
  classScores: number[];
}) {
  if (topics.length < 3) {
    return <p className="muted">Need at least 3 topics for a radar chart.</p>;
  }

  const size = 220;
  const center = size / 2;
  const radius = 82;
  const levels = [25, 50, 75, 100];
  const angleStep = (Math.PI * 2) / topics.length;

  const pointAt = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polygon = (scores: number[]) =>
    scores
      .map((score, index) => {
        const point = pointAt(score, index);
        return `${point.x},${point.y}`;
      })
      .join(" ");

  return (
    <div className="chart-radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="chart-radar" role="img">
        {levels.map((level) => (
          <polygon
            key={level}
            points={topics
              .map((_, index) => {
                const point = pointAt(level, index);
                return `${point.x},${point.y}`;
              })
              .join(" ")}
            className="chart-radar-grid"
          />
        ))}
        {topics.map((topic, index) => {
          const outer = pointAt(100, index);
          const label = pointAt(112, index);
          return (
            <g key={topic}>
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                className="chart-radar-axis"
              />
              <text x={label.x} y={label.y} className="chart-radar-label" textAnchor="middle">
                {topic.length > 10 ? `${topic.slice(0, 10)}…` : topic}
              </text>
            </g>
          );
        })}
        <polygon points={polygon(classScores)} className="chart-radar-class" />
        <polygon points={polygon(studentScores)} className="chart-radar-student" />
      </svg>
      <div className="chart-radar-legend">
        <span>
          <i className="chart-legend-line chart-legend-class" /> Class average
        </span>
        <span>
          <i className="chart-legend-line chart-legend-student" /> Student
        </span>
      </div>
    </div>
  );
}

interface ScatterPoint {
  timeSeconds: number;
  correct: boolean;
  difficulty: string;
}

export function TimeCorrectnessScatter({ points }: { points: ScatterPoint[] }) {
  if (points.length === 0) {
    return <p className="muted">Timing data appears after students complete timed exams.</p>;
  }

  const maxTime = Math.max(...points.map((p) => p.timeSeconds), 30);
  const width = 320;
  const height = 180;
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const bubbleSize = (difficulty: string) => {
    if (difficulty === "HARD") return 7;
    if (difficulty === "MEDIUM") return 5;
    return 4;
  };

  return (
    <div className="chart-scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-scatter" role="img">
        <line
          x1={pad.left}
          y1={pad.top + plotH / 2}
          x2={pad.left + plotW}
          y2={pad.top + plotH / 2}
          className="chart-scatter-grid"
        />
        <text x={pad.left} y={pad.top + 8} className="chart-scatter-axis-label">
          Correct
        </text>
        <text x={pad.left} y={pad.top + plotH} className="chart-scatter-axis-label">
          Wrong
        </text>
        <text
          x={pad.left + plotW / 2}
          y={height - 6}
          className="chart-scatter-axis-label"
          textAnchor="middle"
        >
          Time (seconds)
        </text>
        {points.map((point, index) => {
          const x = pad.left + (point.timeSeconds / maxTime) * plotW;
          const y = pad.top + (point.correct ? plotH * 0.25 : plotH * 0.75);
          const color =
            DIFFICULTY_COLORS[point.difficulty as keyof typeof DIFFICULTY_COLORS] ?? "#64748b";
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={bubbleSize(point.difficulty)}
              fill={color}
              opacity={0.65}
            />
          );
        })}
      </svg>
      <div className="chart-scatter-legend">
        <span>Size = difficulty</span>
      </div>
    </div>
  );
}

export function PercentileBand({
  studentScore,
  min,
  avg,
  max,
}: {
  studentScore: number;
  min: number;
  avg: number;
  max: number;
}) {
  const range = Math.max(max - min, 1);
  const pos = ((studentScore - min) / range) * 100;
  const avgPos = ((avg - min) / range) * 100;

  return (
    <div className="chart-percentile-band">
      <div className="chart-percentile-track">
        <span className="chart-percentile-fill" />
        <span className="chart-percentile-avg" style={{ left: `${avgPos}%` }} title="Class average" />
        <span
          className="chart-percentile-marker"
          style={{ left: `${Math.min(100, Math.max(0, pos))}%` }}
          title={`${studentScore.toFixed(1)}%`}
        />
      </div>
      <div className="chart-percentile-labels">
        <span>Min {min.toFixed(0)}%</span>
        <span>Avg {avg.toFixed(0)}%</span>
        <span>Max {max.toFixed(0)}%</span>
      </div>
      <p className="muted chart-percentile-note">
        Marker shows where a student sits between the batch minimum and maximum.
      </p>
    </div>
  );
}

interface DistractorOption {
  option: string;
  rate: number;
  isCorrect: boolean;
}

export function DistractorBarChart({
  options,
  correctOption,
}: {
  options: DistractorOption[];
  correctOption: string;
}) {
  const max = Math.max(...options.map((o) => o.rate), 1);

  return (
    <div className="chart-distractor-bars">
      {options.map((option) => (
        <div key={option.option} className="chart-distractor-bar-col">
          <div className="chart-distractor-bar-stack">
            <span className="chart-distractor-bar-value">{option.rate.toFixed(0)}%</span>
            <div className="chart-distractor-bar-track">
              <span
                className={`chart-distractor-bar-fill ${
                  option.isCorrect || option.option === correctOption ? "correct" : ""
                }`}
                style={{ height: `${(option.rate / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="chart-distractor-bar-label">{option.option}</span>
        </div>
      ))}
    </div>
  );
}

export function DifficultyAlignmentChart({
  items,
}: {
  items: Array<{ label: string; difficulty: string; correctRate: number }>;
}) {
  return (
    <div className="chart-alignment-list">
      {items.map((item) => {
        const range = EXPECTED_CORRECT_RANGES[item.difficulty] ?? { min: 0, max: 100 };
        const width = Math.min(100, Math.max(0, item.correctRate));
        const outOfRange = item.correctRate < range.min || item.correctRate > range.max;

        return (
          <div key={item.label} className="chart-alignment-row">
            <span className="chart-alignment-label">{item.label}</span>
            <div className="chart-alignment-track">
              <span
                className="chart-alignment-range"
                style={{
                  left: `${range.min}%`,
                  width: `${range.max - range.min}%`,
                }}
              />
              <span
                className={`chart-alignment-bar ${outOfRange ? "out-of-range" : ""}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="chart-alignment-value">{item.correctRate.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

interface DiscriminationPoint {
  id: string;
  label: string;
  correctRate: number;
  discriminationIndex: number;
}

export function DiscriminationScatter({
  points,
  fill = true,
}: {
  points: DiscriminationPoint[];
  fill?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState({ width: 320, height: 200 });

  useEffect(() => {
    if (!fill) return;
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      setPlotSize({
        width: Math.max(200, node.clientWidth),
        height: Math.max(140, node.clientHeight),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fill]);

  if (points.length === 0) {
    return <p className="muted">Need more attempts per question for discrimination analysis.</p>;
  }

  const pad = fill
    ? { top: 20, right: 16, bottom: 36, left: 36 }
    : { top: 16, right: 16, bottom: 32, left: 40 };
  const plotW = fill
    ? Math.max(120, plotSize.width - pad.left - pad.right)
    : 320 - pad.left - pad.right;
  const plotH = fill
    ? Math.max(100, plotSize.height - pad.top - pad.bottom)
    : 200 - pad.top - pad.bottom;
  const width = pad.left + plotW + pad.right;
  const height = pad.top + plotH + pad.bottom;

  return (
    <div
      ref={wrapRef}
      className={[
        "chart-discrimination-wrap",
        fill ? "chart-discrimination-wrap-fill" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={fill ? "xMinYMid meet" : undefined}
        className={["chart-discrimination", fill ? "chart-discrimination-fill" : ""]
          .filter(Boolean)
          .join(" ")}
        role="img"
      >
        <line
          x1={pad.left + plotW / 2}
          y1={pad.top}
          x2={pad.left + plotW / 2}
          y2={pad.top + plotH}
          className="chart-discrimination-grid"
        />
        <line
          x1={pad.left}
          y1={pad.top + plotH / 2}
          x2={pad.left + plotW}
          y2={pad.top + plotH / 2}
          className="chart-discrimination-grid"
        />
        <text x={pad.left} y={height - 8} className="chart-scatter-axis-label" textAnchor="start">
          Correct rate
        </text>
        <text
          x={fill ? 8 : 12}
          y={pad.top + plotH / 2}
          className="chart-scatter-axis-label"
          transform={`rotate(-90 ${fill ? 8 : 12} ${pad.top + plotH / 2})`}
          textAnchor="middle"
        >
          Discrimination
        </text>
        {points.map((point) => {
          const x = pad.left + (point.correctRate / 100) * plotW;
          const y = pad.top + plotH - ((point.discriminationIndex + 0.5) / 1) * plotH;
          return (
            <circle
              key={point.id}
              cx={x}
              cy={Math.min(pad.top + plotH, Math.max(pad.top, y))}
              r={4}
              className="chart-discrimination-dot"
            >
              <title>{point.label}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

export function TimePerQuestionBars({
  items,
}: {
  items: Array<{ id: string; label: string; avgTimeSeconds: number }>;
}) {
  const max = Math.max(...items.map((i) => i.avgTimeSeconds), 1);

  return (
    <div className="chart-time-bars">
      {items.map((item) => (
        <div key={item.id} className="chart-time-bar-row">
          <span className="chart-time-bar-label" title={item.label}>
            {item.label}
          </span>
          <div className="chart-time-bar-track">
            <span
              className="chart-time-bar-fill"
              style={{ width: `${(item.avgTimeSeconds / max) * 100}%` }}
            />
          </div>
          <span className="chart-time-bar-value">{item.avgTimeSeconds}s</span>
        </div>
      ))}
    </div>
  );
}

export function ChartIconBars({ direction = "vertical" }: { direction?: "vertical" | "horizontal" }) {
  return (
    <svg viewBox="0 0 24 24" className="analytics-chart-icon" aria-hidden>
      {direction === "vertical" ? (
        <>
          <rect x="4" y="12" width="4" height="8" rx="1" />
          <rect x="10" y="8" width="4" height="12" rx="1" />
          <rect x="16" y="4" width="4" height="16" rx="1" />
        </>
      ) : (
        <>
          <rect x="4" y="6" width="14" height="3" rx="1" />
          <rect x="4" y="11" width="10" height="3" rx="1" />
          <rect x="4" y="16" width="6" height="3" rx="1" />
        </>
      )}
    </svg>
  );
}

export function ChartIconDonut() {
  return (
    <svg viewBox="0 0 24 24" className="analytics-chart-icon" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="30 50"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

export function ChartIconHeatmap() {
  return (
    <svg viewBox="0 0 24 24" className="analytics-chart-icon" aria-hidden>
      <rect x="4" y="4" width="5" height="5" rx="1" className="chart-icon-weak" />
      <rect x="10" y="4" width="5" height="5" rx="1" className="chart-icon-moderate" />
      <rect x="16" y="4" width="5" height="5" rx="1" className="chart-icon-strong" />
      <rect x="4" y="10" width="5" height="5" rx="1" className="chart-icon-moderate" />
      <rect x="10" y="10" width="5" height="5" rx="1" className="chart-icon-strong" />
      <rect x="16" y="10" width="5" height="5" rx="1" className="chart-icon-weak" />
      <rect x="4" y="16" width="5" height="5" rx="1" className="chart-icon-strong" />
      <rect x="10" y="16" width="5" height="5" rx="1" className="chart-icon-weak" />
      <rect x="16" y="16" width="5" height="5" rx="1" className="chart-icon-moderate" />
    </svg>
  );
}

export function ChartIconRadar() {
  return (
    <svg viewBox="0 0 24 24" className="analytics-chart-icon" aria-hidden>
      <polygon points="12,4 20,10 17,20 7,20 4,10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <polygon points="12,8 16,11 15,17 9,17 8,11" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function ChartIconScatter() {
  return (
    <svg viewBox="0 0 24 24" className="analytics-chart-icon" aria-hidden>
      <circle cx="6" cy="16" r="2.5" />
      <circle cx="11" cy="8" r="3" />
      <circle cx="17" cy="14" r="2" />
      <circle cx="19" cy="6" r="2.5" />
    </svg>
  );
}

interface MilestonePoint {
  yearLevel: number;
  label: string;
  averageScore: number;
  passRate: number;
  studentsAssessed: number;
}

export function BatchComparisonLineChart({
  batches,
}: {
  batches: Array<{
    intakeYear: number;
    milestones: MilestonePoint[];
  }>;
}) {
  const colors = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6"];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(520);

  function milestoneCalendarYear(intakeYear: number, yearLevel: number) {
    return intakeYear + yearLevel - 1;
  }

  const assessedBatches = useMemo(
    () =>
      batches
        .map((batch) => ({
          ...batch,
          milestones: batch.milestones.filter((milestone) => milestone.studentsAssessed > 0),
        }))
        .filter((batch) => batch.milestones.length > 0)
        .sort((a, b) => a.intakeYear - b.intakeYear),
    [batches]
  );

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      setPlotWidth(Math.max(280, node.clientWidth));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (assessedBatches.length === 0) {
    return <p className="muted">No milestone data yet for these batches.</p>;
  }

  const minYear = Math.min(...assessedBatches.map((batch) => batch.intakeYear));
  const maxYear = Math.max(...assessedBatches.map((batch) => batch.intakeYear + 3));
  const axisYears = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);

  const height = 280;
  const pad = { top: 20, right: 20, bottom: 56, left: 28 };
  const yAxisLabelX = pad.left - 4;
  const yearSpan = Math.max(1, maxYear - minYear);
  const plotW = Math.max(120, plotWidth - pad.left - pad.right);
  const yearStep = plotW / yearSpan;
  const plotH = height - pad.top - pad.bottom;
  const width = pad.left + plotW + pad.right;

  const xForCalendarYear = (year: number) => pad.left + (year - minYear) * yearStep;

  return (
    <div ref={wrapRef} className="chart-progression-wrap chart-progression-wrap-compare">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMid meet"
        className="chart-progression chart-progression-compare"
        role="img"
      >
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + plotH}
          className="chart-progression-axis-line"
        />
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = pad.top + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} className="chart-progression-grid" />
              <text x={yAxisLabelX} y={y + 4} className="chart-progression-axis-label" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        {axisYears.map((year) => (
          <line
            key={`grid-${year}`}
            x1={xForCalendarYear(year)}
            y1={pad.top}
            x2={xForCalendarYear(year)}
            y2={pad.top + plotH}
            className="chart-progression-year-grid"
          />
        ))}
        {assessedBatches.map((batch, batchIndex) => {
          const color = colors[batchIndex % colors.length];
          const points = [...batch.milestones]
            .sort(
              (a, b) =>
                milestoneCalendarYear(batch.intakeYear, a.yearLevel) -
                milestoneCalendarYear(batch.intakeYear, b.yearLevel)
            )
            .map((milestone) => ({
              x: xForCalendarYear(milestoneCalendarYear(batch.intakeYear, milestone.yearLevel)),
              y: pad.top + plotH - (milestone.averageScore / 100) * plotH,
              milestone,
            }));
          const linePath = points
            .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
            .join(" ");

          return (
            <g key={batch.intakeYear}>
              {points.length > 1 ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {points.map((point) => (
                <g key={`${batch.intakeYear}-${point.milestone.yearLevel}`}>
                  <circle cx={point.x} cy={point.y} r={4} fill={color} />
                  <text
                    x={point.x}
                    y={point.y - 8}
                    className="chart-progression-value"
                    textAnchor="middle"
                  >
                    {point.milestone.averageScore.toFixed(0)}%
                  </text>
                </g>
              ))}
            </g>
          );
        })}
        {axisYears.map((year) => (
          <text
            key={year}
            x={xForCalendarYear(year)}
            y={height - 16}
            className="chart-progression-milestone-label"
            textAnchor="middle"
          >
            {year}
          </text>
        ))}
      </svg>
      <ul className="chart-progression-legend">
        {assessedBatches.map((batch, batchIndex) => (
          <li key={batch.intakeYear}>
            <span
              className="chart-progression-legend-swatch"
              style={{ background: colors[batchIndex % colors.length] }}
            />
            Batch {batch.intakeYear}
          </li>
        ))}
      </ul>
      <p className="muted chart-progression-note">
        Average score by calendar year at each milestone — one line per intake batch.
      </p>
    </div>
  );
}

export function CohortMilestoneLineChart({
  milestones,
  fill = false,
}: {
  milestones: MilestonePoint[];
  fill?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState({ width: 360, height: 200 });

  useEffect(() => {
    if (!fill) return;
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      setPlotSize({
        width: Math.max(200, node.clientWidth),
        height: Math.max(140, node.clientHeight),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fill]);

  const assessed = milestones.filter((milestone) => milestone.studentsAssessed > 0);
  if (assessed.length === 0) {
    return <p className="muted">No milestone data yet for this cohort.</p>;
  }

  const pad = fill
    ? { top: 18, right: 16, bottom: 44, left: 36 }
    : { top: 16, right: 16, bottom: 52, left: 40 };
  const width = fill ? plotSize.width : 360;
  const height = fill ? plotSize.height : 200;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = assessed.length > 1 ? plotW / (assessed.length - 1) : 0;

  const points = assessed.map((milestone, index) => ({
    x: pad.left + step * index,
    y: pad.top + plotH - (milestone.averageScore / 100) * plotH,
    milestone,
  }));

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <div
      ref={wrapRef}
      className={["chart-progression-wrap", fill ? "chart-progression-wrap-fill" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={fill ? "none" : undefined}
        className={["chart-progression", fill ? "chart-progression-fill" : ""].filter(Boolean).join(" ")}
        role="img"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = pad.top + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} className="chart-progression-grid" />
              <text x={pad.left - 6} y={y + 4} className="chart-progression-axis-label" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        <path d={linePath} className="chart-progression-line" fill="none" />
        {points.map((point) => (
          <g key={point.milestone.label}>
            <circle cx={point.x} cy={point.y} r={3} className="chart-progression-dot" />
            <text
              x={point.x}
              y={point.y - 7}
              className="chart-progression-value"
              textAnchor="middle"
            >
              {point.milestone.averageScore.toFixed(0)}%
            </text>
          </g>
        ))}
        {points.map((point) => (
          <text
            key={`${point.milestone.label}-label`}
            x={point.x}
            y={height - 8}
            className="chart-progression-milestone-label"
            textAnchor="middle"
          >
            Y{point.milestone.yearLevel}
          </text>
        ))}
      </svg>
      <p className="muted chart-progression-note">Average score at each incoming-year milestone.</p>
    </div>
  );
}

interface StudentJourneyPoint {
  yearLevel: number;
  label: string;
  score: number | null;
  passed: boolean | null;
  hasData: boolean;
}

export function StudentJourneyLineChart({
  milestones,
  intakeYear,
  compact = false,
  fill = false,
}: {
  milestones: StudentJourneyPoint[];
  intakeYear: number | null;
  compact?: boolean;
  fill?: boolean;
}) {
  const assessed = milestones.filter((milestone) => milestone.hasData && milestone.score != null);
  if (assessed.length === 0) {
    return <p className="muted">No multi-year exam history yet for this student.</p>;
  }

  const width = compact ? 280 : 360;
  const height = compact ? 140 : 200;
  const pad = compact
    ? { top: 12, right: 10, bottom: 28, left: 36 }
    : { top: 16, right: 16, bottom: 52, left: 42 };
  const yAxisLabelX = pad.left - 6;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = assessed.length > 1 ? plotW / (assessed.length - 1) : 0;
  const yTicks = [0, 25, 50, 75, 100];
  const firstPointX = pad.left + (compact ? 16 : 20);

  const points = assessed.map((milestone, index) => ({
    x: assessed.length > 1 ? pad.left + step * index : firstPointX,
    y: pad.top + plotH - ((milestone.score ?? 0) / 100) * plotH,
    milestone,
    index,
  }));

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <div
      className={[
        "chart-progression-wrap",
        compact ? "chart-progression-wrap-compact" : "",
        fill ? "chart-progression-wrap-fill" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="chart-progression"
        role="img"
      >
        {yTicks.map((tick) => {
          const y = pad.top + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} className="chart-progression-grid" />
              <text x={yAxisLabelX} y={y + 4} className="chart-progression-axis-label" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        <path
          d={linePath}
          className="chart-progression-line"
          fill="none"
          strokeWidth={compact ? 2 : 2.5}
        />
        {points.map((point) => (
          <g key={point.milestone.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r={compact ? 2.5 : 3}
              className={`chart-progression-dot${point.milestone.passed === false ? " chart-progression-dot-fail" : ""}`}
            />
            <text
              x={point.x + (assessed.length === 1 ? 4 : 0)}
              y={point.y - (compact ? 5 : 7)}
              className="chart-progression-value"
              textAnchor={assessed.length === 1 ? "start" : "middle"}
            >
              {(point.milestone.score ?? 0).toFixed(0)}%
            </text>
          </g>
        ))}
        {points.map((point) => (
          <text
            key={`${point.milestone.label}-label`}
            x={point.index === 0 ? pad.left + 4 : point.x}
            y={height - (compact ? 6 : 8)}
            className="chart-progression-milestone-label"
            textAnchor={point.index === 0 ? "start" : "middle"}
          >
            Y{point.milestone.yearLevel}
          </text>
        ))}
      </svg>
      {!compact ? (
        intakeYear != null ? (
          <p className="muted chart-progression-note">
            Intake batch {intakeYear} · score at each incoming-year milestone (Y1 diagnostic, Y2–Y4 comprehensive).
          </p>
        ) : (
          <p className="muted chart-progression-note">
            Score at each incoming-year milestone (Y1 diagnostic, Y2–Y4 comprehensive).
          </p>
        )
      ) : null}
    </div>
  );
}

export function ScoreCorrelationScatter({
  fromLabel,
  toLabel,
  points,
  fill = false,
}: {
  fromLabel: string;
  toLabel: string;
  points: Array<{ fromScore: number; toScore: number }>;
  fill?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState({ width: 280, height: 220 });

  useEffect(() => {
    if (!fill) return;
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      setPlotSize({
        width: Math.max(200, node.clientWidth),
        height: Math.max(160, node.clientHeight),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fill]);

  if (points.length === 0) {
    return <p className="muted">No paired exam history for this transition yet.</p>;
  }

  const pad = fill
    ? { top: 18, right: 16, bottom: 40, left: 28 }
    : { top: 14, right: 14, bottom: 36, left: 40 };
  const yAxisLabelX = pad.left - 4;
  const plotW = fill
    ? Math.max(120, plotSize.width - pad.left - pad.right)
    : 320 - pad.left - pad.right;
  const plotH = fill
    ? Math.max(120, plotSize.height - pad.top - pad.bottom)
    : 220 - pad.top - pad.bottom;
  const width = pad.left + plotW + pad.right;
  const height = pad.top + plotH + pad.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div
      ref={wrapRef}
      className={[
        "chart-correlation-wrap",
        fill ? "chart-correlation-wrap-fill" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={fill ? "none" : undefined}
        className={["chart-correlation", fill ? "chart-correlation-fill" : ""].filter(Boolean).join(" ")}
        role="img"
      >
        {fill
          ? yTicks.map((tick) => {
              const y = pad.top + plotH - (tick / 100) * plotH;
              return (
                <g key={`y-${tick}`}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={pad.left + plotW}
                    y2={y}
                    className="chart-correlation-grid"
                  />
                  <text x={yAxisLabelX} y={y + 4} className="chart-correlation-axis-label" textAnchor="end">
                    {tick}
                  </text>
                </g>
              );
            })
          : null}
        {fill
          ? yTicks.map((tick) => {
              const x = pad.left + (tick / 100) * plotW;
              return (
                <line
                  key={`x-${tick}`}
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={pad.top + plotH}
                  className="chart-correlation-grid"
                />
              );
            })
          : null}
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={pad.left + plotW}
          y2={pad.top + plotH}
          className="chart-correlation-axis"
        />
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + plotH}
          className="chart-correlation-axis"
        />
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={pad.left + plotW}
          y2={pad.top}
          className="chart-correlation-guide"
        />
        <text x={pad.left + plotW / 2} y={height - 8} className="chart-correlation-axis-label" textAnchor="middle">
          {fromLabel.replace(/^Incoming /, "")}
        </text>
        <text
          x={fill ? 8 : 12}
          y={pad.top + plotH / 2}
          className="chart-correlation-axis-label"
          textAnchor="middle"
          transform={`rotate(-90 ${fill ? 8 : 12} ${pad.top + plotH / 2})`}
        >
          {toLabel.replace(/^Incoming /, "")}
        </text>
        {points.map((point, index) => {
          const x = pad.left + (point.fromScore / 100) * plotW;
          const y = pad.top + plotH - (point.toScore / 100) * plotH;
          return <circle key={index} cx={x} cy={y} r={4} className="chart-correlation-dot" opacity={0.7} />;
        })}
      </svg>
      {!fill ? (
        <p className="muted chart-correlation-note">
          Each dot is one student. Points on the diagonal held steady; above improved, below declined.
        </p>
      ) : null}
    </div>
  );
}

export function DomainProgressionLineChart({
  domains,
}: {
  domains: Array<{
    bloomLevel: string;
    label: string;
    shortLabel: string;
    points: Array<{ yearLevel: number; score: number | null; hasData: boolean }>;
  }>;
}) {
  const activeDomains = useMemo(
    () => domains.filter((domain) => domain.points.some((point) => point.hasData)),
    [domains]
  );
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setVisibleLevels(new Set(activeDomains.map((domain) => domain.bloomLevel)));
  }, [domains, activeDomains]);

  if (activeDomains.length === 0) {
    return <p className="muted">No domain scores across year levels yet for this student.</p>;
  }

  const visibleDomains = activeDomains.filter((domain) => visibleLevels.has(domain.bloomLevel));

  const toggleDomain = (bloomLevel: string) => {
    setVisibleLevels((current) => {
      const next = new Set(current);
      if (next.has(bloomLevel)) {
        next.delete(bloomLevel);
      } else {
        next.add(bloomLevel);
      }
      return next;
    });
  };

  const selectAll = () => {
    setVisibleLevels(new Set(activeDomains.map((domain) => domain.bloomLevel)));
  };

  const clearAll = () => {
    setVisibleLevels(new Set());
  };

  const width = 520;
  const height = 260;
  const { pad, plotW, plotH, xForYear, yForScore } = domainChartLayout(width, height);

  return (
    <div className="chart-progression-wrap submission-domain-chart">
      <div className="chart-progression-controls">
        <span className="chart-progression-controls-label">Show domains</span>
        <button type="button" className="btn secondary btn-sm" onClick={selectAll}>
          Select all
        </button>
        <button type="button" className="btn secondary btn-sm" onClick={clearAll}>
          Clear all
        </button>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-progression" role="img">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = pad.top + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} className="chart-progression-grid" />
              <text x={pad.left - 6} y={y + 4} className="chart-progression-axis-label" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        {visibleDomains.map((domain) => {
          const color = domainSeriesColor(domain.bloomLevel);
          const points = seriesPlotPoints(domain, xForYear, yForScore);
          const linePath = buildSmoothPath(points);

          return (
            <g key={domain.bloomLevel}>
              <path d={linePath} fill="none" stroke={color} strokeWidth={2.25} />
              {points.map((point) => (
                <circle key={`${domain.bloomLevel}-${point.yearLevel}`} cx={point.x} cy={point.y} r={2.5} fill={color}>
                  <title>
                    {domain.shortLabel} Y{point.yearLevel}: {point.score}%
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {DOMAIN_YEAR_LEVELS.map((yearLevel) => (
          <text
            key={yearLevel}
            x={xForYear(yearLevel)}
            y={height - 28}
            className="chart-progression-milestone-label"
            textAnchor="middle"
          >
            Year {yearLevel}
          </text>
        ))}
        <text
          x={width / 2}
          y={height - 8}
          className="chart-progression-axis-label"
          textAnchor="middle"
        >
          Incoming year progression
        </text>
      </svg>
      <ul className="chart-progression-legend">
        {activeDomains.map((domain) => {
          const checked = visibleLevels.has(domain.bloomLevel);
          return (
            <li key={domain.bloomLevel}>
              <label className={`chart-progression-legend-item${checked ? "" : " is-off"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDomain(domain.bloomLevel)}
                />
                <span
                  className="chart-progression-legend-swatch"
                  style={{ background: domainSeriesColor(domain.bloomLevel) }}
                />
                <span>
                  {domain.shortLabel} · {domain.label.replace(/^L\d+\s*/, "")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {visibleDomains.length === 0 ? (
        <p className="muted chart-progression-note">Select one or more domains above to show trend lines.</p>
      ) : (
        <p className="muted chart-progression-note">
          Each line tracks one cognitive domain (L1–L6) from Year 1 through Year 4 using the student&apos;s
          latest submitted exam at each year level.
        </p>
      )}
    </div>
  );
}
