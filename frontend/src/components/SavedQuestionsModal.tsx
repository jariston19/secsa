import { ChangeEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import {
  BLOOM_LEVEL_LABELS,
  bloomOptionsForDifficulty,
  defaultBloomLevelForDifficulty,
  type BloomLevelId,
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionEditDraft | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose ?? (() => {}));

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

  function cancelEdit() {
    if (editDraft?.imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editDraft.imagePreview);
    }
    setEditingId(null);
    setEditDraft(null);
  }

  function startEdit(question: Question) {
    cancelEdit();
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
      onUpdated(message, false);
      await loadQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update question";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteQuestion(id: string, preview: string) {
    const confirmed = await confirm({
      title: "Delete question?",
      message: `Delete this question?\n\n"${truncate(preview, 120)}"\n\nThis cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingId(id);
    if (editingId === id) cancelEdit();

    try {
      await api(`/questions/${id}`, { method: "DELETE" }, token);
      const message = toastDeleted("question", truncateLabel(preview, 120));
      onUpdated(message, false);
      await loadQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete question";
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  const selectedSubject = courseSubjects.find((s) => s.id === selectedSubjectId);

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Saved Questions</h2>
          <p className="muted section-desc">
            Filter by program course and year level, then select a subject and optional topic to
            browse, edit, or delete encoded questions.
          </p>
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
                      <th>Difficulty</th>
                      <th>Topic</th>
                      <th className="saved-questions-text-col">Question</th>
                      <th>Answer</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.map((question) => {
                      const isEditing = editingId === question.id;

                      return (
                        <Fragment key={question.id}>
                          <tr className={isEditing ? "saved-questions-row-active" : undefined}>
                            <td>
                              <span
                                className={`difficulty-badge ${question.difficulty.toLowerCase()}`}
                              >
                                {formatDifficulty(question.difficulty)}
                              </span>
                              <span className="muted saved-questions-bloom-tag">
                                {BLOOM_LEVEL_LABELS[question.bloomLevel as BloomLevelId] ??
                                  question.bloomLevel}
                              </span>
                            </td>
                            <td className="saved-questions-topic-col">
                              {question.topic?.name ?? "—"}
                            </td>
                            <td className="saved-questions-text-col">
                              <span className="saved-questions-preview">{truncate(question.text)}</span>
                              {question.imagePath && (
                                <span className="saved-questions-image-tag">Image</span>
                              )}
                            </td>
                            <td className="saved-questions-answer-col">{question.correctOption}</td>
                            <td>
                              <div className="action-buttons">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      disabled={savingId === question.id}
                                      onClick={() => saveEdit(question.id, question)}
                                    >
                                      {savingId === question.id ? "Saving..." : "Save"}
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
                                      onClick={() => startEdit(question)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn danger btn-sm"
                                      disabled={deletingId === question.id}
                                      onClick={() => deleteQuestion(question.id, question.text)}
                                    >
                                      {deletingId === question.id ? "Deleting..." : "Delete"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isEditing && editDraft && (
                            <tr className="saved-questions-edit-row">
                              <td colSpan={5}>
                                <div className="saved-questions-edit-card">
                                  <div className="saved-questions-edit-header">
                                    <h3>Edit question</h3>
                                  </div>
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
                                          onChange={(e) =>
                                            setEditDraft({ ...editDraft, bloomLevel: e.target.value })
                                          }
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
                                        onChange={(e) =>
                                          setEditDraft({ ...editDraft, text: e.target.value })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Option A
                                      <input
                                        value={editDraft.optionA}
                                        onChange={(e) =>
                                          setEditDraft({ ...editDraft, optionA: e.target.value })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Option B
                                      <input
                                        value={editDraft.optionB}
                                        onChange={(e) =>
                                          setEditDraft({ ...editDraft, optionB: e.target.value })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Option C
                                      <input
                                        value={editDraft.optionC}
                                        onChange={(e) =>
                                          setEditDraft({ ...editDraft, optionC: e.target.value })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Option D
                                      <input
                                        value={editDraft.optionD}
                                        onChange={(e) =>
                                          setEditDraft({ ...editDraft, optionD: e.target.value })
                                        }
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
                                        <img
                                          src={editDraft.imagePreview}
                                          alt="Question"
                                          className="image-preview"
                                        />
                                        <button
                                          type="button"
                                          className="btn secondary btn-sm"
                                          onClick={removeExistingImage}
                                        >
                                          Remove image
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
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
    return <section className="card saved-panel saved-questions-modal">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("saved-questions-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
