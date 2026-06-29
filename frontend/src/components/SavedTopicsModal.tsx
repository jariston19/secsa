import { useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import { api } from "../lib/api";
import { formatBulkDeleteMessage } from "../lib/bulkDeleteMessage";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { toastUpdated } from "../lib/toastMessages";
import {
  subjectHasProgram,
  type ProgramCourseFilter,
  type ProgramCourseId,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { useConfirm } from "../lib/confirm";
import { matchesSubjectSearch, matchesTopicSearch } from "../lib/savedListSearch";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    title: string;
    message: string;
    onConfirm: (password: string) => Promise<void>;
  } | null>(null);
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

  const programLabelById = useMemo(
    () => Object.fromEntries(programCourseOptions.map((course) => [course.id, course.label])),
    [programCourseOptions]
  );

  const filterMatchedSubjects = useMemo(
    () =>
      sortedSubjects.filter((subject) => {
        const programMatch =
          programFilter === "ALL" || subjectHasProgram(subject.programCourses, programFilter);
        const yearMatch = yearFilter === "ALL" || subject.yearLevel === Number(yearFilter);
        return programMatch && yearMatch;
      }),
    [sortedSubjects, programFilter, yearFilter]
  );

  const courseSubjects = useMemo(
    () =>
      filterMatchedSubjects.filter((subject) =>
        matchesSubjectSearch(subject, searchQuery, programLabelById)
      ),
    [filterMatchedSubjects, searchQuery, programLabelById]
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

  const subjectMatchedTopics = useMemo(
    () =>
      topics
        .filter((topic) => topic.subjectId === selectedSubjectId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [topics, selectedSubjectId]
  );

  const filteredTopics = useMemo(
    () => subjectMatchedTopics.filter((topic) => matchesTopicSearch(topic, searchQuery)),
    [subjectMatchedTopics, searchQuery]
  );

  const topicsResetKey = `${programFilter}-${yearFilter}-${selectedSubjectId}-${searchQuery}`;
  const {
    paginatedItems: paginatedTopics,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredTopics, { resetKey: topicsResetKey });

  const selectedTopics = useMemo(
    () => filteredTopics.filter((topic) => selectedIds.has(topic.id)),
    [filteredTopics, selectedIds]
  );

  const selectedCount = selectedTopics.length;
  const pageTopicIds = useMemo(() => paginatedTopics.map((topic) => topic.id), [paginatedTopics]);
  const allPageSelected =
    pageTopicIds.length > 0 && pageTopicIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    !allPageSelected && pageTopicIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
    cancelEdit();
  }, [programFilter, yearFilter, selectedSubjectId, searchQuery]);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelect(topicId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(topicId);
      else next.delete(topicId);
      return next;
    });
  }

  function toggleSelectAll(topicIds: string[], selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const topicId of topicIds) {
        if (selected) next.add(topicId);
        else next.delete(topicId);
      }
      return next;
    });
  }

  function handleToolbarEdit() {
    if (selectedTopics.length !== 1) return;
    startEdit(selectedTopics[0]);
  }

  function handleProgramFilterChange(value: ProgramCourseFilter) {
    setProgramFilter(value);
  }

  function handleYearFilterChange(value: YearLevelFilter) {
    setYearFilter(value);
  }

  function handleSubjectChange(subjectId: string) {
    setSelectedSubjectId(subjectId);
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
      clearSelection();
      onUpdated(message, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update topic";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSelectedTopics() {
    if (selectedTopics.length === 0) return;

    const questionCount = selectedTopics.reduce(
      (sum, topic) => sum + (topic._count?.questions ?? 0),
      0
    );

    const preview =
      selectedTopics.length === 1
        ? `"${selectedTopics[0].name}"`
        : `${selectedTopics.length} selected topics`;

    const confirmed = await confirm({
      title: selectedTopics.length === 1 ? "Delete topic?" : "Delete selected topics?",
      message: `Delete ${preview}?\n\nThis will also remove ${questionCount} question(s). This cannot be undone.`,
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
        "/topics/bulk-delete",
        {
          method: "POST",
          body: JSON.stringify({ ids: selectedTopics.map((topic) => topic.id) }),
        },
        token
      );

      onUpdated(
        formatBulkDeleteMessage("topic", result),
        Boolean(result.failed?.length)
      );
      clearSelection();
      cancelEdit();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete topics";
      onUpdated(message, true);
    } finally {
      setBulkBusy(false);
    }
  }

  function requestDeleteAllForSubject() {
    if (!selectedSubjectId || filteredTopics.length === 0) return;

    const subjectLabel = selectedSubject
      ? `${selectedSubject.courseCode} — ${selectedSubject.courseTitle}`
      : "this subject";

    setPasswordPrompt({
      title: "Delete all topics?",
      message: `Delete ${filteredTopics.length} topic(s) under ${subjectLabel}${searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}?\n\nThis removes their questions. Enter your password to confirm.`,
      onConfirm: async (password) => {
        setBulkBusy(true);
        try {
          const result = await api<{
            deleted: number;
            archivedSets: number;
            failed: Array<{ id: string; error: string }>;
          }>(
            "/topics/delete-all",
            {
              method: "POST",
              body: JSON.stringify({
                password,
                subjectId: selectedSubjectId,
                ids: filteredTopics.map((topic) => topic.id),
              }),
            },
            token
          );

          onUpdated(
            formatBulkDeleteMessage("topic", result, subjectLabel),
            Boolean(result.failed?.length)
          );
          clearSelection();
          cancelEdit();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete topics";
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
          <h2>Saved Topics</h2>
          <p className="muted section-desc">
            Filter by program course and year level, then select a subject. Search subjects or topic names. Use checkboxes to edit or delete.
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
          <label className="saved-list-search saved-list-search-wide">
            Search
            <input
              type="search"
              placeholder="Subject or topic name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
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
            <p className="muted">
              {searchQuery.trim()
                ? "No topics match your search for this subject."
                : "No topics for this subject yet. Add one from the Setup tab."}
            </p>
          ) : (
            <>
            <div className="saved-list-bulk-panel card">
              <span className="muted saved-list-selection-count">
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : searchQuery.trim()
                    ? `${filteredTopics.length} of ${subjectMatchedTopics.length} topic${subjectMatchedTopics.length === 1 ? "" : "s"}`
                    : `${filteredTopics.length} topic${filteredTopics.length === 1 ? "" : "s"} shown`}
              </span>
              <div className="saved-list-bulk-actions">
                {editingId ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={savingId === editingId || !editName.trim()}
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
                      onClick={() => deleteSelectedTopics().catch(() => {})}
                    >
                      {bulkBusy ? "Deleting..." : "Delete selected"}
                    </button>
                    <button
                      type="button"
                      className="btn danger btn-sm"
                      disabled={filteredTopics.length === 0 || bulkBusy}
                      onClick={requestDeleteAllForSubject}
                    >
                      Delete all shown
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
                      onChange={(e) => toggleSelectAll(pageTopicIds, e.target.checked)}
                      disabled={Boolean(editingId) || bulkBusy}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className="saved-topics-name-col">Topic name</th>
                  <th>Year</th>
                  <th>Questions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTopics.map((t) => {
                  const isEditing = editingId === t.id;
                  const isSelected = selectedIds.has(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={isSelected ? "saved-list-selected-row" : undefined}
                    >
                      <td className="saved-list-select-cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelect(t.id, e.target.checked)}
                          disabled={Boolean(editingId) || bulkBusy}
                          aria-label={`Select ${t.name}`}
                        />
                      </td>
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
