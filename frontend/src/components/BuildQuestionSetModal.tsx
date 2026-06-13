import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { curriculumYearForStudentYear, parseYearLevel, sanitizeYearInput } from "../lib/constants";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
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
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

interface ConfigRow {
  key: string;
  subjectId: string;
  topicId: string | null;
  label: string;
  itemCount: string;
  easyCount: string;
  mediumCount: string;
  hardCount: string;
}

interface Props {
  subjects: Subject[];
  topics: Topic[];
  token: string | null;
  onClose: () => void;
  onCreated: (message: string) => void;
}

function rowsForSubject(subject: Subject, subjectTopics: Topic[]): ConfigRow[] {
  if (subjectTopics.length === 0) {
    return [
      {
        key: `${subject.id}:all`,
        subjectId: subject.id,
        topicId: null,
        label: "Whole subject",
        itemCount: "",
        easyCount: "",
        mediumCount: "",
        hardCount: "",
      },
    ];
  }

  return subjectTopics.map((topic) => ({
    key: `${subject.id}:${topic.id}`,
    subjectId: subject.id,
    topicId: topic.id,
    label: topic.name,
    itemCount: "",
    easyCount: "",
    mediumCount: "",
    hardCount: "",
  }));
}

function countNum(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function sanitizeCountInput(value: string) {
  return value.replace(/\D/g, "");
}

function rowSubtotal(row: ConfigRow) {
  return countNum(row.easyCount) + countNum(row.mediumCount) + countNum(row.hardCount);
}

function rowItemCount(row: ConfigRow) {
  return countNum(row.itemCount);
}

function rowRemaining(row: ConfigRow) {
  return rowItemCount(row) - rowSubtotal(row);
}

export default function BuildQuestionSetModal({
  subjects,
  topics,
  token,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [yearLevel, setYearLevel] = useState("2");
  const [type, setType] = useState<"DIAGNOSTIC" | "RETAKE">("DIAGNOSTIC");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addSubjectId, setAddSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  useEffect(() => {
    api<{ questions: Question[] }>("/questions", {}, token)
      .then((data) => setQuestions(data.questions))
      .catch(() => setQuestions([]));
  }, [token]);

  const parsedStudentYear = parseYearLevel(yearLevel);
  const curriculumYear = curriculumYearForStudentYear(parsedStudentYear);
  const curriculumSubjects = useMemo(
    () => subjects.filter((s) => s.yearLevel === curriculumYear),
    [subjects, curriculumYear]
  );

  useEffect(() => {
    if (!yearLevel.trim()) return;

    const allowedSubjectIds = new Set(curriculumSubjects.map((s) => s.id));

    setSelectedSubjectIds((prev) => prev.filter((id) => allowedSubjectIds.has(id)));
    setRows((prev) => prev.filter((row) => allowedSubjectIds.has(row.subjectId)));
    setAddSubjectId("");
  }, [curriculumYear, curriculumSubjects, yearLevel]);

  const totalItems = rows.reduce((sum, row) => sum + rowSubtotal(row), 0);
  const targetItems = rows.reduce((sum, row) => sum + rowItemCount(row), 0);
  const remainingItems = targetItems - totalItems;

  function poolCount(subjectId: string, topicId: string | null, difficulty: string) {
    return questions.filter((q) => {
      if (q.subjectId !== subjectId || q.difficulty !== difficulty) return false;
      if (topicId) return q.topicId === topicId;
      return true;
    }).length;
  }

  function addSubject() {
    if (!addSubjectId || selectedSubjectIds.includes(addSubjectId)) return;

    const subject = subjects.find((s) => s.id === addSubjectId);
    if (!subject) return;

    if (subject.yearLevel !== curriculumYear) {
      setError(
        `Only curriculum year ${curriculumYear} subjects can be added for student year ${parsedStudentYear}.`
      );
      return;
    }

    const subjectTopics = topics.filter((t) => t.subjectId === addSubjectId);
    setSelectedSubjectIds((prev) => [...prev, addSubjectId]);
    setRows((prev) => [...prev, ...rowsForSubject(subject, subjectTopics)]);
    setAddSubjectId("");
    setError("");
  }

  function removeSubject(subjectId: string) {
    setSelectedSubjectIds((prev) => prev.filter((id) => id !== subjectId));
    setRows((prev) => prev.filter((row) => row.subjectId !== subjectId));
  }

  function updateRow(key: string, patch: Partial<ConfigRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function poolValidationError(row: ConfigRow): string | null {
    if (rowSubtotal(row) === 0) return null;

    const easy = countNum(row.easyCount);
    const medium = countNum(row.mediumCount);
    const hard = countNum(row.hardCount);
    const availEasy = poolCount(row.subjectId, row.topicId, "EASY");
    const availMedium = poolCount(row.subjectId, row.topicId, "MEDIUM");
    const availHard = poolCount(row.subjectId, row.topicId, "HARD");

    if (easy > availEasy) {
      return `${row.label}: easy count (${easy}) exceeds available pool (${availEasy}).`;
    }
    if (medium > availMedium) {
      return `${row.label}: medium count (${medium}) exceeds available pool (${availMedium}).`;
    }
    if (hard > availHard) {
      return `${row.label}: hard count (${hard}) exceeds available pool (${availHard}).`;
    }

    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Set name is required.");
      return;
    }

    if (rows.length === 0) {
      setError("Add at least one subject and assign difficulty counts.");
      return;
    }

    if (totalItems <= 0) {
      setError("Assign at least one question across topics.");
      return;
    }

    const incompleteRows = rows.filter((row) => rowItemCount(row) > 0 && rowRemaining(row) !== 0);
    if (incompleteRows.length > 0) {
      setError("Each topic with an item target must have its remaining count at 0.");
      return;
    }

    if (targetItems > 0 && remainingItems !== 0) {
      setError("Assigned items must match the total item targets.");
      return;
    }

    const mismatchedSubject = groupedSubjects.find((s) => s.yearLevel !== curriculumYear);
    if (mismatchedSubject) {
      setError(
        `${mismatchedSubject.courseCode} belongs to curriculum year ${mismatchedSubject.yearLevel}, not year ${curriculumYear}. Remove it or change student year level.`
      );
      return;
    }

    const poolError = rows.map(poolValidationError).find(Boolean);
    if (poolError) {
      setError(poolError);
      return;
    }

    const configs = rows
      .filter((row) => rowSubtotal(row) > 0)
      .map((row) => ({
        subjectId: row.subjectId,
        topicId: row.topicId,
        easyCount: countNum(row.easyCount),
        mediumCount: countNum(row.mediumCount),
        hardCount: countNum(row.hardCount),
      }));

    if (configs.length === 0) {
      setError("Assign at least one question across topics.");
      return;
    }

    setSaving(true);
    try {
      await api(
        "/question-sets",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            yearLevel: parsedStudentYear,
            type,
            totalItems,
            configs,
          }),
        },
        token
      );
      onCreated("Question set created.");
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create question set");
    } finally {
      setSaving(false);
    }
  }

  const groupedSubjects = selectedSubjectIds
    .map((id) => subjects.find((s) => s.id === id))
    .filter(Boolean) as Subject[];

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("build-set-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Build Question Set</h2>
            <p className="muted">
              Set item targets per topic, then split them across easy, medium, and hard.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="build-set-meta">
            <label className="build-set-meta-name">
              Set name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Incoming 2nd Year Comprehensive 2026"
                required
              />
            </label>
            <label className="build-set-meta-year">
              Student year level
              <input
                type="text"
                inputMode="numeric"
                placeholder="2"
                value={yearLevel}
                onChange={(e) => setYearLevel(sanitizeYearInput(e.target.value))}
                onBlur={() => setYearLevel(String(parseYearLevel(yearLevel)))}
                required
              />
            </label>
            <span className="field-hint build-set-meta-hint">
              Uses curriculum year {curriculumYear} subjects when available.
            </span>
            <label className="build-set-meta-type">
              Exam type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "DIAGNOSTIC" | "RETAKE")}
              >
                <option value="DIAGNOSTIC">Comprehensive</option>
                <option value="RETAKE">Retake</option>
              </select>
            </label>
          </div>

          <div className="build-set-add-subject">
            <label>
              Add subject
              <select
                value={addSubjectId}
                onChange={(e) => setAddSubjectId(e.target.value)}
              >
                <option value="">Select a subject</option>
                {curriculumSubjects
                  .filter((s) => !selectedSubjectIds.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.courseCode} — {s.courseTitle}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="btn secondary"
              onClick={addSubject}
              disabled={curriculumSubjects.length === 0}
            >
              Add subject
            </button>
          </div>

          {curriculumSubjects.length === 0 && (
            <p className="muted">
              No subjects found for curriculum year {curriculumYear}. Add subjects for this year in
              Setup first.
            </p>
          )}

          {groupedSubjects.length === 0 ? (
            <p className="muted">Add subjects to configure topic difficulty counts.</p>
          ) : (
            groupedSubjects.map((subject) => {
              const subjectRows = rows.filter((row) => row.subjectId === subject.id);

              return (
                <div key={subject.id} className="build-set-subject card">
                  <div className="build-set-subject-header">
                    <h3>
                      {subject.courseCode} — {subject.courseTitle}
                    </h3>
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      onClick={() => removeSubject(subject.id)}
                    >
                      Remove subject
                    </button>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th className="build-set-topic-col">Topic</th>
                        <th>Items</th>
                        <th>Easy</th>
                        <th>Medium</th>
                        <th>Hard</th>
                        <th>Subtotal</th>
                        <th>Remaining</th>
                        <th>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectRows.map((row) => {
                        const subtotal = rowSubtotal(row);
                        const remaining = rowRemaining(row);
                        const availEasy = poolCount(row.subjectId, row.topicId, "EASY");
                        const availMedium = poolCount(row.subjectId, row.topicId, "MEDIUM");
                        const availHard = poolCount(row.subjectId, row.topicId, "HARD");
                        const remainingClass =
                          rowItemCount(row) <= 0
                            ? "counter-neutral"
                            : remaining === 0
                              ? "counter-done"
                              : remaining < 0
                                ? "counter-over"
                                : "counter-pending";

                        return (
                          <tr key={row.key}>
                            <td className="build-set-topic-col">{row.label}</td>
                            <td>
                              <input
                                className="table-input table-input-narrow"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={row.itemCount}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    itemCount: sanitizeCountInput(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="table-input table-input-narrow"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={row.easyCount}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    easyCount: sanitizeCountInput(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="table-input table-input-narrow"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={row.mediumCount}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    mediumCount: sanitizeCountInput(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="table-input table-input-narrow"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={row.hardCount}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    hardCount: sanitizeCountInput(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>{subtotal}</td>
                            <td className={remainingClass}>
                              {rowItemCount(row) > 0 ? remaining : "—"}
                            </td>
                            <td className="muted">
                              {availEasy} / {availMedium} / {availHard}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}

          <div className="build-set-summary">
            <div className="build-set-summary-row">
              <strong>Target items:</strong>
              <span>{targetItems > 0 ? targetItems : "—"}</span>
            </div>
            <div className="build-set-summary-row">
              <strong>Assigned:</strong>
              <span>{totalItems}</span>
            </div>
            <div className="build-set-summary-row">
              <strong>Remaining:</strong>
              <span
                className={
                  targetItems <= 0
                    ? "counter-neutral"
                    : remainingItems === 0
                      ? "counter-done"
                      : remainingItems < 0
                        ? "counter-over"
                        : "counter-pending"
                }
              >
                {targetItems > 0 ? remainingItems : "—"}
              </span>
            </div>
            <span className="field-hint">
              Set item targets per topic; remaining counts down as you assign difficulties.
            </span>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : "Save question set"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
