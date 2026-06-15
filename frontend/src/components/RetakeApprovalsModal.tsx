import { useEffect, useRef, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { formatFullName } from "../lib/names";
import { toastApproved } from "../lib/toastMessages";
import { useConfirm } from "../lib/confirm";

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
  onClose?: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  inline?: boolean;
}

export default function RetakeApprovalsModal({
  token,
  onClose,
  onUpdated,
  inline = false,
}: Props) {
  const confirm = useConfirm();
  const [approvals, setApprovals] = useState<RetakeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose ?? (() => {}));

  async function loadApprovals() {
    setLoading(true);
    try {
      const data = await api<{ approvals: RetakeApproval[] }>(
        "/exams/retakes?status=PENDING",
        {},
        token
      );
      setApprovals(data.approvals);
      setSelectedIds((current) => {
        const pendingIds = new Set(data.approvals.map((approval) => approval.id));
        return new Set([...current].filter((id) => pendingIds.has(id)));
      });
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

  const {
    paginatedItems: paginatedApprovals,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(approvals, { resetKey: approvals.length });

  const allSelected = approvals.length > 0 && selectedIds.size === approvals.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, allSelected]);

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(approvals.map((approval) => approval.id)));
  }

  async function approveRetake(id: string, studentName: string) {
    const confirmed = await confirm({
      title: "Approve retake?",
      message: `Approve retake for ${studentName}?`,
      tone: "default",
      confirmLabel: "Approve",
    });
    if (!confirmed) return;

    setApprovingId(id);

    try {
      await api(`/exams/retakes/${id}/approve`, { method: "POST", body: "{}" }, token);
      const message = toastApproved("retake request", studentName);
      onUpdated(message, false);
      await loadApprovals();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve retake";
      onUpdated(message, true);
    } finally {
      setApprovingId(null);
    }
  }

  async function approveSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const confirmed = await confirm({
      title: "Approve retakes?",
      message: `Approve ${ids.length} retake request${ids.length === 1 ? "" : "s"}?`,
      tone: "default",
      confirmLabel: "Approve all",
    });
    if (!confirmed) return;

    setBulkApproving(true);

    try {
      const result = await api<{ approved: number }>(
        "/exams/retakes/approve-batch",
        { method: "POST", body: JSON.stringify({ ids }) },
        token
      );
      const message = `Approved ${result.approved} retake request${result.approved === 1 ? "" : "s"}.`;
      onUpdated(message, false);
      setSelectedIds(new Set());
      await loadApprovals();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve retake requests";
      onUpdated(message, true);
    } finally {
      setBulkApproving(false);
    }
  }

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Retake Approvals</h2>
          <p className="muted section-desc">
            Students who failed can retake up to 2 times after approval.
          </p>
        </div>
        <div className="saved-panel-header-end">
          <span className="muted saved-panel-count">
            {loading
              ? "Loading..."
              : `${approvals.length} pending request${approvals.length === 1 ? "" : "s"}`}
          </span>
          {!inline && (
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading pending requests...</p>
      ) : approvals.length === 0 ? (
        <p className="muted">No pending retake approvals.</p>
      ) : (
        <>
          <div className="retake-approvals-toolbar">
            <label className="retake-approvals-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                disabled={bulkApproving}
              />
              <span>Select all</span>
            </label>
            <button
              type="button"
              className="btn secondary btn-sm"
              disabled={selectedIds.size === 0 || bulkApproving || approvingId !== null}
              onClick={() => approveSelected().catch(() => {})}
            >
              {bulkApproving
                ? "Approving..."
                : `Approve selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
            </button>
          </div>
          <ListPanel
            footer={
              <ModalPagination
                page={page}
                totalPages={totalPages}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalItems={totalItems}
                onPageChange={setPage}
              />
            }
          >
          <div className="modal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="retake-approvals-select-col" aria-label="Select" />
                  <th>Student</th>
                  <th>Year</th>
                  <th>Last attempt</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApprovals.map((approval) => {
                  const studentName = formatFullName(
                    approval.student.firstName,
                    approval.student.lastName
                  );
                  const isSelected = selectedIds.has(approval.id);

                  return (
                    <tr key={approval.id} className={isSelected ? "retake-approvals-row-selected" : ""}>
                      <td className="retake-approvals-select-col">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={bulkApproving}
                          onChange={() => toggleSelection(approval.id)}
                          aria-label={`Select ${studentName}`}
                        />
                      </td>
                      <td>
                        <strong>{studentName}</strong>
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
                          disabled={approvingId === approval.id || bulkApproving}
                          onClick={() => approveRetake(approval.id, studentName)}
                        >
                          {approvingId === approval.id ? "Approving..." : "Approve"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </ListPanel>
        </>
      )}
    </>
  );

  if (inline) {
    return <section className="card saved-panel retake-approvals-modal">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("retake-approvals-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
