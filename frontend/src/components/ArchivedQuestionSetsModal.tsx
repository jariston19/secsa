import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import { formatProgramCourse, type ProgramCourseFilter, type ProgramCourseId } from "../lib/programCourse";

interface QuestionSet {
  id: string;
  name: string;
  yearLevel: number;
  programCourse: ProgramCourseId;
  type: "DIAGNOSTIC" | "RETAKE";
  status: string;
  totalItems: number;
  updatedAt: string;
  _count?: { examAttempts: number };
}

interface Props {
  programCourse: ProgramCourseFilter;
  token: string | null;
  onClose: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  onPreview: (setId: string) => void;
}

export default function ArchivedQuestionSetsModal({
  programCourse,
  token,
  onClose,
  onUpdated,
  onPreview,
}: Props) {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

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

  async function restoreSet(id: string, name: string) {
    const confirmed = window.confirm(
      `Restore question set "${name}"?\n\nIt will return to your Build list as a draft. You can edit and deploy it again.`
    );
    if (!confirmed) return;

    setRestoringId(id);
    try {
      await api(`/question-sets/${id}/restore`, { method: "POST" }, token);
      onUpdated("Question set restored to draft.");
      await loadArchived();
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to restore question set", true);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div
        className={panelClass("saved-subjects-modal archived-sets-modal")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Archived Question Sets</h2>
            <p className="muted">
              {programCourse === "ALL"
                ? "All program courses"
                : formatProgramCourse(programCourse)}{" "}
              · restore sets to edit or deploy again
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {loading && <p className="muted">Loading archived sets...</p>}

        {!loading && sets.length === 0 && (
          <p className="muted">
            No archived question sets
            {programCourse === "ALL" ? "" : " for this program course"}.
          </p>
        )}

        {!loading && sets.length > 0 && (
          <div className="table-responsive">
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
                {sets.map((set) => (
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
                          className="btn"
                          disabled={restoringId === set.id}
                          onClick={() => restoreSet(set.id, set.name)}
                        >
                          {restoringId === set.id ? "Restoring..." : "Restore"}
                        </button>
                      </div>
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
