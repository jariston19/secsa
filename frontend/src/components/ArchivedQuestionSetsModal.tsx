import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import { toastDeleted, toastRestored } from "../lib/toastMessages";
import { formatProgramCourse, type ProgramCourseFilter, type ProgramCourseId } from "../lib/programCourse";
import { useConfirm } from "../lib/confirm";
import {
  fetchQuestionSetPreview,
  printQuestionSetPreview,
} from "../lib/questionSetPreview";

interface QuestionSet {
  id: string;
  name: string;
  yearLevel: number;
  programCourse: ProgramCourseId;
  type: "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE";
  status: string;
  totalItems: number;
  updatedAt: string;
  _count?: { examAttempts: number };
}

interface Props {
  programCourse: ProgramCourseFilter;
  token: string | null;
  onClose?: () => void;
  embedded?: boolean;
  onUpdated: (message: string, isError?: boolean) => void;
  onPreview: (setId: string) => void;
  onDeleted?: (setId: string) => void;
}

export default function ArchivedQuestionSetsModal({
  programCourse,
  token,
  onClose,
  embedded = false,
  onUpdated,
  onPreview,
  onDeleted,
}: Props) {
  const confirm = useConfirm();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [printingSetId, setPrintingSetId] = useState<string | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose ?? (() => {}));

  async function loadArchived() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "ARCHIVED" });
      if (programCourse !== "ALL") {
        params.set("programCourse", programCourse);
      }
      const result = await api<{ questionSets: QuestionSet[] }>(
        `/question-sets?${params}`,
        {},
        token
      );
      setSets(result.questionSets);
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to load archived sets", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArchived().catch(() => {});
  }, [programCourse, token]);

  const {
    paginatedItems: paginatedSets,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(sets, { resetKey: `${programCourse}-${sets.length}` });

  async function restoreSet(id: string, name: string) {
    const confirmed = await confirm({
      title: "Restore question set?",
      message: `Restore question set "${name}"?\n\nIt will return to your Build list as a draft. You can edit and deploy it again.`,
      tone: "default",
      confirmLabel: "Restore",
    });
    if (!confirmed) return;

    setRestoringId(id);
    try {
      await api(`/question-sets/${id}/restore`, { method: "POST" }, token);
      onUpdated(toastRestored("question set", name));
      await loadArchived();
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to restore question set", true);
    } finally {
      setRestoringId(null);
    }
  }

  async function deleteSet(id: string, name: string, attemptCount: number) {
    if (attemptCount > 0) {
      onUpdated("Cannot delete a question set that students have already used for exams.", true);
      return;
    }

    const confirmed = await confirm({
      title: "Delete question set?",
      message: `Delete archived question set "${name}"?\n\nThis cannot be undone. Questions in the pool will not be deleted.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await api(`/question-sets/${id}`, { method: "DELETE" }, token);
      onDeleted?.(id);
      onUpdated(toastDeleted("question set", name));
      await loadArchived();
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to delete question set", true);
    } finally {
      setDeletingId(null);
    }
  }

  async function printSet(id: string) {
    setPrintingSetId(id);
    try {
      const preview = await fetchQuestionSetPreview(id, token);
      printQuestionSetPreview(preview);
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to print question set", true);
    } finally {
      setPrintingSetId(null);
    }
  }

  const content = (
    <>
      <div className={embedded ? "sets-header" : "modal-header"}>
        <div>
          <h2>{embedded ? "Archive" : "Archived Question Sets"}</h2>
          <p className="muted">
            {programCourse === "ALL"
              ? "All program courses"
              : formatProgramCourse(programCourse)}{" "}
            · restore or delete sets with no exam attempts
          </p>
        </div>
        {!embedded ? (
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        ) : null}
      </div>

      {loading && <p className="muted">Loading archived sets...</p>}

      {!loading && sets.length === 0 && (
        <p className="muted">
          No archived question sets
          {programCourse === "ALL" ? "" : " for this program course"}.
        </p>
      )}

      {!loading && sets.length > 0 && (
        <>
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
                    <th>Name</th>
                    <th>Year</th>
                    <th>Type</th>
                    <th>Items</th>
                    <th>Attempts</th>
                    <th>Archived</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSets.map((set) => (
                    <tr key={set.id}>
                      <td>{set.name}</td>
                      <td>{set.yearLevel}</td>
                      <td>{formatExamType(set.type)}</td>
                      <td>{set.totalItems}</td>
                      <td>{set._count?.examAttempts ?? 0}</td>
                      <td>{new Date(set.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => onPreview(set.id)}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={printingSetId === set.id}
                            onClick={() => printSet(set.id)}
                          >
                            {printingSetId === set.id ? "Printing..." : "Print"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={restoringId === set.id || deletingId === set.id}
                            onClick={() => restoreSet(set.id, set.name)}
                          >
                            {restoringId === set.id ? "Restoring..." : "Restore"}
                          </button>
                          {(set._count?.examAttempts ?? 0) === 0 ? (
                            <button
                              type="button"
                              className="btn danger"
                              disabled={deletingId === set.id || restoringId === set.id}
                              onClick={() =>
                                deleteSet(set.id, set.name, set._count?.examAttempts ?? 0)
                              }
                            >
                              {deletingId === set.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListPanel>
        </>
      )}
    </>
  );

  if (embedded) {
    return <section className="card build-sets-panel archived-sets-panel">{content}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div
        className={panelClass("saved-subjects-modal archived-sets-modal")}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}
