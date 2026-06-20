import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsPrintArea from "./AnalyticsPrintArea";
import ChartCard from "./charts/ChartCard";
import AnalyticsChartSlot from "./AnalyticsChartSlot";
import {
  BatchComparisonLineChart,
  CohortMilestoneLineChart,
  GroupedPercentBars,
  ScoreCorrelationScatter,
} from "./charts/AnalyticsCharts";
import { api } from "../lib/api";
import {
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

type IntakeBatchFilter = "ALL" | string;
type TransitionFilter = "1-2" | "2-3" | "3-4";

const TRANSITION_OPTIONS: Array<{
  id: TransitionFilter;
  fromYear: number;
  toYear: number;
  label: string;
}> = [
  { id: "1-2", fromYear: 1, toYear: 2, label: "Y1 Diagnostic → Y2 Comprehensive" },
  { id: "2-3", fromYear: 2, toYear: 3, label: "Y2 → Y3 Comprehensive" },
  { id: "3-4", fromYear: 3, toYear: 4, label: "Y3 → Y4 Comprehensive" },
];

const TRANSITION_FROM_COLOR = "#007AFF";
const TRANSITION_TO_COLOR = "#34C759";
const MILESTONE_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"];

function shortMilestoneLabel(fullLabel: string) {
  if (fullLabel.includes("Diagnostic")) {
    return fullLabel.replace("Incoming ", "").replace(" — Diagnostic", " Diagnostic");
  }
  return fullLabel.replace("Incoming ", "").replace(" — Comprehensive", " Comp.");
}

interface BatchJourney {
  intakeYear: number;
  studentCount: number;
  milestones: Array<{
    yearLevel: number;
    kind: string;
    label: string;
    studentsAssessed: number;
    averageScore: number;
    passRate: number;
  }>;
  transitions: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    studentCount: number;
    avgFromScore: number;
    avgToScore: number;
    fromPassRate: number;
    toPassRate: number;
    avgDelta: number;
    improvedCount: number;
    declinedCount: number;
    stableCount: number;
  }>;
  correlations: Array<{
    fromYear: number;
    toYear: number;
    fromLabel: string;
    toLabel: string;
    studentCount: number;
    points: Array<{ studentId: string; fromScore: number; toScore: number }>;
  }>;
}

interface TrendsData {
  studentsInScope: number;
  availableBatches: Array<{ intakeYear: number; studentCount: number }>;
  batchJourneys: BatchJourney[];
  selectedBatch: BatchJourney | null;
}

interface Props {
  token: string | null;
}

export default function AnalyticsTrends({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [intakeBatchFilter, setIntakeBatchFilter] = useState<IntakeBatchFilter>("ALL");
  const [transitionFilter, setTransitionFilter] = useState<TransitionFilter>("1-2");
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (intakeBatchFilter !== "ALL") params.set("intakeYear", intakeBatchFilter);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [courseFilter, intakeBatchFilter]);

  const selectedBatch = useMemo(() => {
    if (!data) return null;
    if (intakeBatchFilter !== "ALL") {
      return data.selectedBatch ?? data.batchJourneys[0] ?? null;
    }
    return null;
  }, [data, intakeBatchFilter]);

  const activeTransitionMeta = useMemo(
    () => TRANSITION_OPTIONS.find((option) => option.id === transitionFilter) ?? TRANSITION_OPTIONS[0],
    [transitionFilter]
  );

  const activeTransition = useMemo(() => {
    if (!selectedBatch) return null;
    return (
      selectedBatch.transitions.find(
        (row) =>
          row.fromYear === activeTransitionMeta.fromYear &&
          row.toYear === activeTransitionMeta.toYear
      ) ?? null
    );
  }, [selectedBatch, activeTransitionMeta]);

  const activeCorrelation = useMemo(() => {
    if (!selectedBatch) return null;
    return (
      selectedBatch.correlations.find(
        (row) =>
          row.fromYear === activeTransitionMeta.fromYear &&
          row.toYear === activeTransitionMeta.toYear
      ) ?? null
    );
  }, [selectedBatch, activeTransitionMeta]);

  const filterSubtitle = useMemo(() => {
    const parts = [
      courseFilter === "ALL" ? "All courses" : formatProgramCourse(courseFilter),
      intakeBatchFilter === "ALL"
        ? "All intake batches"
        : `Batch ${intakeBatchFilter}`,
    ];
    if (selectedBatch) parts.push(activeTransitionMeta.label);
    return parts.join(" · ");
  }, [courseFilter, intakeBatchFilter, selectedBatch, activeTransitionMeta.label]);

  useEffect(() => {
    setError("");
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    api<TrendsData>(`/analytics/trends${query}`, {}, token)
      .then((response) => {
        setData(response);
        hasLoadedRef.current = true;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trends"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [token, query]);

  if (loading && !data) {
    return <p className="muted">Loading trends...</p>;
  }

  if (!data) {
    return error ? <p className="error">{error}</p> : null;
  }

  const comparingBatches = intakeBatchFilter === "ALL";
  const hasBatchData = data.batchJourneys.length > 0;
  const hasPairedStudents = Boolean(activeTransition && activeTransition.studentCount > 0);
  const assessedMilestones =
    selectedBatch?.milestones.filter((milestone) => milestone.studentsAssessed > 0) ?? [];

  return (
    <AnalyticsPrintArea id="analytics-print-trends" title="Analytics — Trends" subtitle={filterSubtitle}>
      <div className={`analytics-trends${refreshing ? " is-refreshing" : ""}`}>
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
              Intake batch
              <select
                value={intakeBatchFilter}
                onChange={(event) =>
                  setIntakeBatchFilter(event.target.value as IntakeBatchFilter)
                }
              >
                <option value="ALL">All batches</option>
                {data.availableBatches.map((batch) => (
                  <option key={batch.intakeYear} value={String(batch.intakeYear)}>
                    Batch {batch.intakeYear} ({batch.studentCount} students)
                  </option>
                ))}
              </select>
            </label>
            {selectedBatch ? (
              <label className="analytics-reports-filter-field">
                Year-to-year step
                <select
                  value={transitionFilter}
                  onChange={(event) =>
                    setTransitionFilter(event.target.value as TransitionFilter)
                  }
                >
                  {TRANSITION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="analytics-trends-summary">
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">Students in scope</span>
            <strong>{data.studentsInScope}</strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">
              {comparingBatches ? "Intake batches" : "Batch size"}
            </span>
            <strong>
              {comparingBatches ? data.availableBatches.length : (selectedBatch?.studentCount ?? 0)}
            </strong>
          </article>
          <article className="analytics-trends-stat">
            <span className="analytics-trends-stat-label">
              {comparingBatches ? "Latest batch" : "With both exams"}
            </span>
            <strong>
              {comparingBatches
                ? (data.availableBatches[0]?.intakeYear ?? "—")
                : (activeTransition?.studentCount ?? 0)}
            </strong>
          </article>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {!hasBatchData ? (
          <p className="muted">No intake batch data yet for this filter.</p>
        ) : comparingBatches ? (
          <div className="analytics-trends-grid">
            <AnalyticsChartSlot size="wide">
              <ChartCard
                className="analytics-chart-card-batch-compare"
                title="Batch journeys compared"
                description="Average score by calendar year — one line per intake batch, oldest to newest."
              >
                <BatchComparisonLineChart
                  batches={[...data.batchJourneys]
                    .sort((a, b) => a.intakeYear - b.intakeYear)
                    .map((batch) => ({
                      intakeYear: batch.intakeYear,
                      milestones: batch.milestones,
                    }))}
                />
              </ChartCard>
            </AnalyticsChartSlot>

            <section className="card analytics-trends-transitions">
              <h2>Intake batches</h2>
              <p className="muted section-desc">
                Select a batch above to drill into year-to-year progress for that cohort.
              </p>
              <div className="analytics-trends-batch-table-wrap">
                <table className="analytics-trends-batch-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Students</th>
                      <th>Y1 avg</th>
                      <th>Y2 avg</th>
                      <th>Y3 avg</th>
                      <th>Y4 avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batchJourneys
                      .slice()
                      .sort((a, b) => a.intakeYear - b.intakeYear)
                      .map((batch) => (
                      <tr key={batch.intakeYear}>
                        <td>Batch {batch.intakeYear}</td>
                        <td>{batch.studentCount}</td>
                        {batch.milestones.map((milestone) => (
                          <td key={milestone.yearLevel}>
                            {milestone.studentsAssessed > 0
                              ? `${milestone.averageScore.toFixed(0)}%`
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : selectedBatch && assessedMilestones.length > 0 ? (
          <div className="analytics-trends-grid">
            <AnalyticsChartSlot size="square">
              <ChartCard
                className="analytics-chart-card-compact"
                title={`Batch ${selectedBatch.intakeYear} — full journey`}
                description={`${selectedBatch.studentCount} students in this intake cohort.`}
              >
                <CohortMilestoneLineChart milestones={selectedBatch.milestones} fill />
              </ChartCard>
            </AnalyticsChartSlot>

            <AnalyticsChartSlot size="tall">
              <ChartCard
                className="analytics-chart-card-compact"
                title="Pass rate across milestones"
                description={`Batch ${selectedBatch.intakeYear} — pass rate at each incoming-year exam.`}
              >
                <GroupedPercentBars
                  ariaLabel="Milestone pass rates"
                  items={assessedMilestones.map((milestone, index) => ({
                    id: `y${milestone.yearLevel}`,
                    label: `Y${milestone.yearLevel}`,
                    score: milestone.passRate,
                    color: MILESTONE_COLORS[index % MILESTONE_COLORS.length],
                  }))}
                />
              </ChartCard>
            </AnalyticsChartSlot>

            {hasPairedStudents ? (
              <>
                <AnalyticsChartSlot size="tall">
                  <ChartCard
                    className="analytics-chart-card-compact"
                    title="Average score — before vs after"
                    description={`Paired students in Batch ${selectedBatch.intakeYear}: ${activeTransition!.fromLabel} vs ${activeTransition!.toLabel}.`}
                  >
                    <GroupedPercentBars
                      ariaLabel="Year-to-year average scores"
                      items={[
                        {
                          id: "from",
                          label: shortMilestoneLabel(activeTransition!.fromLabel),
                          score: activeTransition!.avgFromScore,
                          color: TRANSITION_FROM_COLOR,
                        },
                        {
                          id: "to",
                          label: shortMilestoneLabel(activeTransition!.toLabel),
                          score: activeTransition!.avgToScore,
                          color: TRANSITION_TO_COLOR,
                        },
                      ]}
                    />
                  </ChartCard>
                </AnalyticsChartSlot>

                <AnalyticsChartSlot size="tall">
                  <ChartCard
                    className="analytics-chart-card-compact"
                    title="Pass rate — before vs after"
                    description="Same paired students at each step within this intake batch."
                  >
                    <GroupedPercentBars
                      ariaLabel="Year-to-year pass rates"
                      items={[
                        {
                          id: "from-pass",
                          label: shortMilestoneLabel(activeTransition!.fromLabel),
                          score: activeTransition!.fromPassRate,
                          color: TRANSITION_FROM_COLOR,
                        },
                        {
                          id: "to-pass",
                          label: shortMilestoneLabel(activeTransition!.toLabel),
                          score: activeTransition!.toPassRate,
                          color: TRANSITION_TO_COLOR,
                        },
                      ]}
                    />
                  </ChartCard>
                </AnalyticsChartSlot>

                {activeCorrelation ? (
                  <AnalyticsChartSlot size="tall">
                    <ChartCard
                      className="analytics-chart-card-compact"
                      title={activeTransitionMeta.label}
                      description={`Batch ${selectedBatch.intakeYear} — each dot is one student who took both exams.`}
                    >
                      <ScoreCorrelationScatter
                        fill
                        fromLabel={activeCorrelation.fromLabel}
                        toLabel={activeCorrelation.toLabel}
                        points={activeCorrelation.points}
                      />
                    </ChartCard>
                  </AnalyticsChartSlot>
                ) : null}

                <AnalyticsChartSlot size="tall">
                  <section className="card analytics-trends-step-summary">
                    <h2>{activeTransitionMeta.label}</h2>
                    <p className="muted section-desc">
                      {activeTransition!.studentCount} students in Batch {selectedBatch.intakeYear} with
                      both exams in this step.
                    </p>
                    <div className="overview-activity-grid analytics-trends-step-tiles">
                      <article className="overview-activity-tile">
                        <span className="overview-activity-value">{activeTransition!.improvedCount}</span>
                        <span className="overview-activity-label">Improved</span>
                      </article>
                      <article className="overview-activity-tile">
                        <span className="overview-activity-value">{activeTransition!.stableCount}</span>
                        <span className="overview-activity-label">Stable</span>
                      </article>
                      <article className="overview-activity-tile">
                        <span className="overview-activity-value">{activeTransition!.declinedCount}</span>
                        <span className="overview-activity-label">Declined</span>
                      </article>
                    </div>
                  </section>
                </AnalyticsChartSlot>
              </>
            ) : (
              <p className="muted">
                No students in Batch {selectedBatch.intakeYear} have completed both exams for{" "}
                {activeTransitionMeta.label} yet.
              </p>
            )}
          </div>
        ) : (
          <p className="muted">
            Batch {selectedBatch?.intakeYear ?? intakeBatchFilter} has no milestone exams recorded yet.
          </p>
        )}
      </div>
    </AnalyticsPrintArea>
  );
}
