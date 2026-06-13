import { ReactNode, useCallback, useEffect, useState } from "react";

type LockReason = "tab" | "fullscreen" | null;

async function enterFullscreen() {
  if (!document.fullscreenEnabled) return false;

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
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

function useExamLockdown(active: boolean) {
  const [lockedOut, setLockedOut] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason>(null);
  const [violationCount, setViolationCount] = useState(0);

  const pauseExam = useCallback((reason: Exclude<LockReason, null>) => {
    setViolationCount((count) => count + 1);
    setLockReason(reason);
    setLockedOut(true);
  }, []);

  const resumeExam = useCallback(async () => {
    const entered = await enterFullscreen();
    if (!entered && document.fullscreenEnabled) {
      return false;
    }
    setLockedOut(false);
    setLockReason(null);
    return true;
  }, []);

  useEffect(() => {
    if (!active) {
      setLockedOut(false);
      setLockReason(null);
      document.body.classList.remove("exam-session-active");
      void exitFullscreen();
      return;
    }

    document.body.classList.add("exam-session-active");
    void enterFullscreen();

    function handleVisibilityChange() {
      if (document.hidden) {
        pauseExam("tab");
      }
    }

    function handleFullscreenChange() {
      if (active && !document.fullscreenElement) {
        pauseExam("fullscreen");
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleBlur() {
      window.setTimeout(() => {
        if (active && !document.hidden && !document.hasFocus()) {
          pauseExam("tab");
        }
      }, 0);
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
      document.body.classList.remove("exam-session-active");
      void exitFullscreen();
    };
  }, [active, pauseExam]);

  return {
    lockedOut,
    lockReason,
    violationCount,
    resumeExam,
  };
}

interface Props {
  active: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function ExamSession({
  active,
  title = "Exam in Progress",
  children,
  footer,
}: Props) {
  const { lockedOut, lockReason, violationCount, resumeExam } = useExamLockdown(active);
  const [resumeError, setResumeError] = useState("");

  if (!active) return null;

  async function handleResume() {
    setResumeError("");
    const resumed = await resumeExam();
    if (!resumed && document.fullscreenEnabled) {
      setResumeError("Fullscreen is required to continue. Click the button again and allow fullscreen.");
    }
  }

  return (
    <div className="exam-session" role="dialog" aria-modal="true" aria-label="Exam session">
      <header className="exam-session-header">
        <div>
          <h2>{title}</h2>
          <p className="muted exam-session-subtitle">
            Fullscreen exam mode is active. Finish and submit before leaving this page.
          </p>
        </div>
        {violationCount > 0 && (
          <span className="exam-session-warning">
            Focus warnings: {violationCount}
          </span>
        )}
      </header>

      <div className={`exam-session-content${lockedOut ? " exam-session-content-locked" : ""}`}>
        {children}
      </div>

      {footer && <footer className="exam-session-footer">{footer}</footer>}

      {lockedOut && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-card card">
            <h2>Exam paused</h2>
            <p>
              {lockReason === "tab"
                ? "You switched tabs, minimized the window, or left the exam view."
                : "You exited fullscreen mode during the exam."}
            </p>
            <p className="muted">
              Return to this tab and re-enter fullscreen to continue. Your answers are saved, but
              you must finish and submit the exam before leaving.
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
