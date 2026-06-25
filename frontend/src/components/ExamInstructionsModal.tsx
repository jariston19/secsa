import { useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { formatExamTimeLimit, MAX_EXAM_FOCUS_VIOLATIONS } from "../lib/constants";

interface Props {
  examType: "comprehensive" | "incoming_diagnostic" | "retake" | "preboard";
  timeLimitMinutes: number;
  passThreshold: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export default function ExamInstructionsModal({
  examType,
  timeLimitMinutes,
  passThreshold,
  onConfirm,
  onCancel,
  loading = false,
  error = "",
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onCancel);

  const requiresPrivacyAcknowledgement = examType === "incoming_diagnostic";
  const canBegin =
    acknowledged && (!requiresPrivacyAcknowledgement || privacyAcknowledged) && !loading;

  const title =
    examType === "retake"
      ? "Retake Exam Instructions"
      : examType === "incoming_diagnostic"
        ? "Incoming Diagnostic Instructions"
        : examType === "preboard"
          ? "Preboard Exam Instructions"
          : "Comprehensive Exam Instructions";

  const examLabel =
    examType === "incoming_diagnostic"
      ? "diagnostic"
      : examType === "preboard"
        ? "preboard"
        : "comprehensive";

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("instructions-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p className="muted">Please read carefully before you begin.</p>
          </div>
        </div>

        <div className="instructions-body">
          <h3>Before you start</h3>
          <ul className="instructions-list">
            <li>
              This is a multiple-choice {examLabel} exam. Each question has one correct answer.
            </li>
            <li>Questions are presented in a <strong>random order</strong> unique to you.</li>
            <li>
              You have <strong>{formatExamTimeLimit(timeLimitMinutes)}</strong> to complete this
              exam. It <strong>auto-submits</strong> when time runs out.
            </li>
            <li>
              Answer <strong>all questions</strong> before submitting early. Unanswered items count
              as incorrect if time expires.
            </li>
            <li>You may change your answers before clicking <strong>Submit Exam</strong>.</li>
            <li>Once submitted, your answers are <strong>final</strong> and cannot be changed.</li>
          </ul>

          <h3>Scoring &amp; passing</h3>
          <ul className="instructions-list">
            {examType === "incoming_diagnostic" ? (
              <>
                <li>
                  This diagnostic does <strong>not</strong> show a graded score after submission.
                </li>
                <li>
                  You will receive a <strong>learning profile</strong> highlighting strengths and
                  areas to develop.
                </li>
                <li>Your teacher uses this profile to guide early support — not pass/fail decisions.</li>
              </>
            ) : (
              <>
                <li>Your score is computed as: correct answers ÷ total items.</li>
                <li>The passing mark is <strong>{passThreshold}%</strong>.</li>
                <li>
                  Your result (score, percentage, pass/fail) will be shown immediately after
                  submission.
                </li>
              </>
            )}
          </ul>

          <h3>Academic integrity</h3>
          <ul className="instructions-list">
            <li>Complete this exam <strong>on your own</strong>. Do not copy, share answers, or use unauthorized materials.</li>
            <li>Do not photograph, screenshot, or distribute exam questions.</li>
            <li>Any form of cheating may result in disqualification and disciplinary action.</li>
          </ul>

          {examType === "retake" ? (
            <>
              <h3>Retake policy</h3>
              <ul className="instructions-list">
                <li>This is an approved <strong>retake attempt</strong>.</li>
                <li>You may have up to <strong>2 retake chances</strong> in total, subject to teacher or superadmin approval.</li>
                <li>Retake questions may differ from your first attempt.</li>
              </ul>
            </>
          ) : examType === "incoming_diagnostic" ? (
            <>
              <h3>About this diagnostic</h3>
              <ul className="instructions-list">
                <li>This <strong>incoming diagnostic</strong> measures readiness for incoming 1st-year students.</li>
                <li>It is separate from the comprehensive exam and does not use your retake allowance.</li>
                <li>Your result helps teachers identify strengths and topics to reinforce early.</li>
              </ul>

              <h3>Privacy policy</h3>
              <p className="instructions-lead">
                SECSA collects and processes information needed to run diagnostic and comprehensive
                exams, including your name, email, program, year level, exam responses, and exam session
                activity.
              </p>
              <h4 className="instructions-subheading">What we collect</h4>
              <ul className="instructions-list">
                <li>Account details you use to sign in.</li>
                <li>Exam answers, scores, and time spent on each question.</li>
                <li>Technical signals during exams, such as tab switches and fullscreen status.</li>
              </ul>
              <h4 className="instructions-subheading">How we use it</h4>
              <ul className="instructions-list">
                <li>To deliver exams and show appropriate results or learning profiles.</li>
                <li>To help teachers identify strengths, gaps, and retake eligibility.</li>
                <li>To maintain exam integrity and platform security.</li>
              </ul>
              <h4 className="instructions-subheading">Who can see your data</h4>
              <ul className="instructions-list">
                <li>You can view your own exam history and results or profiles.</li>
                <li>
                  Authorized teachers and administrators can view student performance for their classes.
                </li>
                <li>Data is not sold to third parties.</li>
              </ul>
              <h4 className="instructions-subheading">Your responsibilities</h4>
              <ul className="instructions-list">
                <li>Keep your login credentials private.</li>
                <li>Complete exams honestly and follow exam instructions.</li>
                <li>Contact your teacher or administrator if you have privacy concerns.</li>
              </ul>
            </>
          ) : examType === "preboard" ? (
            <>
              <h3>About this preboard</h3>
              <ul className="instructions-list">
                <li>
                  This <strong>preboard exam</strong> is for incoming final-year students in your
                  program and covers subjects across all curriculum years in that program.
                </li>
                <li>Complete your comprehensive exam track before taking the preboard.</li>
                <li>You get one preboard attempt when a set is deployed for your program.</li>
              </ul>
            </>
          ) : (
            <>
              <h3>Retake policy</h3>
              <ul className="instructions-list">
                <li>If you do not pass, a retake is <strong>not automatic</strong>.</li>
                <li>Your teacher or superadmin will review and approve retakes if you are eligible.</li>
                <li>You may have up to <strong>2 retake chances</strong> after your first attempt.</li>
              </ul>
            </>
          )}

          <h3>Exam lockdown</h3>
          <ul className="instructions-list">
            <li>
              After you begin, a <strong>fullscreen prompt</strong> appears. Use{" "}
              <strong>Enter fullscreen</strong> when available, or press <strong>F11</strong> (Windows)
              and then <strong>Continue to exam</strong>.
            </li>
            <li>Do <strong>not</strong> switch tabs, minimize the window, or open other applications during the exam.</li>
            <li>
              You may switch away <strong>up to {MAX_EXAM_FOCUS_VIOLATIONS - 1} times</strong> — each time
              the exam pauses until you return to the exam screen.
            </li>
            <li>
              On the <strong>{MAX_EXAM_FOCUS_VIOLATIONS}rd</strong> tab or window switch, your exam is{" "}
              <strong>auto-submitted</strong>.
            </li>
            <li>You must <strong>submit the exam</strong> before closing or leaving this page once you are finished.</li>
          </ul>

          <h3>Technical reminders</h3>
          <ul className="instructions-list">
            <li>Ensure you have a stable connection before starting.</li>
            <li>If a question includes an image, review it carefully before answering.</li>
            <li>Contact your teacher or proctor immediately if you experience technical problems.</li>
          </ul>
        </div>

        <div className="acknowledge-labels">
          <label className="acknowledge-label">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I have read and understood the instructions above, and I agree to follow the exam rules.
          </label>

          {requiresPrivacyAcknowledgement ? (
            <label className="acknowledge-label">
              <input
                type="checkbox"
                checked={privacyAcknowledged}
                onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
              />
              I have read and understand this privacy policy.
            </label>
          ) : null}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={requestClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onConfirm} disabled={!canBegin}>
            {loading ? "Starting..." : "Begin Exam"}
          </button>
        </div>
      </div>
    </div>
  );}
