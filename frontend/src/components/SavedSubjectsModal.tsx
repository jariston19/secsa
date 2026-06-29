import { useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import { api } from "../lib/api";
import { formatBulkDeleteMessage } from "../lib/bulkDeleteMessage";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL, parseYearLevel, sanitizeYearInput } from "../lib/constants";
import {
  subjectLabel,
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
import { matchesSubjectSearch, matchesTopicSearch } from "../lib/savedListSearch";
import {
  duplicateCourseCodeMessage,
  findDuplicateCourseCode,
  formatCourseCode,
} from "../lib/subjectDuplicates";

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

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

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
  const [yearFilter, setYearFilter] = useState<YearLevelFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    title: string;
    message: string;
    onConfirm: (password: string) => Promise<void>;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SubjectEditDraft | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(
    onClose ?? (() => {}),
    !inline
  );

  const programLabelById = useMemo(
    () => Object.fromEntries(programCourseOptions.map((course) => [course.id, course.label])),
    [programCourseOptions]
  );

  const filterMatchedSubjects = useMemo(
    () =>
      subjects.filter((subject) => {
        const programMatch =
          programFilter === "ALL" || subjectHasProgram(subject.programCourses, programFilter);
        const yearMatch = yearFilter === "ALL" || subject.yearLevel === Number(yearFilter);
        return programMatch && yearMatch;
      }),
    [subjects, programFilter, yearFilter]
  );

  const filteredSubjects = useMemo(
    () =>
      filterMatchedSubjects.filter((subject) =>
        matchesSubjectSearch(subject, searchQuery, programLabelById)
      ),
    [filterMatchedSubjects, searchQuery, programLabelById]
  );

  const {
    paginatedItems: paginatedSubjects,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredSubjects, { resetKey: `${programFilter}-${yearFilter}-${searchQuery}` });

  const editCourseCodeDuplicate = useMemo(() => {
    if (!editingId || !editDraft) return null;
    return findDuplicateCourseCode(subjects, editDraft.courseCode, editingId);
  }, [subjects, editingId, editDraft]);

  const selectedSubjects = useMemo(
    () => filteredSubjects.filter((subject) => selectedIds.has(subject.id)),
    [filteredSubjects, selectedIds]
  );

  const selectedCount = selectedSubjects.length;
  const pageSubjectIds = useMemo(
    () => paginatedSubjects.map((subject) => subject.id),
    [paginatedSubjects]
  );
  const allPageSelected =
    pageSubjectIds.length > 0 && pageSubjectIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    !allPageSelected && pageSubjectIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
    cancelEdit();
  }, [programFilter, yearFilter, searchQuery]);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelect(subjectId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(subjectId);
      else next.delete(subjectId);
      return next;
    });
  }

  function toggleSelectAll(subjectIds: string[], selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const subjectId of subjectIds) {
        if (selected) next.add(subjectId);
        else next.delete(subjectId);
      }
      return next;
    });
  }

  function handleToolbarEdit() {
    if (selectedSubjects.length !== 1) return;
    startEdit(selectedSubjects[0]);
  }

  function handleProgramFilterChange(value: ProgramCourseFilter) {
    setProgramFilter(value);
  }

  function handleYearFilterChange(value: YearLevelFilter) {
    setYearFilter(value);
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

    const courseCode = formatCourseCode(editDraft.courseCode);
    const duplicate = findDuplicateCourseCode(subjects, courseCode, id);
    if (duplicate) {
      onUpdated(duplicateCourseCodeMessage(duplicate), true);
      return;
    }

    setSavingId(id);

    try {
      await api(
        `/subjects/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            courseCode,
            courseTitle: editDraft.courseTitle,
            yearLevel: parseYearLevel(editDraft.yearLevel),
            programCourses: editDraft.programCourses,
          }),
        },
        token
      );
      const message = toastUpdated(
        "subject",
        subjectLabel(courseCode, editDraft.courseTitle)
      );
      setEditingId(null);
      setEditDraft(null);
      clearSelection();
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subject";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSelectedSubjects() {
    if (selectedSubjects.length === 0) return;

    const topicCount = selectedSubjects.reduce((sum, subject) => sum + (subject.topics?.length ?? 0), 0);
    const questionCount = selectedSubjects.reduce(
      (sum, subject) => sum + (subject._count?.questions ?? 0),
      0
    );

    const preview =
      selectedSubjects.length === 1
        ? `"${selectedSubjects[0].courseCode} — ${selectedSubjects[0].courseTitle}"`
        : `${selectedSubjects.length} selected subjects`;

    const confirmed = await confirm({
      title: selectedSubjects.length === 1 ? "Delete subject?" : "Delete selected subjects?",
      message: `Delete ${preview}?\n\nThis will also remove ${topicCount} topic(s) and ${questionCount} question(s). This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setBulkBusy(true);
    try {
      const result = await api<{
        deleted: number;
        archivedSets: number;
        failed: Array<{ id: string; error: string }>;
      }>(
        "/subjects/bulk-delete",
        {
          method: "POST",
          body: JSON.stringify({ ids: selectedSubjects.map((subject) => subject.id) }),
        },
        token
      );

      onUpdated(
        formatBulkDeleteMessage("subject", result),
        Boolean(result.failed?.length)
      );
      clearSelection();
      cancelEdit();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete subjects";
      onUpdated(message, true);
    } finally {
      setBulkBusy(false);
    }
  }

  function requestDeleteAllFiltered() {
    if (filteredSubjects.length === 0) return;

    const filterParts: string[] = [];
    if (searchQuery.trim()) {
      filterParts.push(`search "${searchQuery.trim()}"`);
    }
    if (programFilter !== "ALL") {
      filterParts.push(
        programCourseOptions.find((course) => course.id === programFilter)?.label ?? programFilter
      );
    }
    if (yearFilter !== "ALL") {
      filterParts.push(`year ${yearFilter}`);
    }
    const scopeLabel = filterParts.length > 0 ? filterParts.join(", ") : "the current view";

    setPasswordPrompt({
      title: "Delete all filtered subjects?",
      message: `Delete all ${filteredSubjects.length} subject(s) matching ${scopeLabel}?\n\nThis removes their topics and questions. Enter your password to confirm.`,
      onConfirm: async (password) => {
        setBulkBusy(true);
        try {
          const result = await api<{
            deleted: number;
            archivedSets: number;
            failed: Array<{ id: string; error: string }>;
          }>(
            "/subjects/delete-all",
            {
              method: "POST",
              body: JSON.stringify({
                password,
                ids: filteredSubjects.map((subject) => subject.id),
                ...(programFilter !== "ALL" ? { programCourse: programFilter } : {}),
                ...(yearFilter !== "ALL" ? { yearLevel: Number(yearFilter) } : {}),
              }),
            },
            token
          );

          onUpdated(
            formatBulkDeleteMessage("subject", result, scopeLabel),
            Boolean(result.failed?.length)
          );
          clearSelection();
          cancelEdit();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete subjects";
          onUpdated(message, true);
        } finally {
          setBulkBusy(false);
        }
      },
    });
  }

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Saved Subjects</h2>
          <p className="muted section-desc">
            Filter by program course and curriculum year. Search by course code or title. Select rows to edit or delete.
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
            <label className="saved-subjects-filter saved-subjects-filter-year">
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
            <label className="saved-list-search">
              Search
              <input
                type="search"
                placeholder="Course code or title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>

          {filteredSubjects.length === 0 ? (
            <p className="muted">
              {searchQuery.trim()
                ? "No subjects match your search."
                : "No subjects match these filters."}
            </p>
          ) : (
            <>
              <div className="saved-list-bulk-panel card">
                <span className="muted saved-list-selection-count">
                  {selectedCount > 0
                    ? `${selectedCount} selected`
                    : searchQuery.trim()
                      ? `${filteredSubjects.length} of ${filterMatchedSubjects.length} subject${filterMatchedSubjects.length === 1 ? "" : "s"}`
                      : `${filteredSubjects.length} subject${filteredSubjects.length === 1 ? "" : "s"} shown`}
                </span>
                <div className="saved-list-bulk-actions">
                  {editingId ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={
                          savingId === editingId ||
                          (editCourseCodeDuplicate !== null && editingId !== null)
                        }
                        onClick={() => saveEdit(editingId)}
                      >
                        {savingId === editingId ? "Saving..." : "Save"}
                      </button>
                      <button type="button" className="btn secondary btn-sm" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn secondary btn-sm"
                        disabled={selectedCount !== 1 || bulkBusy}
                        onClick={handleToolbarEdit}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn danger btn-sm"
                        disabled={selectedCount === 0 || bulkBusy}
                        onClick={() => deleteSelectedSubjects().catch(() => {})}
                      >
                        {bulkBusy ? "Deleting..." : "Delete selected"}
                      </button>
                      <button
                        type="button"
                        className="btn danger btn-sm"
                        disabled={filteredSubjects.length === 0 || bulkBusy}
                        onClick={requestDeleteAllFiltered}
                      >
                        Delete all filtered
                      </button>
                    </>
                  )}
                </div>
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
                <th className="saved-list-select-cell">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = somePageSelected;
                    }}
                    onChange={(e) => toggleSelectAll(pageSubjectIds, e.target.checked)}
                    disabled={Boolean(editingId) || bulkBusy}
                    aria-label="Select all on this page"
                  />
                </th>
                <th>Course code</th>
                <th className="saved-subjects-title-col">Title</th>
                <th>Programs</th>
                <th>Year</th>
                <th>Topics</th>
                <th>Questions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSubjects.map((s) => {
                const isEditing = editingId === s.id;
                const isSelected = selectedIds.has(s.id);

                return (
                  <tr
                    key={s.id}
                    className={isSelected ? "saved-list-selected-row" : undefined}
                  >
                    <td className="saved-list-select-cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(s.id, e.target.checked)}
                        disabled={Boolean(editingId) || bulkBusy}
                        aria-label={`Select ${s.courseCode}`}
                      />
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="saved-subjects-code-edit">
                          <input
                            className="table-input"
                            value={editDraft?.courseCode ?? ""}
                            onChange={(e) =>
                              setEditDraft((d) => d && { ...d, courseCode: e.target.value })
                            }
                            aria-invalid={editCourseCodeDuplicate && editingId === s.id ? true : undefined}
                          />
                          {editCourseCodeDuplicate && editingId === s.id && (
                            <span className="field-hint field-hint-error" role="alert">
                              {duplicateCourseCodeMessage(editCourseCodeDuplicate)}
                            </span>
                          )}
                        </div>
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
      {passwordPrompt ? (
        <PasswordConfirmDialog
          title={passwordPrompt.title}
          message={passwordPrompt.message}
          confirmLabel="Delete all"
          onComplete={(password) => {
            const prompt = passwordPrompt;
            setPasswordPrompt(null);
            if (password) {
              prompt.onConfirm(password).catch(() => {});
            }
          }}
        />
      ) : null}
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
