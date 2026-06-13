import { useEffect, useState } from "react";
import ExamInstructionsModal from "../components/ExamInstructionsModal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface ExamQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  imagePath?: string | null;
}

interface ExamStatus {
  nextAction: string;
  diagnosticAvailable: boolean;
  retakeAvailable: boolean;
  retakesRemaining: number;
  attempts: Array<{
    id: string;
    score: number | null;
    percentage: number | null;
    passed: boolean | null;
    attemptType: string;
    attemptNumber: number;
  }>;
}

export default function StudentDashboard() {
  const { token } = useAuth();
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

  async function loadStatus() {
    const data = await api<ExamStatus>("/exams/status", {}, token);
    setStatus(data);
  }

  useEffect(() => {
    loadStatus().catch((err) => setError(err.message));
  }, [token]);

  const canStartExam =
    status?.nextAction === "take_diagnostic" || status?.nextAction === "take_retake";

  const examType: "diagnostic" | "retake" =
    status?.nextAction === "take_retake" ? "retake" : "diagnostic";

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
        { method: "POST" },
        token
      );
      setAttemptId(data.attempt.id);
      setQuestions(data.questions);
      setAnswers({});
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
    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id] as "A" | "B" | "C" | "D",
      })),
    };
    const data = await api<{
      result: { score: number; percentage: number; passed: boolean; totalItems: number };
    }>(`/exams/${attemptId}/submit`, { method: "POST", body: JSON.stringify(payload) }, token);
    setResult(data.result);
    setAttemptId(null);
    setQuestions([]);
    await loadStatus();
  }

  if (error && !status) return <p className="error">{error}</p>;
  if (!status) return <p>Loading exam status...</p>;

  return (
    <div className="grid">
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Your Exam</h2>
        <p className="muted">Incoming year level exam with randomized question order.</p>
        <ul className="stats">
          <li>Comprehensive available: {status.diagnosticAvailable ? "Yes" : "No"}</li>
          <li>Retake pool available: {status.retakeAvailable ? "Yes" : "No"}</li>
          <li>Retakes remaining: {status.retakesRemaining}</li>
        </ul>
        {!attemptId && !result && canStartExam && (
          <button className="btn" onClick={openInstructions}>
            Start Exam
          </button>
        )}
        {!attemptId && !result && !canStartExam && (
          <p className="muted">
            {status.nextAction === "wait_approval"
              ? "Waiting for retake approval from your teacher or superadmin."
              : status.nextAction === "completed"
                ? "You have completed your available exam attempts."
                : "No exam is currently available for your year level."}
          </p>
        )}
      </section>

      {attemptId && (
        <section className="card">
          <h2>Exam in Progress</h2>
          {questions.map((q, index) => (
            <div key={q.id} className="question-block">
              <p>
                <strong>
                  {index + 1}. {q.text}
                </strong>
              </p>
              {q.imagePath && <img src={`/uploads/${q.imagePath}`} alt="Question" />}
              {(["A", "B", "C", "D"] as const).map((key) => (
                <label key={key} className="option">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === key}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                  />
                  {key}. {q[`option${key}` as keyof ExamQuestion] as string}
                </label>
              ))}
            </div>
          ))}
          <button
            className="btn"
            onClick={submitExam}
            disabled={questions.some((q) => !answers[q.id])}
          >
            Submit Exam
          </button>
        </section>
      )}

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
          {!result.passed && (
            <p className="muted">
              Your teacher or superadmin will review and approve a retake if eligible.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2>Attempt History</h2>
        {status.attempts.length === 0 ? (
          <p className="muted">No attempts yet.</p>
        ) : (
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
        )}
      </section>

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
