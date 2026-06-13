import { useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
}

interface Topic {
  id: string;
  name: string;
  subjectId: string;
  subject?: { courseCode: string; courseTitle: string };
  _count?: { questions: number };
}

interface Props {
  topics: Topic[];
  subjects: Subject[];
  token: string | null;
  onClose: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
}

export default function SavedTopicsModal({
  topics,
  subjects,
  token,
  onClose,
  onUpdated,
}: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [subjects]
  );

  useEffect(() => {
    if (sortedSubjects.length === 0) {
      setSelectedSubjectId("");
      return;
    }

    const stillValid = sortedSubjects.some((s) => s.id === selectedSubjectId);
    if (!stillValid) {
      setSelectedSubjectId(sortedSubjects[0].id);
    }
  }, [sortedSubjects, selectedSubjectId]);

  const selectedSubject = sortedSubjects.find((s) => s.id === selectedSubjectId);

  const filteredTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === selectedSubjectId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [topics, selectedSubjectId]
  );

  function handleSubjectChange(subjectId: string) {
    setSelectedSubjectId(subjectId);
    cancelEdit();
    setFeedback(null);
  }

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setEditName(topic.name);
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !selectedSubjectId) return;

    setSavingId(id);
    setFeedback(null);

    try {
      await api(
        `/topics/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editName.trim(),
            subjectId: selectedSubjectId,
          }),
        },
        token
      );
      const message = "Topic updated.";
      setFeedback({ text: message, isError: false });
      cancelEdit();
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update topic";
      setFeedback({ text: message, isError: true });
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTopic(id: string, label: string, questionCount: number) {
    const confirmed = window.confirm(
      `Delete topic "${label}"?\n\nThis will also remove ${questionCount} question(s). This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    setFeedback(null);
    if (editingId === id) cancelEdit();

    try {
      const result = await api<{ success: boolean; archivedSets?: number }>(
        `/topics/${id}`,
        { method: "DELETE" },
        token
      );

      let message = "Topic deleted.";
      if (result.archivedSets && result.archivedSets > 0) {
        message += ` ${result.archivedSets} deployed question set(s) were archived.`;
      }

      setFeedback({ text: message, isError: false });
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete topic";
      setFeedback({ text: message, isError: true });
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("saved-topics-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Saved Topics</h2>
            <p className="muted">
              {topics.length} topic{topics.length === 1 ? "" : "s"} across{" "}
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        <p className="muted section-desc">
          Select a subject to view and manage its topics.
        </p>

        {subjects.length === 0 ? (
          <p className="muted">No subjects yet. Add a subject from the Setup tab first.</p>
        ) : (
          <label className="saved-topics-filter">
            Subject
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
            >
              {sortedSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseCode} — {s.courseTitle}
                </option>
              ))}
            </select>
          </label>
        )}

        {feedback && <p className={feedback.isError ? "error" : "success"}>{feedback.text}</p>}

        {subjects.length > 0 && selectedSubject && (
          <>
            <p className="saved-topics-subject-heading">
              <strong>
                {selectedSubject.courseCode} — {selectedSubject.courseTitle}
              </strong>
              <span className="muted">
                {filteredTopics.length} topic{filteredTopics.length === 1 ? "" : "s"}
              </span>
            </p>

            {filteredTopics.length === 0 ? (
              <p className="muted">No topics for this subject yet. Add one from the Setup tab.</p>
            ) : (
              <div className="modal-table-scroll">
                <table>
                <thead>
                  <tr>
                    <th className="saved-topics-name-col">Topic name</th>
                    <th>Questions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopics.map((t) => {
                    const isEditing = editingId === t.id;

                    return (
                      <tr key={t.id}>
                        <td className="saved-topics-name-col">
                          {isEditing ? (
                            <input
                              className="table-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          ) : (
                            t.name
                          )}
                        </td>
                        <td>{t._count?.questions ?? 0}</td>
                        <td>
                          <div className="action-buttons">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={savingId === t.id || !editName.trim()}
                                  onClick={() => saveEdit(t.id)}
                                >
                                  {savingId === t.id ? "Saving..." : "Save"}
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
                                  onClick={() => startEdit(t)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn danger btn-sm"
                                  disabled={deletingId === t.id}
                                  onClick={() =>
                                    deleteTopic(t.id, t.name, t._count?.questions ?? 0)
                                  }
                                >
                                  {deletingId === t.id ? "Deleting..." : "Delete"}
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
          </>
        )}
      </div>
    </div>
  );
}
