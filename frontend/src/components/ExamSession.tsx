import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { AlertTriangle, Maximize2, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MAX_EXAM_FOCUS_VIOLATIONS } from "../lib/constants";
import {
  canRequestExamFullscreen,
  exitExamContainerFullscreen,
  isExamContainerFullscreen,
  requestExamContainerFullscreen,
} from "../lib/examFullscreen";

function isAllowedExamOverlayOpen() {
  return Boolean(document.querySelector(".question-image-overlay:not(.is-closing)"));
}

function useExamLockdown(
  active: boolean,
  onMaxViolationsReached?: () => void,
  initialFocusWarningCount = 0,
  suppressFocusChecksRef?: MutableRefObject<boolean>
) {
  const [lockedOut, setLockedOut] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const violationCooldownRef = useRef(false);
  const examInteractionRef = useRef(false);
  const examInteractionTimerRef = useRef<number | null>(null);
  const visibilityViolationTimerRef = useRef<number | null>(null);
  const sessionGraceUntilRef = useRef(0);
  const onMaxViolationsReachedRef = useRef(onMaxViolationsReached);
  const autoSubmittingRef = useRef(false);

  const isInStartupGrace = useCallback(() => Date.now() < sessionGraceUntilRef.current, []);

  useEffect(() => {
    onMaxViolationsReachedRef.current = onMaxViolationsReached;
  }, [onMaxViolationsReached]);

  useEffect(() => {
    autoSubmittingRef.current = autoSubmitting;
  }, [autoSubmitting]);

  const markExamInteraction = useCallback((durationMs = 2000) => {
    examInteractionRef.current = true;
    if (examInteractionTimerRef.current != null) {
      window.clearTimeout(examInteractionTimerRef.current);
    }
    examInteractionTimerRef.current = window.setTimeout(() => {
      examInteractionRef.current = false;
      examInteractionTimerRef.current = null;
    }, durationMs);
  }, []);

  const pauseExam = useCallback(() => {
    if (suppressFocusChecksRef?.current) return;
    if (violationCooldownRef.current || autoSubmittingRef.current) return;
    if (isInStartupGrace()) return;
    if (examInteractionRef.current) return;
    if (isAllowedExamOverlayOpen()) return;

    violationCooldownRef.current = true;
    window.setTimeout(() => {
      violationCooldownRef.current = false;
    }, 900);

    setViolationCount((count) => {
      const next = count + 1;

      if (next >= MAX_EXAM_FOCUS_VIOLATIONS) {
        setAutoSubmitting(true);
        setLockedOut(false);
        window.setTimeout(() => onMaxViolationsReachedRef.current?.(), 0);
        return next;
      }

      setLockedOut(true);
      return next;
    });
  }, [isInStartupGrace, suppressFocusChecksRef]);

  const resumeFromPause = useCallback(() => {
    setLockedOut(false);
  }, []);

  useEffect(() => {
    if (!active) {
      setLockedOut(false);
      setAutoSubmitting(false);
      setViolationCount(0);
      violationCooldownRef.current = false;
      sessionGraceUntilRef.current = 0;
      document.body.classList.remove("exam-session-active");
      void exitExamContainerFullscreen();
      return;
    }

    setViolationCount(initialFocusWarningCount);
    sessionGraceUntilRef.current = Date.now() + 2500;
    document.body.classList.add("exam-session-active");

    return () => {
      document.body.classList.remove("exam-session-active");
      void exitExamContainerFullscreen();
    };
  }, [active, initialFocusWarningCount]);

  useEffect(() => {
    if (!active) return;

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (visibilityViolationTimerRef.current != null) {
          window.clearTimeout(visibilityViolationTimerRef.current);
          visibilityViolationTimerRef.current = null;
        }
        return;
      }

      if (visibilityViolationTimerRef.current != null) {
        window.clearTimeout(visibilityViolationTimerRef.current);
      }

      visibilityViolationTimerRef.current = window.setTimeout(() => {
        visibilityViolationTimerRef.current = null;
        if (!document.hidden) return;
        if (examInteractionRef.current || isAllowedExamOverlayOpen()) return;
        pauseExam();
      }, 400);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleBlur() {
      window.setTimeout(() => {
        if (isInStartupGrace()) return;
        if (
          !document.hidden &&
          !document.hasFocus() &&
          !isAllowedExamOverlayOpen() &&
          !examInteractionRef.current
        ) {
          pauseExam();
        }
      }, 300);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleBlur);
      if (examInteractionTimerRef.current != null) {
        window.clearTimeout(examInteractionTimerRef.current);
        examInteractionTimerRef.current = null;
      }
      if (visibilityViolationTimerRef.current != null) {
        window.clearTimeout(visibilityViolationTimerRef.current);
        visibilityViolationTimerRef.current = null;
      }
      examInteractionRef.current = false;
    };
  }, [active, isInStartupGrace, pauseExam]);

  return {
    lockedOut,
    violationCount,
    autoSubmitting,
    resumeFromPause,
    markExamInteraction,
  };
}

interface Props {
  active: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  interactionGuardRef?: MutableRefObject<((durationMs?: number) => void) | null>;
  onFocusWarningCountChange?: (count: number) => void;
  onMaxViolationsReached?: () => void;
  secondsRemaining?: number | null;
  examTimeLimitSeconds?: number | null;
  initialFocusWarningCount?: number;
}

function formatExamCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ExamLockCardIcon({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: "blue" | "warning" | "danger";
}) {
  return (
    <div className={`exam-lock-card-icon exam-lock-card-icon-${tone}`} aria-hidden>
      <Icon size={28} strokeWidth={2.25} />
    </div>
  );
}

export default function ExamSession({
  active,
  title = "Exam in Progress",
  children,
  footer,
  interactionGuardRef,
  onFocusWarningCountChange,
  onMaxViolationsReached,
  secondsRemaining = null,
  examTimeLimitSeconds = null,
  initialFocusWarningCount = 0,
}: Props) {
  const examContainerRef = useRef<HTMLDivElement>(null);
  const suppressFocusChecksRef = useRef(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [fullscreenPromptError, setFullscreenPromptError] = useState("");
  const { lockedOut, violationCount, autoSubmitting, resumeFromPause, markExamInteraction } =
    useExamLockdown(
      active,
      onMaxViolationsReached,
      initialFocusWarningCount,
      suppressFocusChecksRef
    );

  const dismissFullscreenPrompt = useCallback(() => {
    setShowFullscreenPrompt(false);
    setFullscreenPromptError("");
    suppressFocusChecksRef.current = false;
  }, []);

  const continueToExam = useCallback(() => {
    dismissFullscreenPrompt();
  }, [dismissFullscreenPrompt]);

  useEffect(() => {
    if (!active) {
      setShowFullscreenPrompt(false);
      setFullscreenPromptError("");
      suppressFocusChecksRef.current = false;
      return;
    }

    setShowFullscreenPrompt(true);
    suppressFocusChecksRef.current = true;
  }, [active]);

  useEffect(() => {
    if (!active || !showFullscreenPrompt) return;

    function handleFullscreenChange() {
      if (isExamContainerFullscreen(examContainerRef.current)) {
        dismissFullscreenPrompt();
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [active, dismissFullscreenPrompt, showFullscreenPrompt]);

  async function handleEnterFullscreen() {
    setFullscreenPromptError("");
    const entered = await requestExamContainerFullscreen(examContainerRef.current);
    if (entered || isExamContainerFullscreen(examContainerRef.current)) {
      dismissFullscreenPrompt();
      return;
    }
    setFullscreenPromptError(
      canRequestExamFullscreen()
        ? "Fullscreen was blocked. Press F11 or click Continue to exam."
        : "Use F11 (Windows) or the browser View menu for fullscreen, then click Continue to exam."
    );
  }

  useEffect(() => {
    if (!interactionGuardRef) return;
    interactionGuardRef.current = markExamInteraction;
    return () => {
      interactionGuardRef.current = null;
    };
  }, [interactionGuardRef, markExamInteraction]);

  useEffect(() => {
    onFocusWarningCountChange?.(violationCount);
  }, [violationCount, onFocusWarningCountChange]);

  if (!active) return null;

  const warningsRemaining = Math.max(0, MAX_EXAM_FOCUS_VIOLATIONS - violationCount);
  const showFullscreenGate = showFullscreenPrompt && !autoSubmitting && !lockedOut;
  const fullscreenApiAvailable = canRequestExamFullscreen();

  return (
    <div
      ref={examContainerRef}
      className="exam-session"
      role="dialog"
      aria-modal="true"
      aria-label="Exam session"
      onPointerDownCapture={() => markExamInteraction()}
      onClickCapture={() => markExamInteraction()}
    >
      <header className="exam-session-header">
        <div>
          <h2>{title}</h2>
          <p className="muted exam-session-subtitle">
            Stay on this exam screen. Up to {MAX_EXAM_FOCUS_VIOLATIONS} tab or window switches are
            allowed — the exam auto-submits on the {MAX_EXAM_FOCUS_VIOLATIONS}rd.
          </p>
        </div>
        <div className="exam-session-header-meta">
          {violationCount > 0 && (
            <span className="exam-session-warning">
              <AlertTriangle size={14} strokeWidth={2.25} aria-hidden />
              Focus warnings: {violationCount}/{MAX_EXAM_FOCUS_VIOLATIONS}
            </span>
          )}
          {secondsRemaining != null && examTimeLimitSeconds != null ? (
            <div
              className={`exam-session-timer${
                secondsRemaining <= 60 ? " exam-session-timer-urgent" : ""
              }`}
              role="timer"
              aria-live="polite"
              aria-label={`${secondsRemaining} seconds remaining`}
            >
              <span className="exam-session-timer-value">
                {formatExamCountdown(secondsRemaining)}
              </span>
              <span className="exam-session-timer-label">remaining</span>
            </div>
          ) : null}
        </div>
      </header>

      <div className={`exam-session-content${lockedOut ? " exam-session-content-locked" : ""}`}>
        {children}
      </div>

      {footer && <footer className="exam-session-footer">{footer}</footer>}

      {showFullscreenGate && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
            <ExamLockCardIcon icon={Maximize2} tone="blue" />
            <h2>Enter fullscreen</h2>
            {fullscreenApiAvailable ? (
              <p>
                For the best exam experience, enter fullscreen now. You can also press{" "}
                <strong>F11</strong> (Windows) or use your browser&apos;s fullscreen control.
              </p>
            ) : (
              <p>
                This connection cannot use one-click fullscreen. Press <strong>F11</strong> on
                Windows (or use the browser <strong>View → Full screen</strong> menu), then continue
                below.
              </p>
            )}
            {fullscreenPromptError ? <p className="error">{fullscreenPromptError}</p> : null}
            <div className="exam-fullscreen-prompt-actions">
              {fullscreenApiAvailable ? (
                <button type="button" className="btn" onClick={() => void handleEnterFullscreen()}>
                  Enter fullscreen
                </button>
              ) : null}
              <button
                type="button"
                className={fullscreenApiAvailable ? "btn secondary" : "btn"}
                onClick={continueToExam}
              >
                Continue to exam
              </button>
            </div>
          </div>
        </div>
      )}

      {autoSubmitting && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
            <ExamLockCardIcon icon={ShieldAlert} tone="danger" />
            <h2>Exam auto-submitted</h2>
            <p>
              You left the exam view {MAX_EXAM_FOCUS_VIOLATIONS} times. Your exam is being submitted
              now.
            </p>
          </div>
        </div>
      )}

      {lockedOut && !autoSubmitting && !showFullscreenGate && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
            <ExamLockCardIcon icon={AlertTriangle} tone="warning" />
            <h2>Exam paused</h2>
            <p>You switched tabs, minimized the window, or left the exam view.</p>
            <p className="muted">
              Focus warning {violationCount} of {MAX_EXAM_FOCUS_VIOLATIONS}.
              {warningsRemaining === 1
                ? " One more switch will auto-submit your exam."
                : ` ${warningsRemaining} more switches will auto-submit your exam.`}
            </p>
            <button type="button" className="btn" onClick={resumeFromPause}>
              Return to exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
