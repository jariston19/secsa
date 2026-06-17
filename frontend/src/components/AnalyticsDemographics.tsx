import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ChartCard from "./charts/ChartCard";
import {
  ChartIconBars,
  HorizontalBarChart,
  PairedHorizontalBarChart,
} from "./charts/AnalyticsCharts";
import SwappableChartGrid, { ChartReorderHint } from "./SwappableChartGrid";
import { useChartOrder } from "../hooks/useChartOrder";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

interface DemographicsData {
  studentsInScope: number;
  studentsWithDiagnostic: number;
  studentsWithDemographics: number;
  showProgramBreakdown: boolean;
  schoolType: {
    overallScores: Array<{ label: string; value: number; count: number }>;
    bloomGaps: Array<{ bloomLevel: string; label: string; gap: number }>;
    topicGaps: Array<{
      label: string;
      gap: number;
      publicScore: number;
      privateScore: number;
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
  };
  programs: Array<{
    programCourse: string;
    averageScore: number;
    studentCount: number;
    higherOrderReadiness: number;
  }>;
}

interface Props {
  token: string | null;
}

const SCHOOL_COLORS = {
  Public: "#007AFF",
  Private: "#34C759",
};

const DEMOGRAPHICS_CHART_ORDER = [
  "school-overall",
  "school-bloom-gap",
  "school-topic-gap",
  "gender-bloom",
  "gender-topic",
  "program-score",
  "program-readiness",
] as const;

type DemographicsChartId = (typeof DEMOGRAPHICS_CHART_ORDER)[number];

const DEMOGRAPHICS_WIDE_CHART_IDS: DemographicsChartId[] = ["gender-bloom", "gender-topic"];

const PROGRAM_CHART_COLORS = ["#34C759", "#007AFF", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

function renderDemographicsChart(id: DemographicsChartId, data: DemographicsData): ReactNode {
  switch (id) {
    case "school-overall": {
      const schoolOverallBars = data.schoolType.overallScores
        .filter((row) => row.count > 0)
        .map((row) => ({
          label: row.label,
          value: row.value,
          color: SCHOOL_COLORS[row.label as keyof typeof SCHOOL_COLORS] ?? "#64748b",
        }));

      return (
        <ChartCard
          className="analytics-chart-card-balanced"
          title="Overall diagnostic score by school type"
          description="Average latest diagnostic score — public vs private."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <HorizontalBarChart bars={schoolOverallBars} valueDecimals={0} />
        </ChartCard>
      );
    }
    case "school-bloom-gap":
      return (
        <ChartCard
          className="analytics-chart-card-balanced"
          title="L1–L6 cognitive gap"
          description="Absolute score gap between school types at each Bloom level."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <HorizontalBarChart
            bars={data.schoolType.bloomGaps.map((row) => ({
              label: row.label,
              value: row.gap,
              tone: row.gap >= 20 ? "weak" : row.gap >= 10 ? "moderate" : "strong",
            }))}
            suffix=" pt"
            valueDecimals={0}
          />
        </ChartCard>
      );
    case "school-topic-gap":
      return (
        <ChartCard
          className="analytics-chart-card-balanced"
          title="Topic gap heatmap"
          description="Largest subject/topic gaps between public and private."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <HorizontalBarChart
            bars={data.schoolType.topicGaps.map((row) => ({
              label: row.label,
              value: row.gap,
              tone: row.gap >= 20 ? "weak" : row.gap >= 10 ? "moderate" : "strong",
            }))}
            suffix=" pt"
            valueDecimals={0}
          />
        </ChartCard>
      );
    case "gender-bloom":
      return (
        <ChartCard
          className="analytics-chart-card-wide"
          title="L1–L6 by gender"
          description="Average diagnostic performance by cognitive level."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <PairedHorizontalBarChart
            rows={data.gender.bloomComparison.map((row) => ({
              label: row.label,
              left: row.male,
              right: row.female,
            }))}
            leftSeries={{ label: "Male", color: "#007AFF" }}
            rightSeries={{ label: "Female", color: "#34C759" }}
          />
        </ChartCard>
      );
    case "gender-topic":
      return (
        <ChartCard
          className="analytics-chart-card-wide"
          title="Topic strengths by gender"
          description="Shared topics with diagnostic attempts for both groups."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <PairedHorizontalBarChart
            rows={data.gender.topicComparison.map((row) => ({
              label: row.label,
              left: row.male,
              right: row.female,
            }))}
            leftSeries={{ label: "Male", color: "#007AFF" }}
            rightSeries={{ label: "Female", color: "#34C759" }}
          />
        </ChartCard>
      );
    case "program-score": {
      const programScoreBars = data.programs.map((row, index) => ({
        label: formatProgramCourse(row.programCourse),
        value: row.averageScore,
        color: PROGRAM_CHART_COLORS[index % PROGRAM_CHART_COLORS.length],
      }));

      return (
        <ChartCard
          className="analytics-chart-card-balanced"
          title="Diagnostic score by program"
          description="Average latest diagnostic score per enrolled program."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <HorizontalBarChart bars={programScoreBars} valueDecimals={0} />
        </ChartCard>
      );
    }
    case "program-readiness": {
      const programReadinessBars = data.programs.map((row, index) => ({
        label: formatProgramCourse(row.programCourse),
        value: row.higherOrderReadiness,
        color: PROGRAM_CHART_COLORS[index % PROGRAM_CHART_COLORS.length],
      }));

      return (
        <ChartCard
          className="analytics-chart-card-balanced"
          title="L4–L6 readiness by program"
          description="Higher-order thinking average (Analysis, Synthesis, Evaluation)."
          icon={<ChartIconBars direction="horizontal" />}
        >
          <HorizontalBarChart bars={programReadinessBars} valueDecimals={0} />
        </ChartCard>
      );
    }
    default:
      return null;
  }
}

export default function AnalyticsDemographics({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  const [chartOrder, setChartOrder] = useChartOrder(
    "analytics-demographics-chart-order",
    DEMOGRAPHICS_CHART_ORDER
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [courseFilter, yearFilter]);

  const filterSubtitle = useMemo(() => {
    const parts = [
      courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
      yearFilter === "ALL" ? "All year levels" : `Incoming year ${yearFilter}`,
    ];
    return parts.join(" · ");
  }, [courseFilter, yearFilter]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    api<DemographicsData>(`/analytics/demographics${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load demographics"))
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
        (id) => showProgramCharts || (id !== "program-score" && id !== "program-readiness")
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
      ...chartOrder.filter((id) => id === "program-score" || id === "program-readiness"),
    ]);
  }

  if (loading && !data) {
    return <p className="muted">Loading demographic analytics...</p>;
  }

  if (!data) {
    return error ? <p className="error">{error}</p> : null;
  }

  return (
    <AnalyticsPrintArea
      id="analytics-print-demographics"
      title="Analytics — Demographics"
      subtitle={filterSubtitle}
    >
      <div className={`analytics-demographics${refreshing ? " is-refreshing" : ""}`}>
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
                {Array.from(
                  { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                  (_, index) => MIN_YEAR_LEVEL + index
                ).map((level) => (
                  <option key={level} value={String(level)}>
                    Incoming year {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="muted analytics-lens-intro">
          Compare incoming diagnostic readiness across school type, gender, and program. Uses each
          student&apos;s latest diagnostic attempt. Students without gender or school set are
          excluded from demographic splits.
        </p>

        <div className="analytics-demographics-summary">
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">Students in scope</span>
            <strong>{data.studentsInScope}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">With diagnostic</span>
            <strong>{data.studentsWithDiagnostic}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">With demographics</span>
            <strong>{data.studentsWithDemographics}</strong>
          </article>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {data.studentsWithDiagnostic === 0 ? (
          <p className="muted">No diagnostic exam data yet for this filter.</p>
        ) : (
          <>
            <ChartReorderHint />
            <SwappableChartGrid
              order={activeChartOrder}
              onOrderChange={handleChartOrderChange}
              wideIds={DEMOGRAPHICS_WIDE_CHART_IDS}
            >
              {(id) => renderDemographicsChart(id as DemographicsChartId, data)}
            </SwappableChartGrid>
          </>
        )}

        <section className="card analytics-demographics-caveat">
          <h2>Important caveat</h2>
          <p className="muted">
            Use these comparisons for equity insights and institutional planning — not as causal
            rankings. Gaps between public and private schools, gender groups, or programs highlight
            where bridging support may be needed before comprehensive exams.
          </p>
        </section>
      </div>
    </AnalyticsPrintArea>
  );
}
