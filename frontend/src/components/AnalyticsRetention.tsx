import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ChartCard from "./charts/ChartCard";
import {
  BloomCognitiveGapChart,
  DemographicsBloomTable,
  DonutChart,
  PerformanceHeatmap,
  RadarChart,
} from "./charts/AnalyticsCharts";
import SwappableChartGrid from "./SwappableChartGrid";
import { useChartOrder } from "../hooks/useChartOrder";
import { RETENTION_CHART_LAYOUT } from "../lib/analyticsLayout";
import { api } from "../lib/api";
import { useAnalyticsSeason } from "../lib/analyticsSeason";
import AnalyticsSeasonControl from "./AnalyticsSeasonControl";
import { MIN_YEAR_LEVEL, incomingYearLevelsForFilter } from "../lib/constants";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { BLOOM_LEVEL_LABELS, BLOOM_LEVEL_SHORT_LABELS, type BloomLevelId } from "../lib/bloomLevel";
import { DIFFICULTY_LABELS, scoreDonutVariant, scoreToTone } from "../lib/analyticsChartUtils";

interface RetentionData {
  studentsInScope: number;
  studentsWithComprehensive: number;
  studentsWithDemographics: number;
  showProgramBreakdown: boolean;
  schoolType: {
    overallScores: Array<{ label: string; value: number; count: number }>;
    bloomGaps: Array<{ bloomLevel: string; label: string; gap: number }>;
    bloomComparison: Array<{
      bloomLevel: string;
      label: string;
      public: number | null;
      private: number | null;
    }>;
    topicGaps: Array<{
      label: string;
      gap: number;
      publicScore: number;
      privateScore: number;
    }>;
    topicComparison: Array<{ label: string; public: number; private: number }>;
    difficultyComparison: Array<{
      difficulty: string;
      label: string;
      public: number | null;
      private: number | null;
    }>;
    atRiskShare: Array<{
      label: string;
      assessed: number;
      atRisk: number;
      rate: number;
    }>;
  };
  gender: {
    bloomComparison: Array<{
      bloomLevel: string;
      label: string;
      male: number;
      female: number;
    }>;
    topicComparison: Array<{ label: string; male: number; female: number }>;
    difficultyComparison: Array<{
      difficulty: string;
      label: string;
      male: number | null;
      female: number | null;
    }>;
    atRiskShare: Array<{
      label: string;
      assessed: number;
      atRisk: number;
      rate: number;
    }>;
  };
  programs: Array<{
    programCourse: string;
    averageScore: number;
    studentCount: number;
    l1L2Readiness: number;
    l3Readiness: number;
  }>;
  programTopics: {
    columns: string[];
    rows: Array<{ label: string; scores: Array<number | null> }>;
  };
}

interface Props {
  token: string | null;
}

const RETENTION_PROGRAM_CHART_IDS = [
  "program-score",
  "program-l1l2-readiness",
  "program-l3-readiness",
  "program-topic",
] as const;

const RETENTION_CHART_ORDER = [
  "school-overall",
  "school-bloom",
  "school-bloom-gap",
  "school-difficulty",
  "school-topic-gap",
  "school-topic",
  "school-at-risk",
  "gender-difficulty",
  "gender-at-risk",
  "gender-bloom",
  "gender-topic",
  ...RETENTION_PROGRAM_CHART_IDS,
] as const;

type RetentionChartId = (typeof RETENTION_CHART_ORDER)[number];

function RetentionDonutPair({
  rows,
  mode,
}: {
  rows: Array<{ label: string; value: number; count: number; atRisk?: number }>;
  mode: "averageScore" | "atRisk";
}) {
  const visibleRows = rows.filter((row) => row.count > 0);
  if (visibleRows.length === 0) {
    return <p className="muted">No data yet.</p>;
  }

  return (
    <div className="overview-pass-donut-grid">
      {visibleRows.map((row) => (
        <div key={row.label} className="overview-pass-donut-item">
          <span className="overview-pass-donut-title">{row.label}</span>
          {mode === "averageScore" ? (
            <DonutChart
              metric="averageScore"
              value={row.value}
              exams={row.count}
              variant={scoreDonutVariant(row.value)}
            />
          ) : (
            <DonutChart
              variant="risk"
              value={row.value}
              label="at risk"
              passed={row.count - (row.atRisk ?? 0)}
              failed={row.atRisk ?? 0}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RetentionProgramDonuts({
  programs,
  metric,
}: {
  programs: RetentionData["programs"];
  metric: "averageScore" | "l1L2Readiness" | "l3Readiness";
}) {
  if (programs.length === 0) {
    return <p className="muted">No program data yet.</p>;
  }

  const metricValue = (row: RetentionData["programs"][number]) => {
    if (metric === "averageScore") return row.averageScore;
    if (metric === "l1L2Readiness") return row.l1L2Readiness;
    return row.l3Readiness;
  };

  const metricLabel =
    metric === "averageScore" ? "avg score" : metric === "l1L2Readiness" ? "L1–L2" : "L3";

  return (
    <div className="demographics-program-donut-grid overview-pass-donut-grid">
      {programs.map((row) => {
        const value = metricValue(row);
        return (
          <div key={row.programCourse} className="overview-pass-donut-item">
            <span className="overview-pass-donut-title">{formatProgramCourse(row.programCourse)}</span>
            <DonutChart
              metric="averageScore"
              value={value}
              exams={row.studentCount}
              label={metricLabel}
              variant={scoreDonutVariant(value)}
            />
          </div>
        );
      })}
    </div>
  );
}

function renderRetentionChart(id: RetentionChartId, data: RetentionData): ReactNode {
  switch (id) {
    case "school-overall":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair"
          title="Overall retention score by school type"
          description="Average latest comprehensive score — public vs private."
        >
          <RetentionDonutPair
            mode="averageScore"
            rows={data.schoolType.overallScores.map((row) => ({
              label: row.label,
              value: row.value,
              count: row.count,
            }))}
          />
        </ChartCard>
      );
    case "school-bloom": {
      const bloomRows = data.schoolType.bloomComparison.map((row) => ({
        id: row.bloomLevel,
        label: BLOOM_LEVEL_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
        shortLabel: BLOOM_LEVEL_SHORT_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
        public: row.public,
        private: row.private,
      }));

      return (
        <ChartCard
          className="analytics-chart-card-demographics-table"
          title="L1–L6 retention by school"
          description="Correct rate by cognitive level — public vs private."
        >
          <DemographicsBloomTable
            rows={bloomRows.map((row) => ({
              label: row.label,
              left: row.public,
              right: row.private,
            }))}
            leftLabel="Public"
            rightLabel="Private"
          />
        </ChartCard>
      );
    }
    case "school-bloom-gap":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-bloom-gap"
          title="Cognitive Performance Comparison"
          description="Public vs private correct rate across Bloom levels."
        >
          <BloomCognitiveGapChart
            fillContainer
            rows={data.schoolType.bloomComparison.map((row) => ({
              id: row.bloomLevel,
              label: BLOOM_LEVEL_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
              shortLabel:
                BLOOM_LEVEL_SHORT_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
              left: row.public,
              right: row.private,
            }))}
            leftSeries={{ label: "Public", color: "#007AFF" }}
            rightSeries={{ label: "Private", color: "#34C759" }}
          />
        </ChartCard>
      );
    case "school-difficulty":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Difficulty retention by school"
          description="Easy / Medium / Hard correct rate — public vs private."
        >
          <PerformanceHeatmap
            columnLabels={["Public", "Private"]}
            rows={data.schoolType.difficultyComparison.map((row) => ({
              id: row.difficulty,
              label: DIFFICULTY_LABELS[row.difficulty] ?? row.label,
              cells: [
                row.public != null
                  ? { score: row.public, tone: scoreToTone(row.public) }
                  : null,
                row.private != null
                  ? { score: row.private, tone: scoreToTone(row.private) }
                  : null,
              ],
            }))}
          />
        </ChartCard>
      );
    case "school-at-risk":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair"
          title="At-risk share by school"
          description="Share of students below 75% on their latest comprehensive exam."
        >
          <RetentionDonutPair
            mode="atRisk"
            rows={data.schoolType.atRiskShare.map((row) => ({
              label: row.label,
              value: row.rate,
              count: row.assessed,
              atRisk: row.atRisk,
            }))}
          />
        </ChartCard>
      );
    case "school-topic-gap":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Topic retention gap"
          description="Public vs private correct rate on topics with the largest gaps."
        >
          <PerformanceHeatmap
            columnLabels={["Public", "Private"]}
            rows={data.schoolType.topicGaps.map((row) => ({
              id: row.label,
              label: row.label,
              sublabel: `${row.gap.toFixed(0)} pt gap`,
              cells: [
                { score: row.publicScore, tone: scoreToTone(row.publicScore) },
                { score: row.privateScore, tone: scoreToTone(row.privateScore) },
              ],
            }))}
          />
        </ChartCard>
      );
    case "school-topic":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Topic retention by school"
          description="Shared topics with comprehensive attempts for both groups."
        >
          <PerformanceHeatmap
            columnLabels={["Public", "Private"]}
            rows={data.schoolType.topicComparison.map((row) => ({
              id: row.label,
              label: row.label,
              cells: [
                { score: row.public, tone: scoreToTone(row.public) },
                { score: row.private, tone: scoreToTone(row.private) },
              ],
            }))}
          />
        </ChartCard>
      );
    case "gender-bloom": {
      const genderBloomRows = data.gender.bloomComparison.map((row) => ({
        label: BLOOM_LEVEL_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
        shortLabel: BLOOM_LEVEL_SHORT_LABELS[row.bloomLevel as BloomLevelId] ?? row.label,
        male: row.male,
        female: row.female,
      }));

      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-radar"
          title="L1–L6 retention by gender"
          description="Cognitive retention profile — male vs female across Bloom levels."
        >
          {genderBloomRows.length < 3 ? (
            <p className="muted">Need at least 3 Bloom levels for a radar chart.</p>
          ) : (
            <RadarChart
              fillContainer
              maxLabelLength={14}
              topics={genderBloomRows.map((row) => row.shortLabel)}
              studentScores={genderBloomRows.map((row) => row.male)}
              classScores={genderBloomRows.map((row) => row.female)}
              seriesLabels={{ primary: "Male", secondary: "Female" }}
            />
          )}
        </ChartCard>
      );
    }
    case "gender-topic":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Topic retention by gender"
          description="Shared topics with comprehensive attempts for both groups."
        >
          <PerformanceHeatmap
            columnLabels={["Male", "Female"]}
            rows={data.gender.topicComparison.map((row) => ({
              id: row.label,
              label: row.label,
              cells: [
                { score: row.male, tone: scoreToTone(row.male) },
                { score: row.female, tone: scoreToTone(row.female) },
              ],
            }))}
          />
        </ChartCard>
      );
    case "gender-difficulty":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Difficulty retention by gender"
          description="Easy / Medium / Hard correct rate — male vs female."
        >
          <PerformanceHeatmap
            columnLabels={["Male", "Female"]}
            rows={data.gender.difficultyComparison.map((row) => ({
              id: row.difficulty,
              label: DIFFICULTY_LABELS[row.difficulty] ?? row.label,
              cells: [
                row.male != null ? { score: row.male, tone: scoreToTone(row.male) } : null,
                row.female != null
                  ? { score: row.female, tone: scoreToTone(row.female) }
                  : null,
              ],
            }))}
          />
        </ChartCard>
      );
    case "gender-at-risk":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair"
          title="At-risk share by gender"
          description="Share of students below 75% on their latest comprehensive exam."
        >
          <RetentionDonutPair
            mode="atRisk"
            rows={data.gender.atRiskShare.map((row) => ({
              label: row.label,
              value: row.rate,
              count: row.assessed,
              atRisk: row.atRisk,
            }))}
          />
        </ChartCard>
      );
    case "program-score":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair analytics-chart-card-program-donuts"
          title="Retention score by program"
          description="Average latest comprehensive score per enrolled program."
        >
          <RetentionProgramDonuts programs={data.programs} metric="averageScore" />
        </ChartCard>
      );
    case "program-l1l2-readiness":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair analytics-chart-card-program-donuts"
          title="L1–L2 retention by program"
          description="Recall and comprehension average (Knowledge, Comprehension)."
        >
          <RetentionProgramDonuts programs={data.programs} metric="l1L2Readiness" />
        </ChartCard>
      );
    case "program-l3-readiness":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-donut-pair analytics-chart-card-program-donuts"
          title="L3 retention by program"
          description="Application-level correct rate by enrolled program."
        >
          <RetentionProgramDonuts programs={data.programs} metric="l3Readiness" />
        </ChartCard>
      );
    case "program-topic":
      return (
        <ChartCard
          className="analytics-chart-card-balanced analytics-chart-card-heatmap"
          title="Topic strengths by program"
          description="Shared topics with comprehensive attempts across programs."
        >
          {data.programTopics.rows.length === 0 ? (
            <p className="muted">No shared topic data across programs yet.</p>
          ) : (
            <PerformanceHeatmap
              columnLabels={data.programTopics.columns.map((programCourse) =>
                formatProgramCourse(programCourse)
              )}
              rows={data.programTopics.rows.map((row) => ({
                id: row.label,
                label: row.label,
                cells: row.scores.map((score) =>
                  score != null ? { score, tone: scoreToTone(score) } : null
                ),
              }))}
            />
          )}
        </ChartCard>
      );
    default:
      return null;
  }
}

export default function AnalyticsRetention({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const { appendExamYear, seasonLabel } = useAnalyticsSeason();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  const [chartOrder, setChartOrder] = useChartOrder(
    "analytics-retention-chart-order-v2",
    RETENTION_CHART_ORDER
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    appendExamYear(params);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [courseFilter, yearFilter, appendExamYear]);

  const filterSubtitle = useMemo(() => {
    const parts = [
      courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
      yearFilter === "ALL" ? "All year levels" : `Incoming year ${yearFilter}`,
      seasonLabel,
      "Comprehensive + retake",
    ];
    return parts.join(" · ");
  }, [courseFilter, yearFilter, seasonLabel]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    api<RetentionData>(`/analytics/retention${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load retention analytics"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  const showProgramCharts = Boolean(
    data?.showProgramBreakdown && (data?.programs.length ?? 0) > 0
  );

  const activeChartOrder = useMemo(
    () =>
      chartOrder.filter(
        (id) =>
          showProgramCharts ||
          !RETENTION_PROGRAM_CHART_IDS.includes(
            id as (typeof RETENTION_PROGRAM_CHART_IDS)[number]
          )
      ),
    [chartOrder, showProgramCharts]
  );

  function handleChartOrderChange(nextActiveOrder: string[]) {
    if (showProgramCharts) {
      setChartOrder(nextActiveOrder);
      return;
    }

    setChartOrder([
      ...nextActiveOrder,
      ...chartOrder.filter((id) =>
        RETENTION_PROGRAM_CHART_IDS.includes(id as (typeof RETENTION_PROGRAM_CHART_IDS)[number])
      ),
    ]);
  }

  const emptyMessage =
    yearFilter === String(MIN_YEAR_LEVEL)
      ? "Incoming year 1 students do not take comprehensive exams. Try year 2 or above."
      : "No comprehensive exam data yet for this filter.";

  if (loading && !data) {
    return <p className="muted">Loading retention analytics...</p>;
  }

  if (!data) {
    return error ? <p className="error">{error}</p> : null;
  }

  return (
    <AnalyticsPrintArea
      id="analytics-print-retention"
      title="Analytics — Retention"
      subtitle={filterSubtitle}
    >
      <div className={`analytics-retention analytics-demographics${refreshing ? " is-refreshing" : ""}`}>
        <AnalyticsSeasonControl />
        <p className="muted analytics-segment-note analytics-no-print">
          Based on comprehensive and retake exams — retention by school type, gender, and program.
        </p>
        <div className="analytics-reports-filter analytics-no-print">
          <div className="analytics-reports-filters">
            <label className="analytics-reports-filter-field">
              Course
              <select
                value={courseFilter}
                onChange={(event) =>
                  setCourseFilter(event.target.value as ProgramCourseFilter)
                }
              >
                <option value="ALL">All</option>
                {programCourseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="analytics-reports-filter-field">
              Year level
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="ALL">All</option>
                {incomingYearLevelsForFilter(courseFilter).map((level) => (
                  <option key={level} value={String(level)}>
                    Incoming year {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="analytics-demographics-summary">
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">Students in scope</span>
            <strong>{data.studentsInScope}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">With comprehensive</span>
            <strong>{data.studentsWithComprehensive}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">With demographics</span>
            <strong>{data.studentsWithDemographics}</strong>
          </article>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {data.studentsWithComprehensive === 0 ? (
          <p className="muted">{emptyMessage}</p>
        ) : (
          <SwappableChartGrid
            order={activeChartOrder}
            onOrderChange={handleChartOrderChange}
            slotLayout={RETENTION_CHART_LAYOUT}
          >
            {(id) => renderRetentionChart(id as RetentionChartId, data)}
          </SwappableChartGrid>
        )}
      </div>
    </AnalyticsPrintArea>
  );
}
