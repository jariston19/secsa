import { useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { toastDeleted, toastUpdated } from "../lib/toastMessages";
import {
  subjectHasProgram,
  type ProgramCourseFilter,
  type ProgramCourseId,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { useConfirm } from "../lib/confirm";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
  programCourses: Array<{ programCourse: ProgramCourseId }>;
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
  onClose?: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  inline?: boolean;
}

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

export default function SavedTopicsModal({
  topics,
  subjects,
  token,
  onClose,
  onUpdated,
  inline = false,
}: Props) {
  const confirm = useConfirm();
  const programCourseOptions = useProgramCourseOptions();
  const [programFilter, setProgramFilter] = useState<ProgramCourseFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(
    onClose ?? (() => {}),
    !inline
  );

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [subjects]
  );

  const courseSubjects = useMemo(
    () =>
      sortedSubjects.filter((subject) => {
        const programMatch =
          programFilter === "ALL" || subjectHasProgram(subject.programCourses, programFilter);
        const yearMatch = yearFilter === "ALL" || subject.yearLevel === Number(yearFilter);
        return programMatch && yearMatch;
      }),
    [sortedSubjects, programFilter, yearFilter]
  );

  useEffect(() => {
    if (courseSubjects.length === 0) {
      setSelectedSubjectId("");
      return;
    }

    const stillValid = courseSubjects.some((s) => s.id === selectedSubjectId);
    if (!stillValid) {
      setSelectedSubjectId(courseSubjects[0].id);
    }
  }, [courseSubjects, selectedSubjectId]);

  const selectedSubject = courseSubjects.find((s) => s.id === selectedSubjectId);

  const filteredTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === selectedSubjectId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [topics, selectedSubjectId]
  );

  const topicsResetKey = `${programFilter}-${yearFilter}-${selectedSubjectId}`;
  const {
    paginatedItems: paginatedTopics,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredTopics, { resetKey: topicsResetKey });

  function handleProgramFilterChange(value: ProgramCourseFilter) {
    setProgramFilter(value);
    cancelEdit();
  }

  function handleYearFilterChange(value: YearLevelFilter) {
    setYearFilter(value);
    cancelEdit();
  }

  function handleSubjectChange(subjectId: string) {
    setSelectedSubjectId(subjectId);
    cancelEdit();
  }

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setEditName(topic.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !selectedSubjectId) return;

    setSavingId(id);

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
      const message = toastUpdated("topic", editName.trim());
      cancelEdit();
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update topic";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTopic(id: string, label: string, questionCount: number) {
    const confirmed = await confirm({
      title: "Delete topic?",
      message: `Delete topic "${label}"?\n\nThis will also remove ${questionCount} question(s). This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingId(id);
    if (editingId === id) cancelEdit();

    try {
      const result = await api<{ success: boolean; archivedSets?: number }>(
        `/topics/${id}`,
        { method: "DELETE" },
        token
      );

      let message = toastDeleted("topic", label);
      if (result.archivedSets && result.archivedSets > 0) {
        message += ` ${result.archivedSets} deployed question set(s) were archived.`;
      }

      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete topic";
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Saved Topics</h2>
          <p className="muted section-desc">
            Filter by program course and year level, then select a subject to view and manage its
            topics.
          </p>
        </div>
        <div className="saved-panel-header-end">
          <span className="muted saved-panel-count">
            {topics.length} topic{topics.length === 1 ? "" : "s"} across{" "}
            {subjects.length} subject{subjects.length === 1 ? "" : "s"}
          </span>
          {!inline && (
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {subjects.length === 0 ? (
        <p className="muted">No subjects yet. Add a subject from the Setup tab first.</p>
      ) : (
        <div className="saved-topics-filters">
          <label className="saved-topics-filter">
            Program course
            <select
              value={programFilter}
              onChange={(e) => handleProgramFilterChange(e.target.value as ProgramCourseFilter)}
            >
              <option value="ALL">All</option>
              {programCourseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.label}
                </option>
              ))}
            </select>
          </label>
          <label className="saved-topics-filter">
            Year level
            <select
              value={yearFilter}
              onChange={(e) => handleYearFilterChange(e.target.value as YearLevelFilter)}
            >
              <option value="ALL">All</option>
              {Array.from(
                { length: MAX_YEAR_LEVEL - MIN_YEAR_LEVEL + 1 },
                (_, i) => MIN_YEAR_LEVEL + i
              ).map((level) => (
                <option key={level} value={String(level)}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="saved-topics-filter">
            Subject
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={courseSubjects.length === 0}
            >
              {courseSubjects.length === 0 ? (
                <option value="">No subjects for these filters</option>
              ) : (
                courseSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.courseCode} — {s.courseTitle}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      )}

      {subjects.length > 0 && selectedSubject && (
        <>
          <div className="saved-topics-subject-heading">
            <strong>
              {selectedSubject.courseCode} — {selectedSubject.courseTitle}
            </strong>
          </div>

          {filteredTopics.length === 0 ? (
            <p className="muted">No topics for this subject yet. Add one from the Setup tab.</p>
          ) : (
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
                  <th className="saved-topics-name-col">Topic name</th>
                  <th>Year</th>
                  <th>Questions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTopics.map((t) => {
                  const isEditing = editingId === t.id;

                  return (
                    <tr key={t.id}>
                      <td className="saved-topics-name-col" title={isEditing ? undefined : t.name}>
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
                      <td>{selectedSubject.yearLevel}</td>
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
            </ListPanel>
            </>
          )}
        </>
      )}
    </>
  );

  if (inline) {
    return <section className="card saved-panel saved-topics-modal">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("saved-topics-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
