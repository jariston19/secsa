import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { formatFullName } from "../lib/names";

interface RetakeApproval {
  id: string;
  yearLevel: number;
  status: string;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string; yearLevel: number };
  examAttempt: {
    score: number | null;
    percentage: number | null;
    passed: boolean | null;
    attemptType: string;
    attemptNumber: number;
  };
}

interface Props {
  token: string | null;
  onClose: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
}

export default function RetakeApprovalsModal({ token, onClose, onUpdated }: Props) {
  const [approvals, setApprovals] = useState<RetakeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  async function loadApprovals() {
    setLoading(true);
    try {
      const data = await api<{ approvals: RetakeApproval[] }>(
        "/exams/retakes?status=PENDING",
        {},
        token
      );
      setApprovals(data.approvals);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load retake requests";
      onUpdated(message, true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals().catch(() => {});
  }, [token]);

  async function approveRetake(id: string, studentName: string) {
    const confirmed = window.confirm(`Approve retake for ${studentName}?`);
    if (!confirmed) return;

    setApprovingId(id);

    try {
      await api(`/exams/retakes/${id}/approve`, { method: "POST", body: "{}" }, token);
      const message = `Retake approved for ${studentName}.`;
      onUpdated(message, false);
      await loadApprovals();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve retake";
      onUpdated(message, true);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("retake-approvals-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Retake Approvals</h2>
            <p className="muted">
              Students who failed can retake up to 2 times after approval.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading pending requests...</p>
        ) : approvals.length === 0 ? (
          <p className="muted">No pending retake approvals.</p>
        ) : (
          <div className="modal-table-scroll">
            <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Year</th>
                <th>Last attempt</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>
                    <strong>
                      {formatFullName(approval.student.firstName, approval.student.lastName)}
                    </strong>
                    <div className="muted table-subtext">{approval.student.email}</div>
                  </td>
                  <td>{approval.student.yearLevel}</td>
                  <td>
                    {approval.examAttempt.attemptType} #{approval.examAttempt.attemptNumber}
                  </td>
                  <td>
                    {approval.examAttempt.score != null
                      ? `${approval.examAttempt.score} (${approval.examAttempt.percentage?.toFixed(1)}%)`
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      disabled={approvingId === approval.id}
                      onClick={() =>
                        approveRetake(
                          approval.id,
                          formatFullName(approval.student.firstName, approval.student.lastName)
                        )
                      }
                    >
                      {approvingId === approval.id ? "Approving..." : "Approve"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
