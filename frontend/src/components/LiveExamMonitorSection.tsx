import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import { formatDisplayFullName } from "../lib/names";
import {
  abbreviateProgramCourse,
  formatProgramCourse,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

const POLL_INTERVAL_MS = 5000;

interface LiveSession {
  attemptId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    yearLevel: number | null;
    programCourse: string | null;
  };
  questionSetName: string;
  questionSetType: string;
  currentQuestionNumber: number;
  totalQuestions: number;
  secondsRemaining: number;
  focusWarningCount: number;
  startedAt: string;
}

interface LiveMonitorData {
  activeCount: number;
  refreshedAt: string;
  sessions: LiveSession[];
}

interface Props {
  token: string | null;
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function focusWarningClass(count: number) {
  if (count >= 5) return "live-exam-monitor-focus-high";
  if (count >= 2) return "live-exam-monitor-focus-warn";
  return "";
}

export default function LiveExamMonitorSection({ token }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [courseFilter, setCourseFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState("all");
  const [data, setData] = useState<LiveMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "ALL") params.set("programCourse", courseFilter);
    if (yearFilter !== "all") params.set("yearLevel", yearFilter);
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [courseFilter, yearFilter]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await api<LiveMonitorData>(`/exams/live-monitor${query}`, {}, token);
        if (!cancelled) {
          setData(response);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load live monitor");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading((current) => (data ? current : true));
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, query]);

  const lastUpdated = data?.refreshedAt
    ? new Date(data.refreshedAt).toLocaleTimeString()
    : null;

  return (
    <section className="card live-exam-monitor">
      <div className="live-exam-monitor-header">
        <div>
          <h2>Live exam monitor</h2>
          <p className="muted section-desc">
            Active exams refresh every 5 seconds. Focus warnings update when students leave the exam
            window.
          </p>
        </div>
        <div className="live-exam-monitor-stats">
          <span className="live-exam-monitor-stat">
            <strong>{data?.activeCount ?? 0}</strong> active
          </span>
          {lastUpdated ? <span className="muted live-exam-monitor-updated">Updated {lastUpdated}</span> : null}
        </div>
      </div>

      <div className="live-exam-monitor-filters">
        <label>
          Program
          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value as ProgramCourseFilter)}
          >
            <option value="ALL">All programs</option>
            {programCourseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Incoming year
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>
            {[1, 2, 3, 4, 5].map((year) => (
              <option key={year} value={String(year)}>
                Year {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {loading && !data ? (
        <p className="muted">Loading live sessions...</p>
      ) : !data || data.sessions.length === 0 ? (
        <p className="muted">No students are taking an exam right now.</p>
      ) : (
        <div className="table-responsive live-exam-monitor-table-wrap">
          <table className="live-exam-monitor-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Program</th>
                <th>Exam</th>
                <th>Q</th>
                <th>Time left</th>
                <th>Focus</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr
                  key={session.attemptId}
                  className={focusWarningClass(session.focusWarningCount) || undefined}
                >
                  <td>
                    <div className="live-exam-monitor-student">
                      <strong>
                        {formatDisplayFullName(
                          session.student.firstName,
                          session.student.lastName
                        )}
                      </strong>
                      <span className="muted">
                        Y{session.student.yearLevel ?? "—"} · {session.student.email}
                      </span>
                    </div>
                  </td>
                  <td>{abbreviateProgramCourse(session.student.programCourse)}</td>
                  <td>
                    <div className="live-exam-monitor-exam">
                      <span>{session.questionSetName}</span>
                      <span className="muted">{formatExamType(session.questionSetType)}</span>
                    </div>
                  </td>
                  <td>
                    {session.currentQuestionNumber}/{session.totalQuestions}
                  </td>
                  <td>{formatCountdown(session.secondsRemaining)}</td>
                  <td>
                    <span
                      className={
                        session.focusWarningCount > 0
                          ? "live-exam-monitor-focus-count"
                          : "muted"
                      }
                    >
                      {session.focusWarningCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.sessions.length > 0 ? (
        <p className="muted live-exam-monitor-footnote">
          Showing {data.sessions.length} of {data.activeCount} active session
          {data.activeCount === 1 ? "" : "s"}
          {courseFilter !== "ALL" ? ` · ${formatProgramCourse(courseFilter)}` : ""}
          {yearFilter !== "all" ? ` · Year ${yearFilter}` : ""}
        </p>
      ) : null}
    </section>
  );
}
