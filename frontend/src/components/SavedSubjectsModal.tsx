import { useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import {
  subjectLabel,
  toastDeleted,
  toastUpdated,
} from "../lib/toastMessages";
import {
  formatProgramCoursesList,
  subjectHasProgram,
  subjectProgramCourseIds,
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
  _count?: { questions: number };
  topics?: Array<{ id: string; name: string }>;
}

interface SubjectEditDraft {
  courseCode: string;
  courseTitle: string;
  yearLevel: string;
  programCourses: ProgramCourseId[];
}

interface Props {
  subjects: Subject[];
  token: string | null;
  onClose?: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  inline?: boolean;
}

export default function SavedSubjectsModal({
  subjects,
  token,
  onClose,
  onUpdated,
  inline = false,
}: Props) {
  const confirm = useConfirm();
  const programCourseOptions = useProgramCourseOptions();
  const [programFilter, setProgramFilter] = useState<ProgramCourseFilter>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SubjectEditDraft | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose ?? (() => {}));

  const filteredSubjects = useMemo(
    () =>
      subjects.filter((subject) =>
        programFilter === "ALL"
          ? true
          : subjectHasProgram(subject.programCourses, programFilter)
      ),
    [subjects, programFilter]
  );

  const {
    paginatedItems: paginatedSubjects,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredSubjects, { resetKey: programFilter });

  function handleProgramFilterChange(value: ProgramCourseFilter) {
    setProgramFilter(value);
    cancelEdit();
  }

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setEditDraft({
      courseCode: subject.courseCode,
      courseTitle: subject.courseTitle,
      yearLevel: String(subject.yearLevel),
      programCourses: subjectProgramCourseIds(subject.programCourses),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function toggleProgramCourse(courseId: ProgramCourseId, checked: boolean) {
    setEditDraft((draft) => {
      if (!draft) return draft;
      const next = checked
        ? [...draft.programCourses, courseId]
        : draft.programCourses.filter((id) => id !== courseId);
      return {
        ...draft,
        programCourses: next.length > 0 ? next : ([courseId] as ProgramCourseId[]),
      };
    });
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;

    setSavingId(id);

    try {
      await api(
        `/subjects/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            courseCode: editDraft.courseCode,
            courseTitle: editDraft.courseTitle,
            yearLevel: parseYearLevel(editDraft.yearLevel),
            programCourses: editDraft.programCourses,
          }),
        },
        token
      );
      const message = toastUpdated(
        "subject",
        subjectLabel(editDraft.courseCode, editDraft.courseTitle)
      );
      setEditingId(null);
      setEditDraft(null);
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subject";
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
    const confirmed = await confirm({
      title: "Delete subject?",
      message: `Delete subject "${label}"?\n\nThis will also remove ${topicCount} topic(s) and ${questionCount} question(s). This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingId(id);
    if (editingId === id) cancelEdit();

    try {
      const result = await api<{ success: boolean; archivedSets?: number }>(
        `/subjects/${id}`,
        { method: "DELETE" },
        token
      );

      let message = toastDeleted("subject", label);
      if (result.archivedSets && result.archivedSets > 0) {
        message += ` ${result.archivedSets} deployed question set(s) were archived.`;
      }

      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete subject";
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Saved Subjects</h2>
          <p className="muted section-desc">
            Filter by program course, then edit or delete subjects. Subjects already used in
            student exams cannot be deleted.
          </p>
        </div>
        <div className="saved-panel-header-end">
          <span className="muted saved-panel-count">
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} in the system
          </span>
          {!inline && (
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {subjects.length === 0 ? (
        <p className="muted">No subjects yet. Add one from the Setup tab.</p>
      ) : (
        <>
          <div className="saved-subjects-toolbar">
            <label className="saved-subjects-filter">
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
          </div>

          {filteredSubjects.length === 0 ? (
            <p className="muted">No subjects linked to this program course.</p>
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
                <th>Course code</th>
                <th className="saved-subjects-title-col">Title</th>
                <th>Programs</th>
                <th>Year</th>
                <th>Topics</th>
                <th>Questions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSubjects.map((s) => {
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
                    <td className="saved-subjects-title-col" title={isEditing ? undefined : s.courseTitle}>
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
                        <div className="saved-subjects-program-edit">
                          {programCourseOptions.map((course) => (
                            <label key={course.id} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={editDraft?.programCourses.includes(course.id) ?? false}
                                onChange={(e) => toggleProgramCourse(course.id, e.target.checked)}
                              />
                              {course.abbr}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <span title={formatProgramCoursesList(subjectProgramCourseIds(s.programCourses))}>
                          {formatProgramCoursesList(subjectProgramCourseIds(s.programCourses))}
                        </span>
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
              </ListPanel>
            </>
          )}
        </>
      )}
    </>
  );

  if (inline) {
    return <section className="card saved-panel saved-subjects-modal">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("saved-subjects-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
