import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import {
  BLOOM_LEVEL_LABELS,
  bloomOptionsForDifficulty,
  defaultBloomLevelForDifficulty,
} from "../lib/bloomLevel";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { toastDeleted, toastUpdated, truncateLabel } from "../lib/toastMessages";
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
  _count?: { questions: number };
}

interface Topic {
  id: string;
  name: string;
  subjectId: string;
}

interface Question {
  id: string;
  subjectId: string;
  topicId: string | null;
  difficulty: string;
  bloomLevel: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  imagePath: string | null;
  topic?: { name: string } | null;
}

interface QuestionEditDraft {
  difficulty: string;
  bloomLevel: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  image: File | null;
  imagePreview: string | null;
  removeImage: boolean;
}

interface Props {
  subjects: Subject[];
  topics: Topic[];
  token: string | null;
  onClose?: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  inline?: boolean;
}

function truncate(text: string, max = 96) {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function formatDifficulty(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

type YearLevelFilter = "ALL" | "1" | "2" | "3" | "4";

export default function SavedQuestionsModal({
  subjects,
  topics,
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
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionEditDraft | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(
    onClose ?? (() => {}),
    !inline
  );

  const cancelEdit = useCallback(() => {
    setEditDraft((draft) => {
      if (draft?.imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(draft.imagePreview);
      }
      return null;
    });
    setEditingId(null);
  }, []);

  const {
    requestClose: requestCloseEdit,
    overlayClass: editOverlayClass,
    panelClass: editPanelClass,
    portal: editPortal,
  } = useAnimatedModal(cancelEdit, Boolean(editingId && editDraft));

  const totalQuestions = useMemo(
    () => subjects.reduce((sum, subject) => sum + (subject._count?.questions ?? 0), 0),
    [subjects]
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

  const filteredTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === selectedSubjectId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [topics, selectedSubjectId]
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
    setSelectedTopicId("");
    cancelEdit();
  }

  async function loadQuestions() {
    if (!selectedSubjectId) {
      setQuestions([]);
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ subjectId: selectedSubjectId });
      if (selectedTopicId === "none") {
        params.set("topicId", "");
      } else if (selectedTopicId) {
        params.set("topicId", selectedTopicId);
      }

      const data = await api<{ questions: Question[] }>(`/questions?${params}`, {}, token);
      setQuestions(data.questions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load questions";
      onUpdated(message, true);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions().catch(() => {});
  }, [selectedSubjectId, selectedTopicId, token]);

  const questionsResetKey = `${programFilter}-${yearFilter}-${selectedSubjectId}-${selectedTopicId}`;
  const {
    paginatedItems: paginatedQuestions,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(questions, { resetKey: questionsResetKey });

  const selectedQuestions = useMemo(
    () => questions.filter((question) => selectedIds.has(question.id)),
    [questions, selectedIds]
  );

  const selectedCount = selectedQuestions.length;
  const pageQuestionIds = useMemo(
    () => paginatedQuestions.map((question) => question.id),
    [paginatedQuestions]
  );
  const allPageSelected =
    pageQuestionIds.length > 0 && pageQuestionIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    !allPageSelected && pageQuestionIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
    cancelEdit();
  }, [questionsResetKey, cancelEdit]);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelect(questionId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }

  function toggleSelectAll(questionIds: string[], selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const questionId of questionIds) {
        if (selected) next.add(questionId);
        else next.delete(questionId);
      }
      return next;
    });
  }

  function handleToolbarEdit() {
    if (selectedQuestions.length !== 1) return;
    startEdit(selectedQuestions[0]);
  }

  function handleQuestionRowClick(questionId: string, isSelected: boolean) {
    if (editingId || bulkBusy) return;
    toggleSelect(questionId, !isSelected);
  }

  function startEdit(question: Question) {
    if (editDraft?.imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editDraft.imagePreview);
    }
    setEditingId(question.id);
    setEditDraft({
      difficulty: question.difficulty,
      bloomLevel: question.bloomLevel,
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOption: question.correctOption,
      image: null,
      imagePreview: question.imagePath ? `/uploads/${question.imagePath}` : null,
      removeImage: false,
    });
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    if (!editDraft) return;
    const file = e.target.files?.[0];

    if (editDraft.imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editDraft.imagePreview);
    }

    if (!file) {
      setEditDraft({
        ...editDraft,
        image: null,
        imagePreview: null,
        removeImage: true,
      });
      return;
    }

    setEditDraft({
      ...editDraft,
      image: file,
      imagePreview: URL.createObjectURL(file),
      removeImage: false,
    });
  }

  function removeExistingImage() {
    if (!editDraft) return;
    if (editDraft.imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editDraft.imagePreview);
    }
    setEditDraft({
      ...editDraft,
      image: null,
      imagePreview: null,
      removeImage: true,
    });
  }

  async function saveEdit(id: string, question: Question) {
    if (!editDraft) return;

    setSavingId(id);

    const formData = new FormData();
    formData.append("subjectId", question.subjectId);
    formData.append("topicId", question.topicId ?? "");
    formData.append("difficulty", editDraft.difficulty);
    formData.append("bloomLevel", editDraft.bloomLevel);
    formData.append("text", editDraft.text.trim());
    formData.append("optionA", editDraft.optionA.trim());
    formData.append("optionB", editDraft.optionB.trim());
    formData.append("optionC", editDraft.optionC.trim());
    formData.append("optionD", editDraft.optionD.trim());
    formData.append("correctOption", editDraft.correctOption);
    if (editDraft.removeImage) formData.append("removeImage", "true");
    if (editDraft.image) formData.append("image", editDraft.image);

    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update question");

      const message = toastUpdated("question", truncateLabel(question.text));
      cancelEdit();
      clearSelection();
      onUpdated(message, false);
      await loadQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update question";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSelectedQuestions() {
    if (selectedQuestions.length === 0) return;

    const preview =
      selectedQuestions.length === 1
        ? `"${truncate(selectedQuestions[0].text, 120)}"`
        : `${selectedQuestions.length} selected questions`;

    const confirmed = await confirm({
      title: selectedQuestions.length === 1 ? "Delete question?" : "Delete selected questions?",
      message: `Delete ${preview}?\n\nThis cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setBulkBusy(true);
    if (editingId && selectedIds.has(editingId)) cancelEdit();

    let deleted = 0;
    const failed: string[] = [];

    for (const question of selectedQuestions) {
      try {
        await api(`/questions/${question.id}`, { method: "DELETE" }, token);
        deleted += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete question";
        failed.push(message);
      }
    }

    if (deleted > 0) {
      const message =
        deleted === 1
          ? toastDeleted("question", truncateLabel(selectedQuestions[0].text, 120))
          : `Deleted ${deleted} question${deleted === 1 ? "" : "s"}.`;
      onUpdated(message, false);
      clearSelection();
      await loadQuestions();
    }

    if (failed.length > 0) {
      onUpdated(
        failed.length === selectedQuestions.length
          ? failed[0]
          : `${failed.length} question(s) could not be deleted. ${failed[0]}`,
        true
      );
    }

    setBulkBusy(false);
  }

  const selectedSubject = courseSubjects.find((s) => s.id === selectedSubjectId);
  const editingQuestion = useMemo(
    () => questions.find((question) => question.id === editingId) ?? null,
    [questions, editingId]
  );

  function renderEditForm() {
    if (!editDraft) return null;

    return (
      <div className="saved-questions-edit-form encoder-form-grid">
        <div className="encoder-question-meta-row encoder-field-full">
          <label>
            Difficulty
            <select
              value={editDraft.difficulty}
              onChange={(e) => {
                const difficulty = e.target.value;
                setEditDraft({
                  ...editDraft,
                  difficulty,
                  bloomLevel: defaultBloomLevelForDifficulty(difficulty),
                });
              }}
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </label>
          <label>
            Domain
            <select
              value={editDraft.bloomLevel}
              onChange={(e) => setEditDraft({ ...editDraft, bloomLevel: e.target.value })}
            >
              {bloomOptionsForDifficulty(editDraft.difficulty).map((level) => (
                <option key={level} value={level}>
                  {BLOOM_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Correct answer
            <select
              value={editDraft.correctOption}
              onChange={(e) =>
                setEditDraft({
                  ...editDraft,
                  correctOption: e.target.value,
                })
              }
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </label>
        </div>
        <label className="encoder-field-full">
          Question
          <textarea
            value={editDraft.text}
            onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })}
          />
        </label>
        <label>
          Option A
          <input
            value={editDraft.optionA}
            onChange={(e) => setEditDraft({ ...editDraft, optionA: e.target.value })}
          />
        </label>
        <label>
          Option B
          <input
            value={editDraft.optionB}
            onChange={(e) => setEditDraft({ ...editDraft, optionB: e.target.value })}
          />
        </label>
        <label>
          Option C
          <input
            value={editDraft.optionC}
            onChange={(e) => setEditDraft({ ...editDraft, optionC: e.target.value })}
          />
        </label>
        <label>
          Option D
          <input
            value={editDraft.optionD}
            onChange={(e) => setEditDraft({ ...editDraft, optionD: e.target.value })}
          />
        </label>
        <label className="encoder-field-full">
          Replace image (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageChange}
          />
        </label>
        {editDraft.imagePreview && (
          <div className="image-preview-block encoder-field-full">
            <img src={editDraft.imagePreview} alt="Question" className="image-preview" />
            <button type="button" className="btn secondary btn-sm" onClick={removeExistingImage}>
              Remove image
            </button>
          </div>
        )}
      </div>
    );
  }

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Saved Questions</h2>
        </div>
        <div className="saved-panel-header-end">
          <span className="muted saved-panel-count">
            {totalQuestions} question{totalQuestions === 1 ? "" : "s"} across{" "}
            {subjects.length} subject{subjects.length === 1 ? "" : "s"}
          </span>
          {!inline && (
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>

        {sortedSubjects.length === 0 ? (
          <p className="muted">No subjects yet. Add a subject from the Setup tab first.</p>
        ) : (
          <div className="saved-questions-filters">
            <label className="saved-questions-filter">
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
            <label className="saved-questions-filter">
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
            <label className="saved-questions-filter">
              Subject
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                disabled={courseSubjects.length === 0}
              >
                {courseSubjects.length === 0 ? (
                  <option value="">No subjects for these filters</option>
                ) : (
                  courseSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.courseCode} — {subject.courseTitle}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="saved-questions-filter">
              Topic filter
              <select
                value={selectedTopicId}
                onChange={(e) => {
                  setSelectedTopicId(e.target.value);
                  cancelEdit();
                }}
                disabled={!selectedSubjectId}
              >
                <option value="">All topics</option>
                <option value="none">No topic (subject only)</option>
                {filteredTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {subjects.length > 0 && selectedSubject && (
          <>
            <div className="saved-questions-subject-heading">
              <strong>
                {selectedSubject.courseCode} — {selectedSubject.courseTitle}
              </strong>
            </div>

            {loading ? (
              <p className="muted saved-questions-empty">Loading questions…</p>
            ) : questions.length === 0 ? (
              <p className="muted saved-questions-empty">
                No questions found for this filter. Encode questions from the Encode tab.
              </p>
            ) : (
              <>
                <div className="saved-list-bulk-panel card">
                  <span className="muted saved-list-selection-count">
                    {selectedCount > 0
                      ? `${selectedCount} selected`
                      : `${questions.length} question${questions.length === 1 ? "" : "s"} shown`}
                  </span>
                  <div className="saved-list-bulk-actions">
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      disabled={selectedCount !== 1 || bulkBusy || Boolean(editingId)}
                      onClick={handleToolbarEdit}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger btn-sm"
                      disabled={selectedCount === 0 || bulkBusy || Boolean(editingId)}
                      onClick={() => deleteSelectedQuestions().catch(() => {})}
                    >
                      {bulkBusy ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                <ListPanel
                  rowHeight="tall"
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
                <div className="modal-table-wrap saved-questions-table-wrap">
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
                          onChange={(e) => toggleSelectAll(pageQuestionIds, e.target.checked)}
                          disabled={Boolean(editingId) || bulkBusy}
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th>Difficulty</th>
                      <th>Topic</th>
                      <th className="saved-questions-text-col">Question</th>
                      <th>Answer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.map((question) => {
                      const isSelected = selectedIds.has(question.id);

                      return (
                      <tr
                        key={question.id}
                        className={[
                          isSelected ? "saved-list-selected-row" : undefined,
                          editingId === question.id ? "saved-questions-row-active" : undefined,
                          !editingId && !bulkBusy ? "saved-list-clickable-row" : undefined,
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined}
                        onClick={() => handleQuestionRowClick(question.id, isSelected)}
                      >
                        <td
                          className="saved-list-select-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelect(question.id, e.target.checked)}
                            disabled={Boolean(editingId) || bulkBusy}
                            aria-label={`Select question ${truncate(question.text, 48)}`}
                          />
                        </td>
                        <td>
                          <span
                            className={`difficulty-badge ${question.difficulty.toLowerCase()}`}
                          >
                            {formatDifficulty(question.difficulty)}
                          </span>
                        </td>
                        <td className="saved-questions-topic-col">
                          {question.topic?.name ?? "—"}
                        </td>
                        <td className="saved-questions-text-col">
                          <span className="saved-questions-preview" title={question.text}>
                            {question.text}
                          </span>
                          {question.imagePath && (
                            <span className="saved-questions-image-tag">Image</span>
                          )}
                        </td>
                        <td className="saved-questions-answer-col">{question.correctOption}</td>
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

  const editModal =
    editingId && editDraft && editingQuestion
      ? editPortal(
          <div
            className={`${editOverlayClass} saved-question-edit-overlay`}
            onClick={requestCloseEdit}
          >
            <div
              className={editPanelClass("saved-question-edit-modal")}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="saved-question-edit-title"
            >
              <div className="modal-header">
                <div>
                  <h2 id="saved-question-edit-title">Edit question</h2>
                </div>
                <button type="button" className="btn secondary" onClick={requestCloseEdit}>
                  Close
                </button>
              </div>
              <div className="modal-scroll-area">{renderEditForm()}</div>
              <div className="modal-footer">
                <button type="button" className="btn secondary" onClick={requestCloseEdit}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={savingId === editingId}
                  onClick={() => void saveEdit(editingQuestion.id, editingQuestion)}
                >
                  {savingId === editingId ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )
      : null;

  if (inline) {
    return (
      <>
        <section className="card saved-panel saved-questions-modal">{panel}</section>
        {editModal}
      </>
    );
  }

  return (
    <>
      {portal(
        <div className={overlayClass} onClick={requestClose}>
          <div className={panelClass("saved-questions-modal")} onClick={(e) => e.stopPropagation()}>
            {panel}
          </div>
        </div>
      )}
      {editModal}
    </>
  );
}
