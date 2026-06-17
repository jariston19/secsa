import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { MAX_EXAM_FOCUS_VIOLATIONS } from "../lib/constants";

type LockReason = "tab" | "fullscreen" | null;

function supportsFullscreenLockdown() {
  return document.fullscreenEnabled && window.isSecureContext;
}

async function enterFullscreen(target: HTMLElement | null) {
  if (!supportsFullscreenLockdown() || !target) return false;

  try {
    if (document.fullscreenElement !== target) {
      await target.requestFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

async function exitFullscreen() {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore if the browser blocks exit.
    }
  }
}

function isAllowedExamOverlayOpen() {
  return Boolean(document.querySelector(".question-image-overlay:not(.is-closing)"));
}

function useExamLockdown(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onMaxViolationsReached?: () => void
) {
  const [lockedOut, setLockedOut] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const violationCooldownRef = useRef(false);
  const examInteractionRef = useRef(false);
  const examInteractionTimerRef = useRef<number | null>(null);
  const fullscreenViolationTimerRef = useRef<number | null>(null);
  const visibilityViolationTimerRef = useRef<number | null>(null);
  const onMaxViolationsReachedRef = useRef(onMaxViolationsReached);
  const autoSubmittingRef = useRef(false);

  useEffect(() => {
    onMaxViolationsReachedRef.current = onMaxViolationsReached;
  }, [onMaxViolationsReached]);

  useEffect(() => {
    autoSubmittingRef.current = autoSubmitting;
  }, [autoSubmitting]);

  const clearFullscreenViolationTimer = useCallback(() => {
    if (fullscreenViolationTimerRef.current != null) {
      window.clearTimeout(fullscreenViolationTimerRef.current);
      fullscreenViolationTimerRef.current = null;
    }
  }, []);

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

  const pauseExam = useCallback((reason: Exclude<LockReason, null>) => {
    if (violationCooldownRef.current || autoSubmittingRef.current) return;
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
        setLockReason(null);
        window.setTimeout(() => onMaxViolationsReachedRef.current?.(), 0);
        return next;
      }

      setLockReason(reason);
      setLockedOut(true);
      return next;
    });
  }, []);

  const scheduleFullscreenViolationCheck = useCallback(() => {
    clearFullscreenViolationTimer();
    fullscreenViolationTimerRef.current = window.setTimeout(() => {
      fullscreenViolationTimerRef.current = null;
      const container = containerRef.current;
      if (!container || document.fullscreenElement === container) return;
      if (isAllowedExamOverlayOpen() || examInteractionRef.current) return;

      void enterFullscreen(container).then((entered) => {
        if (entered || document.fullscreenElement === container) return;
        pauseExam("fullscreen");
      });
    }, 1200);
  }, [clearFullscreenViolationTimer, containerRef, pauseExam]);

  const resumeExam = useCallback(async () => {
    if (!supportsFullscreenLockdown()) {
      setLockedOut(false);
      setLockReason(null);
      return true;
    }

    const entered = await enterFullscreen(containerRef.current);
    if (!entered && document.fullscreenEnabled) {
      return false;
    }
    setLockedOut(false);
    setLockReason(null);
    return true;
  }, [containerRef]);

  useEffect(() => {
    if (!active) {
      setLockedOut(false);
      setLockReason(null);
      setAutoSubmitting(false);
      violationCooldownRef.current = false;
      document.body.classList.remove("exam-session-active");
      void exitFullscreen();
      return;
    }

    document.body.classList.add("exam-session-active");

    const frame = window.requestAnimationFrame(() => {
      void enterFullscreen(containerRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.classList.remove("exam-session-active");
      void exitFullscreen();
    };
  }, [active, containerRef]);

  useEffect(() => {
    if (!active) return;

    function isExamFullscreen() {
      const container = containerRef.current;
      return Boolean(container && document.fullscreenElement === container);
    }

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
        pauseExam("tab");
      }, 400);
    }

    function handleFullscreenChange() {
      if (!supportsFullscreenLockdown()) return;

      if (isExamFullscreen()) {
        clearFullscreenViolationTimer();
        return;
      }

      if (isAllowedExamOverlayOpen()) return;
      if (examInteractionRef.current) return;

      scheduleFullscreenViolationCheck();
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleBlur() {
      window.setTimeout(() => {
        if (
          !document.hidden &&
          !document.hasFocus() &&
          !isAllowedExamOverlayOpen() &&
          !examInteractionRef.current
        ) {
          pauseExam("tab");
        }
      }, 300);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
      clearFullscreenViolationTimer();
      examInteractionRef.current = false;
    };
  }, [active, clearFullscreenViolationTimer, containerRef, pauseExam, scheduleFullscreenViolationCheck]);

  return {
    lockedOut,
    lockReason,
    violationCount,
    autoSubmitting,
    resumeExam,
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
}: Props) {
  const examContainerRef = useRef<HTMLDivElement>(null);
  const { lockedOut, lockReason, violationCount, autoSubmitting, resumeExam, markExamInteraction } =
    useExamLockdown(active, examContainerRef, onMaxViolationsReached);
  const [resumeError, setResumeError] = useState("");

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

  async function handleResume() {
    setResumeError("");
    const resumed = await resumeExam();
    if (!resumed && supportsFullscreenLockdown()) {
      setResumeError("Fullscreen is required to continue. Click the button again and allow fullscreen.");
    }
  }

  const warningsRemaining = Math.max(0, MAX_EXAM_FOCUS_VIOLATIONS - violationCount);

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
            Fullscreen exam mode is active. Up to {MAX_EXAM_FOCUS_VIOLATIONS} tab or window switches
            are allowed — the exam auto-submits on the {MAX_EXAM_FOCUS_VIOLATIONS}rd.
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
            <p>
              {lockReason === "tab"
                ? "You switched tabs, minimized the window, or left the exam view."
                : "You exited fullscreen mode during the exam."}
            </p>
            <p className="muted">
              Focus warning {violationCount} of {MAX_EXAM_FOCUS_VIOLATIONS}.
              {warningsRemaining === 1
                ? " One more switch will auto-submit your exam."
                : ` ${warningsRemaining} more switches will auto-submit your exam.`}{" "}
              Return to fullscreen to continue.
            </p>
            {resumeError && <p className="error">{resumeError}</p>}
            <button type="button" className="btn" onClick={handleResume}>
              Return to exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
