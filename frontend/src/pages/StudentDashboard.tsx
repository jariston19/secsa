import { useEffect, useState } from "react";
import ExamInstructionsModal from "../components/ExamInstructionsModal";
import ExamSession from "../components/ExamSession";
import QuestionImage from "../components/QuestionImage";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";

interface QaExamOption {
  yearLevel: number;
  setName: string | null;
  deployed: boolean;
}

interface ExamStatus {
  nextAction: string;
  inProgressAttemptId?: string | null;
  diagnosticAvailable: boolean;
  retakeAvailable: boolean;
  retakesRemaining: number | null;
  examYearLevel?: number;
  qaMode?: boolean;
  usingSetYearLevel?: number | null;
  usingSetName?: string | null;
  qaExamOptions?: QaExamOption[];
  attempts: Array<{
    id: string;
    score: number | null;
    percentage: number | null;
    passed: boolean | null;
    attemptType: string;
    attemptNumber: number;
  }>;
}

interface ExamQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  imagePath?: string | null;
}

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const isQa = Boolean(user?.qaUnlimited);
  const [qaExamYear, setQaExamYear] = useState(String(user?.yearLevel ?? 2));
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerTimes, setAnswerTimes] = useState<Record<string, number>>({});
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{
    score: number;
    percentage: number;
    passed: boolean;
    totalItems: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [startError, setStartError] = useState("");

  async function loadStatus(yearLevel = qaExamYear) {
    const path = isQa ? `/exams/status?examYearLevel=${yearLevel}` : "/exams/status";
    const data = await api<ExamStatus>(path, {}, token);
    setStatus(data);
  }

  useEffect(() => {
    if (user?.yearLevel) {
      setQaExamYear(String(user.yearLevel));
    }
  }, [user?.yearLevel]);

  useEffect(() => {
    loadStatus(qaExamYear).catch((err) => setError(err.message));
  }, [token, isQa, qaExamYear]);

  const canStartExam =
    status?.nextAction === "take_diagnostic" || status?.nextAction === "take_retake";

  const canResumeExam = status?.nextAction === "resume_exam";

  const examType: "diagnostic" | "retake" =
    status?.nextAction === "take_retake" ? "retake" : "diagnostic";

  async function resumeExam() {
    setStartingExam(true);
    setStartError("");
    setError("");
    try {
      const data = await api<{ attempt: { id: string }; questions: ExamQuestion[] }>(
        "/exams/start",
        {
          method: "POST",
          body: isQa ? JSON.stringify({ examYearLevel: Number(qaExamYear) }) : undefined,
        },
        token
      );
      setAttemptId(data.attempt.id);
      setQuestions(data.questions);
      setAnswers({});
      setAnswerTimes({});
      setExamStartedAt(Date.now());
      setResult(null);
      setShowInstructions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume exam");
    } finally {
      setStartingExam(false);
    }
  }

  function openInstructions() {
    setStartError("");
    setShowInstructions(true);
  }

  async function beginExam() {
    setStartingExam(true);
    setStartError("");
    try {
      const data = await api<{ attempt: { id: string }; questions: ExamQuestion[] }>(
        "/exams/start",
        {
          method: "POST",
          body: isQa ? JSON.stringify({ examYearLevel: Number(qaExamYear) }) : undefined,
        },
        token
      );
      setAttemptId(data.attempt.id);
      setQuestions(data.questions);
      setAnswers({});
      setAnswerTimes({});
      setExamStartedAt(Date.now());
      setResult(null);
      setShowInstructions(false);
      setError("");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start exam");
    } finally {
      setStartingExam(false);
    }
  }

  async function submitExam() {
    if (!attemptId) return;
    const now = Date.now();
    const startedAt = examStartedAt ?? now;
    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id] as "A" | "B" | "C" | "D",
        timeSpentSeconds:
          answerTimes[q.id] ?? Math.max(1, Math.round((now - startedAt) / 1000)),
      })),
    };
    const data = await api<{
      result: { score: number; percentage: number; passed: boolean; totalItems: number };
    }>(`/exams/${attemptId}/submit`, { method: "POST", body: JSON.stringify(payload) }, token);
    setResult(data.result);
    setAttemptId(null);
    setQuestions([]);
    setExamStartedAt(null);
    setAnswerTimes({});
    await loadStatus(qaExamYear);
  }

  const selectedQaOption = status?.qaExamOptions?.find(
    (option) => option.yearLevel === Number(qaExamYear)
  );

  if (error && !status) return <p className="error">{error}</p>;
  if (!status) return <p>Loading exam status...</p>;

  return (
    <div className="grid">
      {error && <p className="error">{error}</p>}

      {!attemptId && (
        <>
      <section className="card">
        <h2>Your Exam</h2>
        {(status.qaMode || user?.qaUnlimited) && (
          <p className="qa-profile-banner">
            QA profile — pick a year level and take unlimited comprehensive exams.
          </p>
        )}
        {(status.qaMode || user?.qaUnlimited) && (
          <label className="qa-exam-year-picker">
            Exam year level
            <select
              value={qaExamYear}
              onChange={(e) => {
                setQaExamYear(e.target.value);
                setResult(null);
                setError("");
              }}
              disabled={Boolean(attemptId)}
            >
              {Array.from(
                { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                (_, i) => MIN_YEAR_LEVEL + i
              ).map((level) => {
                const option = status.qaExamOptions?.find((item) => item.yearLevel === level);
                const label = option?.deployed
                  ? `${level} — ${option.setName}`
                  : `${level} — not deployed`;
                return (
                  <option key={level} value={String(level)}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span className="field-hint">
              {selectedQaOption?.deployed
                ? `Ready: ${selectedQaOption.setName}`
                : "No deployed comprehensive set for this year level yet."}
            </span>
          </label>
        )}
        <p className="muted">Incoming year level exam with randomized question order.</p>
        <ul className="stats">
          <li>Comprehensive available: {status.diagnosticAvailable ? "Yes" : "No"}</li>
          {status.qaMode && status.usingSetName && (
            <li>
              Selected set: {status.usingSetName}
              {status.usingSetYearLevel != null ? ` (year ${status.usingSetYearLevel})` : ""}
            </li>
          )}
          <li>Retake pool available: {status.retakeAvailable ? "Yes" : "No"}</li>
          <li>
            Retakes remaining:{" "}
            {status.qaMode || user?.qaUnlimited ? "Unlimited" : status.retakesRemaining}
          </li>
        </ul>
        {!attemptId && !result && canResumeExam && (
          <>
            <p className="muted">
              You have an exam in progress. Resume to continue where you left off.
            </p>
            <button className="btn" onClick={resumeExam} disabled={startingExam}>
              {startingExam ? "Resuming..." : "Resume Exam"}
            </button>
          </>
        )}
        {!attemptId && !result && canStartExam && (
          <button className="btn" onClick={openInstructions}>
            Start Exam
          </button>
        )}
        {!attemptId && !result && !canStartExam && !canResumeExam && (
          <p className="muted">
            {status.nextAction === "wait_approval"
              ? "Waiting for retake approval from your teacher or superadmin."
              : status.nextAction === "completed"
                ? status.qaMode
                  ? selectedQaOption?.deployed
                    ? "No deployed comprehensive set for the selected year level."
                    : "Choose a year level with a deployed comprehensive set."
                  : "No deployed comprehensive set is available. Deploy one from the teacher Build tab."
                : "No exam is currently available for your year level."}
          </p>
        )}
      </section>

      {result && (
        <section className="card">
          <h2>Result</h2>
          <p>
            Score: {result.score} / {result.totalItems}
          </p>
          <p>Percentage: {result.percentage}%</p>
          <p className={result.passed ? "success" : "error"}>
            {result.passed ? "PASSED" : "FAILED"} (passing: 75%)
          </p>
          {!result.passed && !status.qaMode && !user?.qaUnlimited && (
            <p className="muted">
              Your teacher or superadmin will review and approve a retake if eligible.
            </p>
          )}
          {(status.qaMode || user?.qaUnlimited) && (
            <button className="btn qa-retake-btn" onClick={openInstructions}>
              Take another exam
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h2>Attempt History</h2>
        {status.attempts.length === 0 ? (
          <p className="muted">No attempts yet.</p>
        ) : (
          <div className="table-responsive">
            <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Attempt #</th>
                <th>Score</th>
                <th>%</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {status.attempts.map((a) => (
                <tr key={a.id}>
                  <td>{a.attemptType}</td>
                  <td>{a.attemptNumber}</td>
                  <td>{a.score ?? "-"}</td>
                  <td>{a.percentage ?? "-"}</td>
                  <td>{a.passed == null ? "In progress" : a.passed ? "Pass" : "Fail"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
        </>
      )}

      {attemptId && (
        <ExamSession
          active
          footer={
            <button
              className="btn"
              onClick={submitExam}
              disabled={questions.some((q) => !answers[q.id])}
            >
              Submit Exam
            </button>
          }
        >
          {questions.map((q, index) => (
            <div key={q.id} className="question-block">
              <p>
                <strong>
                  {index + 1}. {q.text}
                </strong>
              </p>
              {q.imagePath && (
                <QuestionImage src={`/uploads/${q.imagePath}`} alt={`Question ${index + 1} image`} />
              )}
              {(["A", "B", "C", "D"] as const).map((key) => (
                <label key={key} className="option">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === key}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: key }));
                      if (examStartedAt && !answerTimes[q.id]) {
                        setAnswerTimes((prev) => ({
                          ...prev,
                          [q.id]: Math.max(1, Math.round((Date.now() - examStartedAt) / 1000)),
                        }));
                      }
                    }}
                  />
                  {key}. {q[`option${key}` as keyof ExamQuestion] as string}
                </label>
              ))}
            </div>
          ))}
        </ExamSession>
      )}

      {showInstructions && (
        <ExamInstructionsModal
          examType={examType}
          onConfirm={beginExam}
          onCancel={() => setShowInstructions(false)}
          loading={startingExam}
          error={startError}
        />
      )}
    </div>
  );
}
