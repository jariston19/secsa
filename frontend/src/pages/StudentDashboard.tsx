import { useCallback, useEffect, useRef, useState } from "react";
import DiagnosticResultProfile, { type DiagnosticProfile } from "../components/DiagnosticResultProfile";
import ExamInstructionsModal from "../components/ExamInstructionsModal";
import ExamSession from "../components/ExamSession";
import QuestionImage from "../components/QuestionImage";
import StudentPrivacyPolicyModal, {
  hasAcceptedPrivacyPolicy,
} from "../components/StudentPrivacyPolicyModal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { primeExamFullscreen } from "../lib/examFullscreen";
import { resetBodyScrollLock } from "../lib/scrollLock";
import { useSidebar } from "../lib/sidebar";
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
  diagnosticPassThreshold?: number | null;
  comprehensivePassThreshold?: number | null;
  retakePassThreshold?: number | null;
  qaMode?: boolean;
  usingSetYearLevel?: number | null;
  usingSetName?: string | null;
  qaExamOptions?: QaExamOption[];
  showDiagnosticProfile?: boolean;
  diagnosticAttemptId?: string | null;
  showComprehensiveProfile?: boolean;
  comprehensiveAttemptId?: string | null;
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

function releaseExamSessionChrome() {
  resetBodyScrollLock();
  document.body.classList.remove("exam-session-active");
}

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const { setPageNav, setPageNavValue } = useSidebar();
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
    passThreshold?: number;
    timedOut?: boolean;
    focusViolationLimit?: boolean;
  } | null>(null);
  const [diagnosticProfile, setDiagnosticProfile] = useState<DiagnosticProfile | null>(null);
  const [diagnosticProfileOpen, setDiagnosticProfileOpen] = useState(true);
  const [diagnosticNotices, setDiagnosticNotices] = useState<{
    timedOut?: boolean;
    focusViolationLimit?: boolean;
  } | null>(null);
  const [loadingDiagnosticProfile, setLoadingDiagnosticProfile] = useState(false);
  const [comprehensiveProfile, setComprehensiveProfile] = useState<DiagnosticProfile | null>(null);
  const [comprehensiveProfileOpen, setComprehensiveProfileOpen] = useState(true);
  const [comprehensiveNotices, setComprehensiveNotices] = useState<{
    timedOut?: boolean;
    focusViolationLimit?: boolean;
  } | null>(null);
  const [loadingComprehensiveProfile, setLoadingComprehensiveProfile] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [privacyPolicyRequired, setPrivacyPolicyRequired] = useState(false);
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
  const examSectionRef = useRef<HTMLElement | null>(null);

  const answerTimesRef = useRef<Record<string, number>>({});
  const questionShownAtRef = useRef(Date.now());

  async function loadStatus(yearLevel = qaExamYear) {
    const path = isQa ? `/exams/status?examYearLevel=${yearLevel}` : "/exams/status";
    const data = await api<ExamStatus>(path, {}, token);
    setStatus(data);
    if (!data.showDiagnosticProfile) {
      setDiagnosticProfile(null);
      setDiagnosticNotices(null);
      setDiagnosticProfileOpen(false);
    }
    if (!data.showComprehensiveProfile) {
      setComprehensiveProfile(null);
      setComprehensiveNotices(null);
      setComprehensiveProfileOpen(false);
    }
    return data;
  }

  const loadDiagnosticProfile = useCallback(async () => {
    if (!token) return;

    setLoadingDiagnosticProfile(true);
    try {
      const data = await api<{ profile: DiagnosticProfile }>(
        "/exams/diagnostic-profile",
        {},
        token
      );
      setDiagnosticProfile(data.profile);
    } catch {
      setDiagnosticProfile(null);
    } finally {
      setLoadingDiagnosticProfile(false);
    }
  }, [token]);

  const loadComprehensiveProfile = useCallback(async () => {
    if (!token) return;

    setLoadingComprehensiveProfile(true);
    try {
      const data = await api<{ profile: DiagnosticProfile }>(
        "/exams/comprehensive-profile",
        {},
        token
      );
      setComprehensiveProfile(data.profile);
    } catch {
      setComprehensiveProfile(null);
    } finally {
      setLoadingComprehensiveProfile(false);
    }
  }, [token]);

  useEffect(() => {
    releaseExamSessionChrome();
  }, []);

  useEffect(() => {
    if (user?.yearLevel) {
      setQaExamYear(String(user.yearLevel));
    }
  }, [user?.yearLevel]);

  useEffect(() => {
    loadStatus(qaExamYear).catch((err) => setError(err.message));
  }, [token, isQa, qaExamYear]);

  useEffect(() => {
    if (!status?.showDiagnosticProfile) return;

    setDiagnosticProfileOpen(true);
    void loadDiagnosticProfile();
  }, [status?.showDiagnosticProfile, status?.diagnosticAttemptId, loadDiagnosticProfile]);

  useEffect(() => {
    if (!status?.showComprehensiveProfile) return;

    setComprehensiveProfileOpen(true);
    void loadComprehensiveProfile();
  }, [status?.showComprehensiveProfile, status?.comprehensiveAttemptId, loadComprehensiveProfile]);

  const openPrivacyPolicy = useCallback((required: boolean) => {
    setPrivacyPolicyRequired(required);
    setShowPrivacyPolicy(true);
  }, []);

  const handlePageNavChange = useCallback(
    (id: string) => {
      if (id === "start-exam") {
        setPageNavValue("start-exam");
        examSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (id === "privacy-policy" && user?.id) {
        openPrivacyPolicy(!hasAcceptedPrivacyPolicy(user.id));
      }
    },
    [openPrivacyPolicy, setPageNavValue, user?.id]
  );

  useEffect(() => {
    setPageNav({
      segments: [
        { id: "start-exam", label: "Start Exam" },
        { id: "privacy-policy", label: "Privacy Policy" },
      ],
      value: "start-exam",
      onChange: handlePageNavChange,
    });

    return () => setPageNav(null);
  }, [handlePageNavChange, setPageNav]);

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

  const showDiagnosticProfileCard = Boolean(
    diagnosticProfile && (status?.showDiagnosticProfile || diagnosticNotices)
  );

  const showComprehensiveProfileCard = Boolean(
    comprehensiveProfile && (status?.showComprehensiveProfile || comprehensiveNotices)
  );

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

  function instructionsPassThreshold() {
    if (!status) return 75;
    if (pendingExamKind === "incoming_diagnostic") {
      return status.diagnosticPassThreshold ?? 75;
    }
    if (pendingExamKind === "retake") {
      return status.retakePassThreshold ?? 75;
    }
    return status.comprehensivePassThreshold ?? 75;
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
    primeExamFullscreen();
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
    primeExamFullscreen();
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
          result:
            | {
                kind: "diagnostic";
                profile: DiagnosticProfile;
              }
            | {
                kind: "comprehensive";
                score: number;
                percentage: number;
                passed: boolean;
                totalItems: number;
                passThreshold: number;
                profile: DiagnosticProfile;
              };
        }>(`/exams/${attemptId}/submit`, { method: "POST", body: JSON.stringify(payload) }, token);

        if (data.result.kind === "diagnostic") {
          setDiagnosticProfile(data.result.profile);
          setDiagnosticProfileOpen(true);
          setDiagnosticNotices({
            timedOut: options?.timedOut,
            focusViolationLimit: options?.focusViolationLimit,
          });
          setResult(null);
        } else {
          setResult({
            score: data.result.score,
            percentage: data.result.percentage,
            passed: data.result.passed,
            totalItems: data.result.totalItems,
            passThreshold: data.result.passThreshold,
            timedOut: options?.timedOut,
            focusViolationLimit: options?.focusViolationLimit,
          });
          setComprehensiveProfile(data.result.profile);
          setComprehensiveProfileOpen(true);
          setComprehensiveNotices({
            timedOut: options?.timedOut,
            focusViolationLimit: options?.focusViolationLimit,
          });
          setDiagnosticProfile(null);
          setDiagnosticNotices(null);
          setDiagnosticProfileOpen(false);
        }

        setAttemptId(null);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setAnswerTimes({});
        answerTimesRef.current = {};
        examDeadlineMsRef.current = null;
        setSecondsRemaining(null);
        setExamTimeLimitMinutes(null);
        releaseExamSessionChrome();
        await loadStatus(qaExamYear);
      } catch (err) {
        submittingExamRef.current = false;
        setError(err instanceof Error ? err.message : "Failed to submit exam");
      } finally {
        releaseExamSessionChrome();
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

      {!attemptId ? (
        <>
          <section className="card" ref={examSectionRef}>
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
              {studentYearLevel !== MIN_YEAR_LEVEL ? (
                <>
                  <li>Retake pool available: {status.retakeAvailable ? "Yes" : "No"}</li>
                  {!status.qaMode && !user?.qaUnlimited ? (
                    <li>Retakes remaining: {status.retakesRemaining}</li>
                  ) : null}
                </>
              ) : null}
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
                          : "No incoming diagnostic exam is available yet."
                        : "No exam is currently available for your year level."
                    : "No exam is currently available for your year level."}
              </p>
            )}
          </section>

          {showDiagnosticProfileCard ? (
            <section className="card diagnostic-profile-card">
              <div className="row-between diagnostic-profile-card-header">
                <div>
                  <h2>Diagnostic profile</h2>
                  <p className="muted section-desc">Your learning strengths and areas to develop.</p>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setDiagnosticProfileOpen((open) => !open)}
                >
                  {diagnosticProfileOpen ? "Hide profile" : "Show profile"}
                </button>
              </div>

              {diagnosticNotices?.timedOut ? (
                <p className="exam-timed-out-notice">
                  Time expired — your exam was submitted automatically. Unanswered items were not
                  included in your profile.
                </p>
              ) : null}
              {diagnosticNotices?.focusViolationLimit ? (
                <p className="exam-timed-out-notice">
                  You left the exam view {MAX_EXAM_FOCUS_VIOLATIONS} times — your exam was submitted
                  automatically.
                </p>
              ) : null}

              {diagnosticProfileOpen && diagnosticProfile ? (
                <DiagnosticResultProfile profile={diagnosticProfile} />
              ) : null}

              {loadingDiagnosticProfile && !diagnosticProfile ? (
                <p className="muted">Loading diagnostic profile...</p>
              ) : null}
            </section>
          ) : null}

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
              {result.passed ? (
                <p className="success">PASSED (passing: {result.passThreshold ?? 75}%)</p>
              ) : (
                <p className="exam-retake-attention">
                  Attention: Request for retake approval has been sent to your teacher. You will be
                  notified once a retake is approved.
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

          {showComprehensiveProfileCard ? (
            <section className="card diagnostic-profile-card">
              <div className="row-between diagnostic-profile-card-header">
                <div>
                  <h2>Exam evaluation</h2>
                  <p className="muted section-desc">Your strengths and areas to develop from this exam.</p>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setComprehensiveProfileOpen((open) => !open)}
                >
                  {comprehensiveProfileOpen ? "Hide evaluation" : "Show evaluation"}
                </button>
              </div>

              {comprehensiveNotices?.timedOut ? (
                <p className="exam-timed-out-notice">
                  Time expired — your exam was submitted automatically. Unanswered items were marked
                  incorrect and may affect this evaluation.
                </p>
              ) : null}
              {comprehensiveNotices?.focusViolationLimit ? (
                <p className="exam-timed-out-notice">
                  You left the exam view {MAX_EXAM_FOCUS_VIOLATIONS} times — your exam was submitted
                  automatically.
                </p>
              ) : null}

              {comprehensiveProfileOpen && comprehensiveProfile ? (
                <DiagnosticResultProfile profile={comprehensiveProfile} variant="comprehensive" />
              ) : null}

              {loadingComprehensiveProfile && !comprehensiveProfile ? (
                <p className="muted">Loading exam evaluation...</p>
              ) : null}
            </section>
          ) : null}

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
                    {status.attempts.map((a) => {
                      const isDiagnostic = a.questionSet?.type === "DIAGNOSTIC";
                      return (
                        <tr key={a.id}>
                          <td>
                            {a.questionSet?.type
                              ? formatExamType(a.questionSet.type)
                              : a.attemptType}
                          </td>
                          <td>{a.attemptNumber}</td>
                          <td>{isDiagnostic ? "—" : (a.score ?? "-")}</td>
                          <td>{isDiagnostic ? "—" : (a.percentage ?? "-")}</td>
                          <td>
                            {a.passed == null
                              ? "In progress"
                              : isDiagnostic
                                ? "Profile complete"
                                : a.passed
                                  ? "Pass"
                                  : "Fail"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

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
          passThreshold={instructionsPassThreshold()}
          onConfirm={beginExam}
          onCancel={() => setShowInstructions(false)}
          loading={startingExam}
          error={startError}
        />
      )}

      {showPrivacyPolicy && user?.id ? (
        <StudentPrivacyPolicyModal
          userId={user.id}
          requireAcknowledgement={privacyPolicyRequired}
          onClose={() => setShowPrivacyPolicy(false)}
        />
      ) : null}
    </div>
  );
}
