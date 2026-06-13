import { useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

interface Props {
  examType: "diagnostic" | "retake";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export default function ExamInstructionsModal({
  examType,
  onConfirm,
  onCancel,
  loading = false,
  error = "",
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onCancel);

  const title = examType === "retake" ? "Retake Exam Instructions" : "Comprehensive Exam Instructions";

  return (
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
            <li>This is a multiple-choice comprehensive exam. Each question has one correct answer.</li>
            <li>Questions are presented in a <strong>random order</strong> unique to you.</li>
            <li>Answer <strong>all questions</strong> before submitting. You cannot submit with blank answers.</li>
            <li>You may change your answers before clicking <strong>Submit Exam</strong>.</li>
            <li>Once submitted, your answers are <strong>final</strong> and cannot be changed.</li>
          </ul>

          <h3>Scoring &amp; passing</h3>
          <ul className="instructions-list">
            <li>Your score is computed as: correct answers ÷ total items.</li>
            <li>The passing mark is <strong>75%</strong>.</li>
            <li>Your result (score, percentage, pass/fail) will be shown immediately after submission.</li>
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
            <li>When you begin, the exam enters <strong>fullscreen mode</strong> and takes over your screen.</li>
            <li>Do <strong>not</strong> switch tabs, minimize the window, or open other applications during the exam.</li>
            <li>If you leave the exam view, it will <strong>pause</strong> until you return to fullscreen.</li>
            <li>You must <strong>submit the exam</strong> before closing or leaving this page.</li>
          </ul>

          <h3>Technical reminders</h3>
          <ul className="instructions-list">
            <li>Ensure you have a stable connection before starting.</li>
            <li>If a question includes an image, review it carefully before answering.</li>
            <li>Contact your teacher or proctor immediately if you experience technical problems.</li>
          </ul>
        </div>

        <label className="acknowledge-label">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          I have read and understood the instructions above, and I agree to follow the exam rules.
        </label>

        {error && <p className="error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={requestClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={!acknowledged || loading}
          >
            {loading ? "Starting..." : "Begin Exam"}
          </button>
        </div>
      </div>
    </div>
  );
}
