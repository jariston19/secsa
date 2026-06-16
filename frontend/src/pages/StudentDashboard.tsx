import { useCallback, useEffect, useRef, useState } from "react";
import ExamInstructionsModal from "../components/ExamInstructionsModal";
import ExamSession from "../components/ExamSession";
import QuestionImage from "../components/QuestionImage";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  MAX_EXAM_FOCUS_VIOLATIONS,
  MAX_YEAR_LEVEL,
  MIN_YEAR_LEVEL,
  formatExamTimeLimit,
  formatExamType,
} from "../lib/constants";

interface QaExamOption {
  yearLevel: number;
  setName: string | null;
  deployed: boolean;
  examKind: "incoming_diagnostic" | "comprehensive";
}

interface ExamStatus {
  yearLevel?: number;
  nextAction: string;
  inProgressAttemptId?: string | null;
  comprehensiveAvailable: boolean;
  incomingDiagnosticAvailable: boolean;
  retakeAvailable: boolean;
  retakesRemaining: number | null;
  examYearLevel?: number;
  examTimeLimitMinutes?: number | null;
  diagnosticTimeLimitMinutes?: number | null;
  comprehensiveTimeLimitMinutes?: number | null;
  retakeTimeLimitMinutes?: number | null;
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
    questionSet?: { type: string; name: string };
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
  attempt: { id: string; startedAt: string };
  questions: ExamQuestion[];
  savedAnswers: SavedAnswer[];
  resumeIndex: number;
  timeLimitMinutes: number;
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
    timedOut?: boolean;
    focusViolationLimit?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [startError, setStartError] = useState("");
  const [submittingExam, setSubmittingExam] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [examTimeLimitMinutes, setExamTimeLimitMinutes] = useState<number | null>(null);
  const [pendingExamKind, setPendingExamKind] = useState<
    "comprehensive" | "incoming_diagnostic" | "retake"
  >("comprehensive");
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const focusWarningCountRef = useRef(0);
  const examInteractionGuardRef = useRef<((durationMs?: number) => void) | null>(null);
  const examDeadlineMsRef = useRef<number | null>(null);
  const submittingExamRef = useRef(false);

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

  const canResumeExam = status?.nextAction === "resume_exam";
  const studentYearLevel = status?.yearLevel ?? user?.yearLevel;
  const hasSubmittedIncomingDiagnostic = Boolean(
    status?.attempts.some(
      (a) => a.questionSet?.type === "DIAGNOSTIC" && a.percentage != null
    )
  );

  const canStartComprehensive =
    !canResumeExam &&
    studentYearLevel !== MIN_YEAR_LEVEL &&
    (status?.nextAction === "take_comprehensive" || status?.nextAction === "take_retake");

  const canStartIncomingDiagnostic =
    !canResumeExam && status?.nextAction === "take_incoming_diagnostic";

  const examType: "comprehensive" | "incoming_diagnostic" | "retake" = pendingExamKind;

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);
  const examTimeLimitSeconds =
    examTimeLimitMinutes != null ? examTimeLimitMinutes * 60 : null;

  function instructionsTimeLimitMinutes() {
    if (!status) return 60;
    if (pendingExamKind === "incoming_diagnostic") {
      return status.diagnosticTimeLimitMinutes ?? status.examTimeLimitMinutes ?? 60;
    }
    if (pendingExamKind === "retake") {
      return status.retakeTimeLimitMinutes ?? status.examTimeLimitMinutes ?? 60;
    }
    return status.comprehensiveTimeLimitMinutes ?? status.examTimeLimitMinutes ?? 60;
  }

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

    focusWarningCountRef.current = 0;
    submittingExamRef.current = false;
    const durationMs = data.timeLimitMinutes * 60 * 1000;
    const startedMs = new Date(data.attempt.startedAt).getTime();
    examDeadlineMsRef.current = startedMs + durationMs;
    setExamTimeLimitMinutes(data.timeLimitMinutes);
    setSecondsRemaining(Math.max(0, Math.ceil((examDeadlineMsRef.current - Date.now()) / 1000)));
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

  function openInstructions(kind: "comprehensive" | "incoming_diagnostic" | "retake") {
    setPendingExamKind(kind);
    setStartError("");
    setShowInstructions(true);
  }

  async function beginExam() {
    setStartingExam(true);
    setStartError("");
    try {
      const body: Record<string, unknown> = {};
      if (isQa) {
        body.examYearLevel = Number(qaExamYear);
        if (
          Number(qaExamYear) === MIN_YEAR_LEVEL ||
          pendingExamKind === "incoming_diagnostic"
        ) {
          body.examKind = "incoming_diagnostic";
        }
      } else if (pendingExamKind === "incoming_diagnostic") {
        body.examKind = "incoming_diagnostic";
      }

      const data = await api<ExamStartResponse>(
        "/exams/start",
        {
          method: "POST",
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
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
    if (!currentQuestion || !attemptId || submittingExam) return;

    examInteractionGuardRef.current?.(2500);
    flushCurrentQuestionTime();
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
    await persistAnswer(currentQuestion.id, option);
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= questions.length || index === currentIndex || submittingExam) return;
    examInteractionGuardRef.current?.(2500);
    flushCurrentQuestionTime();
    setCurrentIndex(index);
  }

  const syncFocusWarnings = useCallback(
    async (count: number) => {
      focusWarningCountRef.current = count;
      if (!attemptId || !token) return;
      try {
        await api(
          `/exams/${attemptId}/focus-warnings`,
          { method: "PATCH", body: JSON.stringify({ count }) },
          token
        );
      } catch {
        // Best-effort sync during the exam; submit also persists the final count.
      }
    },
    [attemptId, token]
  );

  const submitExam = useCallback(
    async (options?: { timedOut?: boolean; focusViolationLimit?: boolean }) => {
      if (!attemptId || submittingExamRef.current) return;

      submittingExamRef.current = true;
      setSubmittingExam(true);
      setError("");

      try {
        flushCurrentQuestionTime();

        const payload = {
          answers: questions.map((q) => {
            const selected = answers[q.id] as "A" | "B" | "C" | "D" | undefined;
            return {
              questionId: q.id,
              ...(selected ? { selectedOption: selected } : {}),
              timeSpentSeconds: answerTimesRef.current[q.id] ?? 1,
            };
          }),
          focusWarningCount: focusWarningCountRef.current,
        };

        const data = await api<{
          result: { score: number; percentage: number; passed: boolean; totalItems: number };
        }>(`/exams/${attemptId}/submit`, { method: "POST", body: JSON.stringify(payload) }, token);

        setResult({
          ...data.result,
          timedOut: options?.timedOut,
          focusViolationLimit: options?.focusViolationLimit,
        });
        setAttemptId(null);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setAnswerTimes({});
        answerTimesRef.current = {};
        examDeadlineMsRef.current = null;
        setSecondsRemaining(null);
        setExamTimeLimitMinutes(null);
        await loadStatus(qaExamYear);
      } catch (err) {
        submittingExamRef.current = false;
        setError(err instanceof Error ? err.message : "Failed to submit exam");
      } finally {
        setSubmittingExam(false);
      }
    },
    [attemptId, answers, flushCurrentQuestionTime, questions, qaExamYear, token]
  );

  const handleMaxFocusViolations = useCallback(() => {
    focusWarningCountRef.current = MAX_EXAM_FOCUS_VIOLATIONS;
    void syncFocusWarnings(MAX_EXAM_FOCUS_VIOLATIONS);
    void submitExam({ focusViolationLimit: true });
  }, [submitExam, syncFocusWarnings]);

  useEffect(() => {
    if (!attemptId || examDeadlineMsRef.current == null) return;

    function tick() {
      const deadline = examDeadlineMsRef.current;
      if (deadline == null) return;

      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining === 0 && !submittingExamRef.current) {
        void submitExam({ timedOut: true });
      }
    }

    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
  }, [attemptId, questions.length, submitExam]);

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
                QA profile — year 1 runs the incoming diagnostic; years 2–4 run comprehensive
                exams. Unlimited attempts.
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
                    ? selectedQaOption.examKind === "incoming_diagnostic"
                      ? `Ready: ${selectedQaOption.setName} (incoming diagnostic)`
                      : `Ready: ${selectedQaOption.setName}`
                    : selectedQaOption?.examKind === "incoming_diagnostic"
                      ? "No deployed incoming diagnostic set yet."
                      : "No deployed comprehensive set for this year level yet."}
                </span>
              </label>
            )}
            <p className="muted">
              One question at a time.
              {status.examTimeLimitMinutes != null
                ? ` Time limit: ${formatExamTimeLimit(status.examTimeLimitMinutes)}.`
                : ""}{" "}
              The exam auto-submits when time runs out.
            </p>
            <ul className="stats">
              <li>Comprehensive available: {status.comprehensiveAvailable ? "Yes" : "No"}</li>
              <li>
                Incoming diagnostic available: {status.incomingDiagnosticAvailable ? "Yes" : "No"}
              </li>
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
                  You have an exam in progress on this account. Resume here to continue where you
                  left off — including on another computer or browser.
                </p>
                <button className="btn" onClick={resumeExam} disabled={startingExam}>
                  {startingExam ? "Resuming..." : "Resume Exam"}
                </button>
              </>
            )}
            {!attemptId && !result && canStartComprehensive && (
              <button
                className="btn"
                onClick={() =>
                  openInstructions(status.nextAction === "take_retake" ? "retake" : "comprehensive")
                }
              >
                {status.nextAction === "take_retake" ? "Start Retake Exam" : "Start Comprehensive Exam"}
              </button>
            )}
            {!attemptId && !result && canStartIncomingDiagnostic && (
              <button
                className="btn secondary"
                onClick={() => openInstructions("incoming_diagnostic")}
              >
                Start Incoming Diagnostic
              </button>
            )}
            {!attemptId && !result && !canStartComprehensive && !canStartIncomingDiagnostic && !canResumeExam && (
              <p className="muted">
                {status.nextAction === "wait_approval"
                  ? "Waiting for retake approval from your teacher or superadmin."
                  : status.nextAction === "completed"
                    ? status.qaMode
                      ? selectedQaOption?.deployed
                        ? "No exam action available for the selected year level."
                        : selectedQaOption?.examKind === "incoming_diagnostic"
                          ? "Choose year 1 after deploying an incoming diagnostic set."
                          : "Choose a year level with a deployed comprehensive set."
                      : studentYearLevel === MIN_YEAR_LEVEL
                        ? hasSubmittedIncomingDiagnostic
                          ? "You have completed the incoming diagnostic exam."
                          : "No deployed incoming diagnostic set is available. Ask your teacher to deploy one from the Build tab."
                        : "No deployed comprehensive set is available. Deploy one from the teacher Build tab."
                    : "No exam is currently available for your year level."}
              </p>
            )}
          </section>

          {result && (
            <section className="card">
              <h2>Result</h2>
              {result.timedOut ? (
                <p className="exam-timed-out-notice">
                  Time expired — your exam was submitted automatically. Unanswered items were marked
                  incorrect.
                </p>
              ) : null}
              {result.focusViolationLimit ? (
                <p className="exam-timed-out-notice">
                  You left the exam view {MAX_EXAM_FOCUS_VIOLATIONS} times — your exam was submitted
                  automatically. Unanswered items were marked incorrect.
                </p>
              ) : null}
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
                <button
                  className="btn qa-retake-btn"
                  onClick={() =>
                    openInstructions(
                      Number(qaExamYear) === MIN_YEAR_LEVEL
                        ? "incoming_diagnostic"
                        : "comprehensive"
                    )
                  }
                >
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
                        <td>
                          {a.questionSet?.type
                            ? formatExamType(a.questionSet.type)
                            : a.attemptType}
                        </td>
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
          interactionGuardRef={examInteractionGuardRef}
          onFocusWarningCountChange={syncFocusWarnings}
          onMaxViolationsReached={handleMaxFocusViolations}
          secondsRemaining={secondsRemaining}
          examTimeLimitSeconds={examTimeLimitSeconds}
          footer={
            <div className="exam-session-footer">
              <div className="exam-session-nav-buttons">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={currentIndex === 0 || submittingExam}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={currentIndex >= questions.length - 1 || submittingExam}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Next
                </button>
              </div>
              <button
                className="btn"
                onClick={() => void submitExam()}
                disabled={!allAnswered || submittingExam}
              >
                {submittingExam ? "Submitting..." : "Submit Exam"}
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
              {examTimeLimitMinutes != null
                ? ` · ${formatExamTimeLimit(examTimeLimitMinutes)} limit`
                : ""}
            </span>
          </div>

          <div
            className="exam-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={Object.keys(answers).length}
            aria-label={`${Object.keys(answers).length} of ${questions.length} questions answered`}
          >
            <div
              className="exam-progress-bar-fill"
              style={{
                width: `${
                  questions.length > 0
                    ? (Object.keys(answers).length / questions.length) * 100
                    : 0
                }%`,
              }}
            />
            <div
              className="exam-progress-bar-marker"
              style={{
                left: `${
                  questions.length > 1
                    ? (currentIndex / (questions.length - 1)) * 100
                    : 0
                }%`,
              }}
              aria-hidden="true"
            />
          </div>

          <div
            className={`exam-question-layout${
              currentQuestion.imagePath ? "" : " exam-question-layout-single"
            }`}
          >
            <div className="exam-question-main">
              <p className="exam-question-prompt">
                <strong>
                  {currentIndex + 1}. {currentQuestion.text}
                </strong>
              </p>

              <div className="exam-option-list">
                {(["A", "B", "C", "D"] as const).map((key) => (
                  <label key={key} className="option exam-option">
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
            </div>

            {currentQuestion.imagePath ? (
              <figure className="exam-question-figure">
                <QuestionImage
                  variant="inline"
                  src={`/uploads/${currentQuestion.imagePath}`}
                  alt={`Question ${currentIndex + 1} image`}
                />
              </figure>
            ) : null}
          </div>
        </ExamSession>
      )}

      {showInstructions && (
        <ExamInstructionsModal
          examType={examType}
          timeLimitMinutes={instructionsTimeLimitMinutes()}
          onConfirm={beginExam}
          onCancel={() => setShowInstructions(false)}
          loading={startingExam}
          error={startError}
        />
      )}
    </div>
  );
}
