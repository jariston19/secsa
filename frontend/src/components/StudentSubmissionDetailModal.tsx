import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import { formatFullName } from "../lib/names";

interface SubmissionAnswer {
  id: string;
  text: string;
  subject: string;
  topic: string | null;
  difficulty: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean | null;
}

interface SubmissionDetail {
  id: string;
  student: { id: string; firstName: string; lastName: string; email: string; yearLevel: number | null };
  questionSet: {
    name: string;
    yearLevel: number;
    type: string;
    passThreshold: number;
  };
  attemptType: string;
  attemptNumber: number;
  score: number | null;
  totalItems: number;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  answers: SubmissionAnswer[];
}

interface Props {
  submissionId: string;
  token: string | null;
  onClose: () => void;
}

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function StudentSubmissionDetailModal({ submissionId, token, onClose }: Props) {
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  useEffect(() => {
    setLoading(true);
    setError("");

    api<{ submission: SubmissionDetail }>(`/analytics/submissions/${submissionId}`, {}, token)
      .then((data) => setSubmission(data.submission))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load submission"))
      .finally(() => setLoading(false));
  }, [submissionId, token]);

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div
        className={panelClass("student-submission-detail-modal")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Exam Submission</h2>
            {submission && (
              <p className="muted">
                {formatFullName(submission.student.firstName, submission.student.lastName)} · Year{" "}
                {submission.student.yearLevel ?? "—"} · {submission.questionSet.name}
              </p>
            )}
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading submission...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : submission ? (
          <>
            <div className="submission-detail-summary">
              <div>
                <strong>
                  {submission.score ?? 0} / {submission.totalItems}
                </strong>{" "}
                ({submission.percentage?.toFixed(1) ?? "0.0"}%)
              </div>
              <div className={submission.passed ? "success" : "error"}>
                {submission.passed ? "Passed" : "Failed"} · pass threshold{" "}
                {submission.questionSet.passThreshold}%
              </div>
              <div className="muted">
                {formatAttemptType(submission.attemptType)} attempt #{submission.attemptNumber} ·{" "}
                {formatExamType(submission.questionSet.type)} · submitted{" "}
                {submission.submittedAt ? formatDate(submission.submittedAt) : "—"}
              </div>
            </div>

            <div className="modal-table-scroll student-submission-answers-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Subject</th>
                    <th>Selected</th>
                    <th>Correct</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.answers.map((answer, index) => (
                    <tr key={answer.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="submission-question-text">{answer.text}</div>
                        {answer.topic && (
                          <div className="muted table-subtext">{answer.topic}</div>
                        )}
                      </td>
                      <td>{answer.subject}</td>
                      <td>{answer.selectedOption ?? "—"}</td>
                      <td>{answer.correctOption}</td>
                      <td>
                        {answer.isCorrect == null
                          ? "—"
                          : answer.isCorrect
                            ? "Correct"
                            : "Wrong"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
