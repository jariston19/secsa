import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { MAX_EXAM_FOCUS_VIOLATIONS } from "../lib/constants";

function isAllowedExamOverlayOpen() {
  return Boolean(document.querySelector(".question-image-overlay:not(.is-closing)"));
}

function useExamLockdown(
  active: boolean,
  onMaxViolationsReached?: () => void,
  initialFocusWarningCount = 0
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
  }, [isInStartupGrace]);

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
      return;
    }

    setViolationCount(initialFocusWarningCount);
    sessionGraceUntilRef.current = Date.now() + 2500;
    document.body.classList.add("exam-session-active");

    return () => {
      document.body.classList.remove("exam-session-active");
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
  const { lockedOut, violationCount, autoSubmitting, resumeFromPause, markExamInteraction } =
    useExamLockdown(active, onMaxViolationsReached, initialFocusWarningCount);

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

  return (
    <div
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
            Stay on this exam screen. Use your browser&apos;s fullscreen (e.g. F11) if you want.
            Up to {MAX_EXAM_FOCUS_VIOLATIONS} tab or window switches are allowed — the exam
            auto-submits on the {MAX_EXAM_FOCUS_VIOLATIONS}rd.
          </p>
        </div>
        <div className="exam-session-header-meta">
          {violationCount > 0 && (
            <span className="exam-session-warning">
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

      {autoSubmitting && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
            <h2>Exam auto-submitted</h2>
            <p>
              You left the exam view {MAX_EXAM_FOCUS_VIOLATIONS} times. Your exam is being submitted
              now.
            </p>
          </div>
        </div>
      )}

      {lockedOut && !autoSubmitting && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
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
