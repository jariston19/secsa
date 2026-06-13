import { useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
  _count?: { questions: number };
  topics?: Array<{ id: string; name: string }>;
}

interface SubjectEditDraft {
  courseCode: string;
  courseTitle: string;
  yearLevel: string;
}

interface Props {
  subjects: Subject[];
  token: string | null;
  onClose: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
}

export default function SavedSubjectsModal({ subjects, token, onClose, onUpdated }: Props) {
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SubjectEditDraft | null>(null);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setEditDraft({
      courseCode: subject.courseCode,
      courseTitle: subject.courseTitle,
      yearLevel: String(subject.yearLevel),
    });
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;

    setSavingId(id);
    setFeedback(null);

    try {
      await api(
        `/subjects/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...editDraft,
            yearLevel: parseYearLevel(editDraft.yearLevel),
          }),
        },
        token
      );
      const message = "Subject updated.";
      setFeedback({ text: message, isError: false });
      setEditingId(null);
      setEditDraft(null);
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subject";
      setFeedback({ text: message, isError: true });
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSubject(
    id: string,
    label: string,
    topicCount: number,
    questionCount: number
  ) {
    const confirmed = window.confirm(
      `Delete subject "${label}"?\n\nThis will also remove ${topicCount} topic(s) and ${questionCount} question(s). This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    setFeedback(null);
    if (editingId === id) cancelEdit();

    try {
      const result = await api<{ success: boolean; archivedSets?: number }>(
        `/subjects/${id}`,
        { method: "DELETE" },
        token
      );

      let message = "Subject deleted.";
      if (result.archivedSets && result.archivedSets > 0) {
        message += ` ${result.archivedSets} deployed question set(s) were archived.`;
      }

      setFeedback({ text: message, isError: false });
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete subject";
      setFeedback({ text: message, isError: true });
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("saved-subjects-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Saved Subjects</h2>
            <p className="muted">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"} in the system
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        <p className="muted section-desc">
          Edit or delete subjects. Subjects already used in student exams cannot be deleted.
        </p>

        {feedback && <p className={feedback.isError ? "error" : "success"}>{feedback.text}</p>}

        {subjects.length === 0 ? (
          <p className="muted">No subjects yet. Add one from the Setup tab.</p>
        ) : (
          <div className="modal-table-scroll">
            <table>
            <thead>
              <tr>
                <th>Course code</th>
                <th className="saved-subjects-title-col">Title</th>
                <th>Year</th>
                <th>Topics</th>
                <th>Questions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const isEditing = editingId === s.id;

                return (
                  <tr key={s.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editDraft?.courseCode ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => d && { ...d, courseCode: e.target.value })
                          }
                        />
                      ) : (
                        s.courseCode
                      )}
                    </td>
                    <td className="saved-subjects-title-col">
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editDraft?.courseTitle ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => d && { ...d, courseTitle: e.target.value })
                          }
                        />
                      ) : (
                        s.courseTitle
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input table-input-narrow"
                          type="text"
                          inputMode="numeric"
                          value={editDraft?.yearLevel ?? "1"}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d && {
                                ...d,
                                yearLevel: sanitizeYearInput(e.target.value),
                              }
                            )
                          }
                          onBlur={() =>
                            setEditDraft((d) =>
                              d && {
                                ...d,
                                yearLevel: String(parseYearLevel(d.yearLevel)),
                              }
                            )
                          }
                        />
                      ) : (
                        s.yearLevel
                      )}
                    </td>
                    <td>{s.topics?.length ?? 0}</td>
                    <td>{s._count?.questions ?? 0}</td>
                    <td>
                      <div className="action-buttons">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={savingId === s.id}
                              onClick={() => saveEdit(s.id)}
                            >
                              {savingId === s.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn secondary btn-sm"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn secondary btn-sm"
                              onClick={() => startEdit(s)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn danger btn-sm"
                              disabled={deletingId === s.id}
                              onClick={() =>
                                deleteSubject(
                                  s.id,
                                  `${s.courseCode} — ${s.courseTitle}`,
                                  s.topics?.length ?? 0,
                                  s._count?.questions ?? 0
                                )
                              }
                            >
                              {deletingId === s.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
