import { useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

const PRIVACY_POLICY_KEY = "secsa-privacy-policy-accepted";

export function privacyPolicyStorageKey(userId: string) {
  return `${PRIVACY_POLICY_KEY}:${userId}`;
}

export function hasAcceptedPrivacyPolicy(userId: string) {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(privacyPolicyStorageKey(userId)) === "1";
}

export function markPrivacyPolicyAccepted(userId: string) {
  localStorage.setItem(privacyPolicyStorageKey(userId), "1");
}

interface Props {
  userId: string;
  onClose: () => void;
  requireAcknowledgement?: boolean;
}

export default function StudentPrivacyPolicyModal({
  userId,
  onClose,
  requireAcknowledgement = true,
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose);

  function handleAccept() {
    markPrivacyPolicyAccepted(userId);
    onClose();
  }

  return portal(
    <div
      className={`${overlayClass} privacy-policy-overlay`}
      onClick={requireAcknowledgement ? undefined : requestClose}
    >
      <div
        className={panelClass("privacy-policy-modal")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-policy-title"
      >
        <div className="modal-header privacy-policy-header">
          <div>
            <h2 id="privacy-policy-title">Privacy Policy</h2>
            <p className="muted">
              {requireAcknowledgement
                ? "Please review before using SECSA Comprehensive Exam System."
                : "How SECSA handles your exam and account information."}
            </p>
          </div>
        </div>

        <div className="privacy-policy-body">
          <p className="privacy-policy-lead">
            SECSA collects and processes information needed to run diagnostic and comprehensive
            exams, including your name, email, program, year level, exam responses, and exam session
            activity.
          </p>

          <h3>What we collect</h3>
          <ul className="instructions-list">
            <li>Account details you use to sign in.</li>
            <li>Exam answers, scores, and time spent on each question.</li>
            <li>Technical signals during exams, such as tab switches and fullscreen status.</li>
          </ul>

          <h3>How we use it</h3>
          <ul className="instructions-list">
            <li>To deliver exams and show appropriate results or learning profiles.</li>
            <li>To help teachers identify strengths, gaps, and retake eligibility.</li>
            <li>To maintain exam integrity and platform security.</li>
          </ul>

          <h3>Who can see your data</h3>
          <ul className="instructions-list">
            <li>You can view your own exam history and results or profiles.</li>
            <li>
              Authorized teachers and administrators can view student performance for their classes.
            </li>
            <li>Data is not sold to third parties.</li>
          </ul>

          <h3>Your responsibilities</h3>
          <ul className="instructions-list">
            <li>Keep your login credentials private.</li>
            <li>Complete exams honestly and follow exam instructions.</li>
            <li>Contact your teacher or administrator if you have privacy concerns.</li>
          </ul>
        </div>

        <div className="privacy-policy-footer">
          {requireAcknowledgement ? (
            <>
              <label className="privacy-policy-acknowledge">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>I have read and understand this privacy policy.</span>
              </label>

              <button type="button" className="btn" onClick={handleAccept} disabled={!acknowledged}>
                Continue
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
