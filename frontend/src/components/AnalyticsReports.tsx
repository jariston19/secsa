import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ModalPagination from "./ModalPagination";
import SwappableChartGrid, { ChartReorderHint } from "./SwappableChartGrid";
import ChartCard from "./charts/ChartCard";
import {
  ChartIconBars,
  ChartIconDonut,
  ChartIconHeatmap,
  ChartIconRadar,
  ChartIconScatter,
  CoverageHeatmap,
  DifficultyAlignmentChart,
  DiscriminationScatter,
  DonutChart,
  GroupedDifficultyBars,
  HorizontalBarChart,
  PercentileBand,
  PerformanceHeatmap,
  TimeCorrectnessScatter,
  TimePerQuestionBars,
  TopicFlagGrid,
  RadarChart,
  VerticalHistogram,
} from "./charts/AnalyticsCharts";
import DistractorAnalysisCarousel from "./charts/DistractorAnalysisCarousel";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { formatFullName } from "../lib/names";
import { DIFFICULTY_LABELS } from "../lib/analyticsChartUtils";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { usePagination } from "../hooks/usePagination";
import { useChartOrder } from "../hooks/useChartOrder";

const TOPIC_CHART_PAGE_SIZE = 5;

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

const GROUP_ANALYTICS_CHART_ORDER = [
  "pass-rate",
  "score-distribution",
  "average-score-topic",
  "performance-difficulty",
  "topic-difficulty-heatmap",
  "at-risk-topic",
] as const;

type GroupAnalyticsChartId = (typeof GROUP_ANALYTICS_CHART_ORDER)[number];

const STUDENT_ANALYTICS_CHART_ORDER = [
  "score-per-topic",
  "score-per-difficulty",
  "time-vs-correctness",
  "rank-batch",
  "weak-topics",
  "retake-improvement",
] as const;

type StudentAnalyticsChartId = (typeof STUDENT_ANALYTICS_CHART_ORDER)[number];

const QUESTION_ANALYTICS_CHART_ORDER = [
  "distractor-analysis",
  "correct-rate-expected",
  "discrimination-index",
  "avg-time-question",
  "topic-coverage",
] as const;

type QuestionAnalyticsChartId = (typeof QUESTION_ANALYTICS_CHART_ORDER)[number];

const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"] as const;

export type AnalyticsLens = "group" | "student" | "question";

const LENS_PRINT_TITLES: Record<AnalyticsLens, string> = {
  group: "Analytics — Group",
  student: "Analytics — Student",
  question: "Analytics — Question",
};

interface ReportsData {
  readiness: {
    overallScore: number;
    passingThreshold: number;
    readinessLevel: string;
    studentsAssessed: number;
    examsTaken: number;
    passRate: number;
    completionRate: number;
  };
  byTopic: Array<{
    topicId: string;
    topic: string;
    subject: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
    total: number;
    correct: number;
  }>;
  byDifficulty: Array<{
    difficulty: string;
    score: number;
    tone: "strong" | "moderate" | "weak";
    total: number;
    correct: number;
  }>;
  topicDifficultyMatrix: Array<{
    topicId: string;
    topic: string;
    subject: string;
    difficulty: string;
    score: number;
    total: number;
    correct: number;
    tone: "strong" | "moderate" | "weak";
  }>;
  atRiskByTopic: Array<{
    topicId: string;
    topic: string;
    subject: string;
    count: number;
  }>;
  knowledgeGaps: {
    strongAreas: Array<{ label: string; score: number; type: string }>;
    weakAreas: Array<{ label: string; score: number; type: string }>;
  };
  questionAnalysis: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    difficulty: string;
    correctRate: number;
    attempts: number;
    flag: "too_easy" | "too_hard" | null;
  }>;
  distractorAnalysis: Array<{
    questionId: string;
    text: string;
    subject: string;
    correctOption: string;
    correctRate: number;
    options: Array<{ option: string; count: number; rate: number; isCorrect: boolean }>;
    topWrongOption: string | null;
    topWrongRate: number;
  }>;
  readinessDistribution: Array<{ label: string; students: number }>;
  atRiskStudents: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    yearLevel: number | null;
    overallScore: number | null;
    reasons: string[];
  }>;
  questionReliability: Array<{
    questionId: string;
    text: string;
    subject: string;
    topic: string | null;
    difficulty: string;
    correctRate: number;
    avgTimeSeconds: number | null;
    discriminationIndex: number | null;
    attempts: number;
  }>;
  timeCorrectnessSamples: Array<{
    timeSeconds: number;
    correct: boolean;
    difficulty: string;
  }>;
  topicCoverageMatrix: Array<{
    topicId: string;
    topic: string;
    subject: string;
    easy: number;
    medium: number;
    hard: number;
  }>;
  questionTimeBars: Array<{
    questionId: string;
    label: string;
    avgTimeSeconds: number;
  }>;
  passFail: { passed: number; failed: number };
  scorePercentiles: { min: number; max: number; avg: number };
  cohortSummaries: Array<{
    programCourse: string;
    yearLevel: number;
    studentsAssessed: number;
    examsTaken: number;
    passRate: number;
    averageScore: number;
    readinessLevel: string;
  }>;
}

interface Props {
  token: string | null;
  lens: AnalyticsLens;
  onOpenQuestionPerformance?: () => void;
}

function truncate(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildTopicDifficultyRows(matrix: ReportsData["topicDifficultyMatrix"]) {
  return Object.values(
    matrix.reduce<
      Record<
        string,
        {
          topicId: string;
          topic: string;
          subject: string;
          cells: Partial<
            Record<(typeof DIFFICULTY_ORDER)[number], { score: number; tone: string; total: number }>
          >;
        }
      >
    >((groups, row) => {
      const group = groups[row.topicId] ?? {
        topicId: row.topicId,
        topic: row.topic,
        subject: row.subject,
        cells: {},
      };
      group.cells[row.difficulty as (typeof DIFFICULTY_ORDER)[number]] = {
        score: row.score,
        tone: row.tone,
        total: row.total,
      };
      groups[row.topicId] = group;
      return groups;
    }, {})
  );
}

export default function AnalyticsReports({ token, lens, onOpenQuestionPerformance }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "ALL") params.set("yearLevel", yearFilter);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [courseFilter, yearFilter]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<ReportsData>(`/analytics/reports${query}`, {}, token)
      .then((data) => {
        setReports(data);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  const lensIntro =
    lens === "group"
      ? "Charts teachers and admins see about the whole batch."
      : lens === "student"
        ? "Charts each student sees about themselves. Cohort-level view below — open Submissions for individual detail."
        : "Item analysis for question writers and teachers.";

  const printAreaId = `analytics-print-${lens}`;
  const printTitle = LENS_PRINT_TITLES[lens];
  const printSubtitle = [
    courseFilter === "ALL" ? "All" : formatProgramCourse(courseFilter),
    yearFilter === "ALL" ? "All" : `Year ${yearFilter}`,
  ].join(" · ");

  const filterKey = `${courseFilter}|${yearFilter}`;

  return (
    <AnalyticsPrintArea
      id={printAreaId}
      title={printTitle}
      subtitle={printSubtitle}
    >
      <div className="analytics-reports">
        <div className="analytics-reports-filter analytics-no-print">
          <div className="analytics-reports-filter-primary">
            <div className="analytics-reports-filters">
              <label className="analytics-reports-filter-field">
                Course
                <select
                  value={courseFilter}
                  onChange={(e) =>
                    setCourseFilter(e.target.value as ProgramCourseFilter)
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
                Year
                <select
                  value={yearFilter}
                  onChange={(e) =>
                    setYearFilter(e.target.value as YearLevelFilter)
                  }
                >
                  <option value="ALL">All</option>
                  {Array.from(
                    { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                    (_, i) => MIN_YEAR_LEVEL + i
                  ).map((level) => (
                    <option key={level} value={String(level)}>
                      Year {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        {lens === "question" && onOpenQuestionPerformance ? (
          <div className="analytics-question-performance-launch">
            <div className="analytics-question-performance-copy">
              <span className="analytics-question-performance-title">Question Performance</span>
              <span className="muted">
                Review correct rates by subject, topic, and difficulty — lowest first.
              </span>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={onOpenQuestionPerformance}
            >
              View Performance
            </button>
          </div>
        ) : null}
        </div>

      <p className="muted analytics-lens-intro">{lensIntro}</p>

      {error && !reports ? <p className="error">{error}</p> : null}
      {loading && !reports ? <p className="muted">Loading analytics reports...</p> : null}

      {reports ? (
        <AnalyticsReportBody
          reports={reports}
          lens={lens}
          refreshing={refreshing}
          error={error}
          filterKey={filterKey}
          yearFilter={yearFilter}
          courseFilter={courseFilter}
        />
      ) : null}
      </div>
    </AnalyticsPrintArea>
  );
}

export function AnalyticsReportBody({
  reports,
  lens,
  refreshing,
  error,
  filterKey = "ALL|ALL",
  yearFilter = "ALL",
  courseFilter = "ALL",
}: {
  reports: ReportsData;
  lens: AnalyticsLens;
  refreshing: boolean;
  error: string;
  filterKey?: string;
  yearFilter?: YearLevelFilter;
  courseFilter?: ProgramCourseFilter;
}) {
  const filterLabel = [
    courseFilter === "ALL" ? null : formatProgramCourse(courseFilter),
    yearFilter === "ALL" ? null : `Year ${yearFilter}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const maxAtRisk = Math.max(...reports.atRiskByTopic.map((row) => row.count), 1);
  const difficultyColumnLabels = DIFFICULTY_ORDER.map((d) => DIFFICULTY_LABELS[d]);

  const topicBars = reports.byTopic.map((row) => ({
    label: `${row.topic} (${row.subject})`,
    value: row.score,
    tone: row.tone,
  }));

  const atRiskBars = reports.atRiskByTopic.map((row) => ({
    label: `${row.topic} (${row.subject})`,
    value: row.count,
    color: "#ef4444",
  }));

  const topicFlagItems = [
    ...reports.knowledgeGaps.weakAreas.map((area) => ({
      label: area.label,
      score: area.score,
      tone: "weak" as const,
    })),
    ...reports.knowledgeGaps.strongAreas.map((area) => ({
      label: area.label,
      score: area.score,
      tone: "strong" as const,
    })),
  ];

  const radarTopics = reports.byTopic.slice(0, 8).map((row) => row.topic);
  const classRadarScores = reports.byTopic.slice(0, 8).map((row) => row.score);

  const alignmentItems = reports.questionAnalysis.slice(0, 8).map((row) => ({
    label: truncate(row.text, 36),
    difficulty: row.difficulty,
    correctRate: row.correctRate,
  }));

  const discriminationPoints = reports.questionReliability
    .filter((row) => row.discriminationIndex != null)
    .slice(0, 40)
    .map((row) => ({
      id: row.questionId,
      label: truncate(row.text, 40),
      correctRate: row.correctRate,
      discriminationIndex: row.discriminationIndex!,
    }));

  const topicDifficultyRows = buildTopicDifficultyRows(reports.topicDifficultyMatrix);

  const topicHeatmapRows = useMemo(
    () =>
      topicDifficultyRows.map((row) => ({
        id: row.topicId,
        label: row.topic,
        sublabel: row.subject,
        cells: DIFFICULTY_ORDER.map((difficulty) => {
          const cell = row.cells[difficulty];
          return cell
            ? {
                score: cell.score,
                tone: cell.tone as "strong" | "moderate" | "weak",
                total: cell.total,
              }
            : null;
        }),
      })),
    [topicDifficultyRows]
  );

  const topicBarPagination = usePagination(topicBars, {
    pageSize: TOPIC_CHART_PAGE_SIZE,
    resetKey: topicBars.map((bar) => bar.label).join("|"),
  });

  const topicHeatmapPagination = usePagination(topicHeatmapRows, {
    pageSize: TOPIC_CHART_PAGE_SIZE,
    resetKey: topicHeatmapRows.map((row) => row.id).join("|"),
  });

  const topicCoverageRows = useMemo(
    () =>
      reports.topicCoverageMatrix.map((row) => ({
        id: row.topicId,
        label: row.topic,
        sublabel: row.subject,
        counts: [row.easy, row.medium, row.hard] as number[],
      })),
    [reports.topicCoverageMatrix]
  );

  const topicCoveragePagination = usePagination(topicCoverageRows, {
    pageSize: TOPIC_CHART_PAGE_SIZE,
    resetKey: topicCoverageRows.map((row) => row.id).join("|"),
  });

  const [groupChartOrder, setGroupChartOrder] = useChartOrder(
    "analytics-group-chart-order",
    GROUP_ANALYTICS_CHART_ORDER
  );

  const [studentChartOrder, setStudentChartOrder] = useChartOrder(
    "analytics-student-chart-order",
    STUDENT_ANALYTICS_CHART_ORDER
  );

  const [questionChartOrder, setQuestionChartOrder] = useChartOrder(
    "analytics-question-chart-order",
    QUESTION_ANALYTICS_CHART_ORDER
  );

  function renderGroupChart(id: GroupAnalyticsChartId): ReactNode {
    switch (id) {
      case "pass-rate":
        return (
          <ChartCard
            title="Pass rate"
            description="Pass vs fail split with a headline % for quick reporting."
            icon={<ChartIconDonut />}
          >
            <DonutChart
              value={reports.readiness.passRate}
              label="passed"
              passed={reports.passFail.passed}
              failed={reports.passFail.failed}
            />
          </ChartCard>
        );
      case "score-distribution":
        return (
          <ChartCard
            className="analytics-chart-card-balanced"
            title="Score distribution"
            description="Groups students into 10-point score ranges. Shows if class performance is clustered or split."
            icon={<ChartIconBars direction="vertical" />}
          >
            <VerticalHistogram
              buckets={reports.readinessDistribution.map((bucket) => ({
                label: bucket.label,
                value: bucket.students,
              }))}
            />
          </ChartCard>
        );
      case "average-score-topic":
        return (
          <ChartCard
            className="analytics-chart-card-balanced"
            title="Average score per topic"
            description="Topics on the Y-axis, average % correct on the X-axis. Ranks best vs worst retention."
            icon={<ChartIconBars direction="horizontal" />}
          >
            {topicBars.length === 0 ? (
              <p className="muted">No topic data yet.</p>
            ) : (
              <>
                <div className="analytics-chart-screen-only">
                  <HorizontalBarChart bars={topicBarPagination.paginatedItems} />
                  {topicBarPagination.totalPages > 1 ? (
                    <div className="chart-card-pagination analytics-no-print">
                      <ModalPagination
                        page={topicBarPagination.page}
                        totalPages={topicBarPagination.totalPages}
                        pageStart={topicBarPagination.pageStart}
                        pageEnd={topicBarPagination.pageEnd}
                        totalItems={topicBarPagination.totalItems}
                        onPageChange={topicBarPagination.setPage}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="analytics-print-only">
                  <HorizontalBarChart bars={topicBars} />
                </div>
              </>
            )}
          </ChartCard>
        );
      case "performance-difficulty":
        return (
          <ChartCard
            className="analytics-chart-card-paired analytics-chart-card-difficulty"
            title="Performance by difficulty"
            description="Easy, medium, and hard bars. Color shows how retention drops as difficulty rises."
            icon={<ChartIconBars direction="vertical" />}
          >
            <GroupedDifficultyBars items={reports.byDifficulty} />
          </ChartCard>
        );
      case "topic-difficulty-heatmap":
        return (
          <ChartCard
            className="analytics-chart-card-paired analytics-chart-card-heatmap"
            title="Topic × difficulty heatmap"
            description="Each cell is % correct on a red-to-green scale. The richest single batch view."
            icon={<ChartIconHeatmap />}
          >
            {topicHeatmapRows.length === 0 ? (
              <p className="muted">No topic and difficulty data yet.</p>
            ) : (
              <>
                <div className="analytics-chart-screen-only">
                  <PerformanceHeatmap
                    columnLabels={difficultyColumnLabels}
                    rows={topicHeatmapPagination.paginatedItems}
                  />
                  {topicHeatmapPagination.totalPages > 1 ? (
                    <div className="chart-card-pagination analytics-no-print">
                      <ModalPagination
                        page={topicHeatmapPagination.page}
                        totalPages={topicHeatmapPagination.totalPages}
                        pageStart={topicHeatmapPagination.pageStart}
                        pageEnd={topicHeatmapPagination.pageEnd}
                        totalItems={topicHeatmapPagination.totalItems}
                        onPageChange={topicHeatmapPagination.setPage}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="analytics-print-only">
                  <PerformanceHeatmap
                    columnLabels={difficultyColumnLabels}
                    rows={topicHeatmapRows}
                  />
                </div>
              </>
            )}
          </ChartCard>
        );
      case "at-risk-topic":
        return (
          <ChartCard
            title="At-risk count per topic"
            description="Students below threshold per topic. Red bars sorted by urgency."
            icon={<ChartIconBars direction="horizontal" />}
          >
            {atRiskBars.length === 0 ? (
              <p className="muted">No at-risk topic clusters yet.</p>
            ) : (
              <HorizontalBarChart
                bars={atRiskBars}
                max={maxAtRisk}
                suffix={atRiskBars[0]?.value === 1 ? " student" : " students"}
                valueDecimals={0}
              />
            )}
          </ChartCard>
        );
      default:
        return null;
    }
  }

  function renderStudentChart(id: StudentAnalyticsChartId): ReactNode {
    switch (id) {
      case "score-per-topic":
        return (
          <ChartCard
            title="Score per topic"
            description="Radar chart: each axis is a topic. Overlay student shape against class average."
            icon={<ChartIconRadar />}
          >
            {radarTopics.length < 3 ? (
              <p className="muted">Need at least 3 topics for a radar chart.</p>
            ) : (
              <RadarChart
                topics={radarTopics}
                classScores={classRadarScores}
                studentScores={classRadarScores}
              />
            )}
          </ChartCard>
        );
      case "score-per-difficulty":
        return (
          <ChartCard
            title="Score per difficulty"
            description="Three bars for easy, medium, and hard. Shows where retention drops."
            icon={<ChartIconBars direction="vertical" />}
          >
            <GroupedDifficultyBars items={reports.byDifficulty} />
          </ChartCard>
        );
      case "time-vs-correctness":
        return (
          <ChartCard
            title="Time vs. correctness"
            description="X = time spent, Y = correct/wrong, bubble size = difficulty. Spots guessing vs confusion."
            icon={<ChartIconScatter />}
          >
            <TimeCorrectnessScatter points={reports.timeCorrectnessSamples} />
          </ChartCard>
        );
      case "rank-batch":
        return (
          <ChartCard
            title="Rank within batch"
            description="Percentile band showing score relative to class min, average, and max."
            icon={<ChartIconBars direction="horizontal" />}
          >
            <PercentileBand
              studentScore={reports.readiness.overallScore}
              min={reports.scorePercentiles.min}
              avg={reports.scorePercentiles.avg}
              max={reports.scorePercentiles.max}
            />
          </ChartCard>
        );
      case "weak-topics":
        return (
          <ChartCard
            title="Weak topics flagged"
            description="Traffic-light topic tiles for instant scan of what needs review."
            icon={<ChartIconHeatmap />}
          >
            {topicFlagItems.length === 0 ? (
              <p className="muted">No topic flags yet.</p>
            ) : (
              <TopicFlagGrid topics={topicFlagItems} />
            )}
          </ChartCard>
        );
      case "retake-improvement":
        return (
          <ChartCard
            title="Retake improvement"
            description="Attempt trend by topic. Rising lines show successful remediation."
            icon={<ChartIconBars direction="horizontal" />}
          >
            <p className="muted">
              Retake trend lines appear once students complete multiple attempts on the same topics.
            </p>
          </ChartCard>
        );
      default:
        return null;
    }
  }

  function renderQuestionChart(id: QuestionAnalyticsChartId): ReactNode {
    switch (id) {
      case "distractor-analysis":
        return (
          <ChartCard
            title="Distractor analysis"
            description="Four bars per question (A–D). Tall wrong bars signal common misconceptions."
            icon={<ChartIconBars direction="vertical" />}
            className="analytics-chart-card-wide analytics-chart-card-distractor"
          >
            {reports.distractorAnalysis.length === 0 ? (
              <p className="muted">No strong misconception patterns detected yet.</p>
            ) : (
              <DistractorAnalysisCarousel
                key={filterKey}
                resetKey={filterKey}
                yearLabel={filterLabel || undefined}
                items={reports.distractorAnalysis}
                truncate={truncate}
              />
            )}
          </ChartCard>
        );
      case "correct-rate-expected":
        return (
          <ChartCard
            title="Correct rate vs. expected difficulty"
            description="Bar shows actual correct rate; dashed band is the expected range for that difficulty."
            icon={<ChartIconBars direction="horizontal" />}
          >
            {alignmentItems.length === 0 ? (
              <p className="muted">No question analysis data yet.</p>
            ) : (
              <DifficultyAlignmentChart items={alignmentItems} />
            )}
          </ChartCard>
        );
      case "discrimination-index":
        return (
          <ChartCard
            title="Discrimination index"
            description="Scatter plot: correct rate vs discrimination. Low discrimination flags items for review."
            icon={<ChartIconScatter />}
          >
            <DiscriminationScatter points={discriminationPoints} />
          </ChartCard>
        );
      case "avg-time-question":
        return (
          <ChartCard
            title="Average time per question"
            description="Horizontal bars sorted by time. Long outliers may indicate confusing wording."
            icon={<ChartIconBars direction="horizontal" />}
          >
            {reports.questionTimeBars.length === 0 ? (
              <p className="muted">
                Per-question timing appears after students complete exams using the one-question flow.
              </p>
            ) : (
              <TimePerQuestionBars
                items={reports.questionTimeBars.map((row) => ({
                  id: row.questionId,
                  label: row.label,
                  avgTimeSeconds: row.avgTimeSeconds,
                }))}
              />
            )}
          </ChartCard>
        );
      case "topic-coverage":
        return (
          <ChartCard
            className="analytics-chart-card-heatmap"
            title="Topic coverage check"
            description="Question count per topic × difficulty. Empty cells reveal gaps in the bank."
            icon={<ChartIconHeatmap />}
          >
            {reports.topicCoverageMatrix.length === 0 ? (
              <p className="muted">No question inventory yet.</p>
            ) : (
              <>
                <div className="analytics-chart-screen-only">
                  <CoverageHeatmap
                    columnLabels={difficultyColumnLabels}
                    rows={topicCoveragePagination.paginatedItems}
                  />
                  {topicCoveragePagination.totalPages > 1 ? (
                    <div className="chart-card-pagination analytics-no-print">
                      <ModalPagination
                        page={topicCoveragePagination.page}
                        totalPages={topicCoveragePagination.totalPages}
                        pageStart={topicCoveragePagination.pageStart}
                        pageEnd={topicCoveragePagination.pageEnd}
                        totalItems={topicCoveragePagination.totalItems}
                        onPageChange={topicCoveragePagination.setPage}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="analytics-print-only">
                  <CoverageHeatmap
                    columnLabels={difficultyColumnLabels}
                    rows={topicCoverageRows}
                  />
                </div>
              </>
            )}
          </ChartCard>
        );
      default:
        return null;
    }
  }

  return (
    <div className={`analytics-reports-body${refreshing ? " is-refreshing" : ""}`}>
      {error ? <p className="error">{error}</p> : null}

      {lens === "group" && (
        <>
          <ChartReorderHint />
          <SwappableChartGrid order={groupChartOrder} onOrderChange={setGroupChartOrder}>
            {(id) => renderGroupChart(id as GroupAnalyticsChartId)}
          </SwappableChartGrid>
        </>
      )}

      {lens === "student" && (
        <>
          <ChartReorderHint />
          <SwappableChartGrid order={studentChartOrder} onOrderChange={setStudentChartOrder}>
            {(id) => renderStudentChart(id as StudentAnalyticsChartId)}
          </SwappableChartGrid>

          {reports.atRiskStudents.length > 0 && (
            <section className="card analytics-report-section">
              <h2>At-Risk Students</h2>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Year</th>
                      <th>Score</th>
                      <th>Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.atRiskStudents.map((student) => (
                      <tr key={student.studentId}>
                        <td>{formatFullName(student.firstName, student.lastName)}</td>
                        <td>{student.yearLevel ?? "—"}</td>
                        <td>
                          {student.overallScore != null ? `${student.overallScore.toFixed(1)}%` : "—"}
                        </td>
                        <td>{student.reasons.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {lens === "question" && (
        <>
          <ChartReorderHint />
          <SwappableChartGrid
            order={questionChartOrder}
            onOrderChange={setQuestionChartOrder}
            wideIds={["distractor-analysis"]}
          >
            {(id) => renderQuestionChart(id as QuestionAnalyticsChartId)}
          </SwappableChartGrid>
        </>
      )}
    </div>
  );
}
