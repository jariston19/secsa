import { useCallback, useEffect, useRef, useState } from "react";
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

interface SavedAnswer {
  questionId: string;
  selectedOption: string | null;
  timeSpentSeconds: number | null;
  answerChangeCount: number;
}

interface ExamStartResponse {
  attempt: { id: string };
  questions: ExamQuestion[];
  savedAnswers: SavedAnswer[];
  resumeIndex: number;
}

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const isQa = Boolean(user?.qaUnlimited);
  const [qaExamYear, setQaExamYear] = useState(String(user?.yearLevel ?? 2));
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerTimes, setAnswerTimes] = useState<Record<string, number>>({});
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
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);

  const answerTimesRef = useRef<Record<string, number>>({});
  const questionShownAtRef = useRef(Date.now());

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

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  const flushCurrentQuestionTime = useCallback(() => {
    const question = questions[currentIndex];
    if (!question) return;

    const elapsed = Math.max(1, Math.round((Date.now() - questionShownAtRef.current) / 1000));
    const nextTime = (answerTimesRef.current[question.id] ?? 0) + elapsed;
    answerTimesRef.current[question.id] = nextTime;
    questionShownAtRef.current = Date.now();
    setAnswerTimes({ ...answerTimesRef.current });
  }, [currentIndex, questions]);

  useEffect(() => {
    if (!attemptId || questions.length === 0) return;
    questionShownAtRef.current = Date.now();
  }, [attemptId, currentIndex, questions.length]);

  function applyExamStart(data: ExamStartResponse) {
    const answersMap: Record<string, string> = {};
    const timesMap: Record<string, number> = {};

    for (const saved of data.savedAnswers) {
      if (saved.selectedOption) {
        answersMap[saved.questionId] = saved.selectedOption;
      }
      if (saved.timeSpentSeconds != null) {
        timesMap[saved.questionId] = saved.timeSpentSeconds;
      }
    }

    setAttemptId(data.attempt.id);
    setQuestions(data.questions);
    setAnswers(answersMap);
    setAnswerTimes(timesMap);
    answerTimesRef.current = timesMap;
    setCurrentIndex(data.resumeIndex);
    setResult(null);
    setShowInstructions(false);
    questionShownAtRef.current = Date.now();
  }

  async function resumeExam() {
    setStartingExam(true);
    setStartError("");
    setError("");
    try {
      const data = await api<ExamStartResponse>(
        "/exams/start",
        {
          method: "POST",
          body: isQa ? JSON.stringify({ examYearLevel: Number(qaExamYear) }) : undefined,
        },
        token
      );
      applyExamStart(data);
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
      const data = await api<ExamStartResponse>(
        "/exams/start",
        {
          method: "POST",
          body: isQa ? JSON.stringify({ examYearLevel: Number(qaExamYear) }) : undefined,
        },
        token
      );
      applyExamStart(data);
      setError("");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start exam");
    } finally {
      setStartingExam(false);
    }
  }

  async function persistAnswer(questionId: string, selectedOption: "A" | "B" | "C" | "D") {
    if (!attemptId) return;

    setSavingAnswerId(questionId);
    try {
      await api(
        `/exams/${attemptId}/answers/${questionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            selectedOption,
            timeSpentSeconds: answerTimesRef.current[questionId] ?? 1,
          }),
        },
        token
      );
    } finally {
      setSavingAnswerId(null);
    }
  }

  async function selectAnswer(option: "A" | "B" | "C" | "D") {
    if (!currentQuestion || !attemptId) return;

    flushCurrentQuestionTime();
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
    await persistAnswer(currentQuestion.id, option);
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= questions.length || index === currentIndex) return;
    flushCurrentQuestionTime();
    setCurrentIndex(index);
  }

  async function submitExam() {
    if (!attemptId) return;

    flushCurrentQuestionTime();

    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id] as "A" | "B" | "C" | "D",
        timeSpentSeconds: answerTimesRef.current[q.id] ?? 1,
      })),
    };

    const data = await api<{
      result: { score: number; percentage: number; passed: boolean; totalItems: number };
    }>(`/exams/${attemptId}/submit`, { method: "POST", body: JSON.stringify(payload) }, token);

    setResult(data.result);
    setAttemptId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setAnswerTimes({});
    answerTimesRef.current = {};
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
            <p className="muted">One question at a time with per-question timing.</p>
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

      {attemptId && currentQuestion && (
        <ExamSession
          active
          footer={
            <div className="exam-session-footer">
              <div className="exam-session-nav-buttons">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={currentIndex >= questions.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Next
                </button>
              </div>
              <button className="btn" onClick={submitExam} disabled={!allAnswered}>
                Submit Exam
              </button>
            </div>
          }
        >
          <div className="exam-session-progress">
            <span>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="muted">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
          </div>

          <div className="exam-question-nav">
            {questions.map((q, index) => (
              <button
                key={q.id}
                type="button"
                className={`exam-question-pill${
                  index === currentIndex ? " active" : ""
                }${answers[q.id] ? " answered" : ""}`}
                onClick={() => goToQuestion(index)}
                aria-label={`Go to question ${index + 1}`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="question-block exam-question-single">
            <p>
              <strong>
                {currentIndex + 1}. {currentQuestion.text}
              </strong>
            </p>
            {currentQuestion.imagePath && (
              <QuestionImage
                src={`/uploads/${currentQuestion.imagePath}`}
                alt={`Question ${currentIndex + 1} image`}
              />
            )}
            {(["A", "B", "C", "D"] as const).map((key) => (
              <label key={key} className="option">
                <input
                  type="radio"
                  name={currentQuestion.id}
                  checked={answers[currentQuestion.id] === key}
                  disabled={savingAnswerId === currentQuestion.id}
                  onChange={() => selectAnswer(key)}
                />
                {key}. {currentQuestion[`option${key}` as keyof ExamQuestion] as string}
              </label>
            ))}
          </div>
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
