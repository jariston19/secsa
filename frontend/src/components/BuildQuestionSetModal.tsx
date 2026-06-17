import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { curriculumYearForStudentYear, formatExamType, parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { toastCreated, toastUpdated } from "../lib/toastMessages";
import {
  abbreviateProgramCourse,
  formatProgramCourse,
  SHARED_DIAGNOSTIC_PROGRAM,
  subjectHasProgram,
  type ProgramCourseId,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

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
  programCourse: ProgramCourseId;
  token: string | null;
  setId?: string | null;
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
  programCourse,
  token,
  setId = null,
  onClose,
  onCreated,
}: Props) {
  const programCourseOptions = useProgramCourseOptions({ includeSharedDiagnostic: true });
  const isEditing = Boolean(setId);
  const [name, setName] = useState("");
  const [yearLevel, setYearLevel] = useState("2");
  const [setProgramCourse, setSetProgramCourse] = useState<ProgramCourseId>(programCourse);
  const [type, setType] = useState<"COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE">("COMPREHENSIVE");
  const [setStatus, setSetStatus] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addSubjectId, setAddSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(setId));
  const [timeLimitHours, setTimeLimitHours] = useState("1");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("0");
  const [passThreshold, setPassThreshold] = useState("75");
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose);

  useEffect(() => {
    if (isEditing) return;
    setSetProgramCourse(programCourse);
  }, [programCourse, isEditing]);

  useEffect(() => {
    api<{ questions: Question[] }>("/questions", {}, token)
      .then((data) => setQuestions(data.questions))
      .catch(() => setQuestions([]));
  }, [token]);

  useEffect(() => {
    if (!setId) return;

    setLoading(true);
    setError("");

    api<{
      questionSet: {
        id: string;
        name: string;
        yearLevel: number;
        programCourse: ProgramCourseId;
        type: "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE";
        status: string;
        timeLimitMinutes: number;
        passThreshold: number;
        configs: Array<{
          subjectId: string;
          topicId: string | null;
          easyCount: number;
          mediumCount: number;
          hardCount: number;
          subject: { courseCode: string; courseTitle: string };
          topic: { name: string } | null;
        }>;
      };
    }>(`/question-sets/${setId}/preview`, {}, token)
      .then((data) => {
        const set = data.questionSet;
        setName(set.name);
        setYearLevel(String(set.yearLevel));
        setSetProgramCourse(set.programCourse);
        setType(set.type);
        setSetStatus(set.status);
        setTimeLimitHours(String(Math.floor(set.timeLimitMinutes / 60)));
        setTimeLimitMinutes(String(set.timeLimitMinutes % 60));
        setPassThreshold(String(set.passThreshold));

        const subjectIds = [...new Set(set.configs.map((c) => c.subjectId))];
        const loadedRows: ConfigRow[] = set.configs.map((config) => {
          const itemTotal = config.easyCount + config.mediumCount + config.hardCount;
          return {
            key: `${config.subjectId}:${config.topicId ?? "all"}`,
            subjectId: config.subjectId,
            topicId: config.topicId,
            label: config.topic?.name ?? "Whole subject",
            itemCount: itemTotal > 0 ? String(itemTotal) : "",
            easyCount: config.easyCount > 0 ? String(config.easyCount) : "",
            mediumCount: config.mediumCount > 0 ? String(config.mediumCount) : "",
            hardCount: config.hardCount > 0 ? String(config.hardCount) : "",
          };
        });

        setSelectedSubjectIds(subjectIds);
        setRows(loadedRows);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load question set");
      })
      .finally(() => setLoading(false));
  }, [setId, token]);

  const parsedStudentYear = parseYearLevel(yearLevel);
  const curriculumYear = curriculumYearForStudentYear(parsedStudentYear);
  const isIncomingDiagnosticYear = parsedStudentYear === 1;
  const isSharedDiagnostic = type === "DIAGNOSTIC";

  useEffect(() => {
    if (isEditing) return;
    if (isIncomingDiagnosticYear) {
      setType("DIAGNOSTIC");
      return;
    }
    setType((current) => (current === "DIAGNOSTIC" ? "COMPREHENSIVE" : current));
  }, [isIncomingDiagnosticYear, isEditing]);

  useEffect(() => {
    if (isEditing || !isSharedDiagnostic) return;
    setSetProgramCourse(SHARED_DIAGNOSTIC_PROGRAM);
  }, [isSharedDiagnostic, isEditing]);

  function updateYearLevel(value: string) {
    setYearLevel(value);
  }

  function commitYearLevel() {
    const nextYear = String(parseYearLevel(yearLevel));
    setYearLevel(nextYear);
  }
  const curriculumSubjects = useMemo(
    () =>
      subjects.filter(
        (s) =>
          s.yearLevel === curriculumYear && subjectHasProgram(s.programCourses, setProgramCourse)
      ),
    [subjects, curriculumYear, setProgramCourse]
  );

  useEffect(() => {
    if (isEditing || !yearLevel.trim()) return;

    const allowedSubjectIds = new Set(curriculumSubjects.map((s) => s.id));

    setSelectedSubjectIds((prev) => prev.filter((id) => allowedSubjectIds.has(id)));
    setRows((prev) => prev.filter((row) => allowedSubjectIds.has(row.subjectId)));
    setAddSubjectId("");
  }, [curriculumYear, curriculumSubjects, yearLevel, isEditing, setProgramCourse]);

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

    if (!subjectHasProgram(subject.programCourses, setProgramCourse)) {
      setError(
        `${subject.courseCode} is not linked to ${formatProgramCourse(setProgramCourse)}.`
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

    const mismatchedCourse = groupedSubjects.find(
      (s) => !subjectHasProgram(s.programCourses, setProgramCourse)
    );
    if (mismatchedCourse) {
      setError(
        `${mismatchedCourse.courseCode} is not linked to ${formatProgramCourse(setProgramCourse)}.`
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

    const hours = Math.max(0, Number(timeLimitHours) || 0);
    const minutes = Math.max(0, Number(timeLimitMinutes) || 0);
    const timeLimitTotal = hours * 60 + minutes;
    if (timeLimitTotal < 1) {
      setError("Set a time limit of at least 1 minute.");
      return;
    }
    if (timeLimitTotal > 480) {
      setError("Time limit cannot exceed 8 hours.");
      return;
    }

    const parsedPassThreshold = Number(passThreshold);
    if (!Number.isFinite(parsedPassThreshold) || parsedPassThreshold < 0 || parsedPassThreshold > 100) {
      setError("Passing rate must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        totalItems,
        timeLimitMinutes: timeLimitTotal,
        passThreshold: parsedPassThreshold,
        configs,
      };

      if (isEditing && setId) {
        await api(`/question-sets/${setId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }, token);
        onCreated(toastUpdated("question set", name.trim()));
      } else {
        await api(
          "/question-sets",
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              yearLevel: parsedStudentYear,
              programCourse: setProgramCourse,
              type,
            }),
          },
          token
        );
        onCreated(toastCreated("question set", name.trim()));
      }
      requestClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "Failed to update question set"
            : "Failed to create question set"
      );
    } finally {
      setSaving(false);
    }
  }

  const groupedSubjects = selectedSubjectIds
    .map((id) => subjects.find((s) => s.id === id))
    .filter(Boolean) as Subject[];

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("build-set-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{isEditing ? "Edit Question Set" : "Build Question Set"}</h2>
            <p className="muted">
              {isEditing
                ? "Add subjects or adjust difficulty counts. Deployed sets stay live after saving."
                : "Set item targets per topic, then split them across easy, medium, and hard."}
            </p>
            {isEditing && setStatus === "DEPLOYED" && (
              <span className="build-set-deployed-badge">Deployed</span>
            )}
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading question set...</p>
        ) : (
        <form className="build-set-form" onSubmit={handleSubmit}>
          <div className="build-set-form-body">
          <section className="build-set-details">
            <h3 className="build-set-section-title">Set details</h3>
            <div className="build-set-meta">
              <label className="build-set-meta-name">
                <span className="build-set-field-label">Set name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Incoming 2nd Year Comprehensive 2026"
                  required
                />
              </label>
              <label className="build-set-meta-year">
                <span className="build-set-field-label">Year level</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  value={yearLevel}
                  onChange={(e) => updateYearLevel(sanitizeYearInput(e.target.value))}
                  onBlur={commitYearLevel}
                  disabled={isEditing}
                  required
                />
              </label>
              <label className="build-set-meta-course">
                <span className="build-set-field-label">Program course</span>
                <select
                  value={setProgramCourse}
                  onChange={(e) => setSetProgramCourse(e.target.value as ProgramCourseId)}
                  disabled={isEditing || isSharedDiagnostic}
                  required
                >
                  {programCourseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="build-set-meta-type">
                <span className="build-set-field-label">Exam type</span>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE")
                  }
                  disabled={isEditing || isIncomingDiagnosticYear}
                >
                  {isIncomingDiagnosticYear ? (
                    <option value="DIAGNOSTIC">Diagnostic</option>
                  ) : (
                    <>
                      <option value="COMPREHENSIVE">Comprehensive</option>
                      <option value="RETAKE">Retake</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            <div className="build-set-meta-time">
              <span className="build-set-field-label">Time limit</span>
              <div className="build-set-time-inputs">
                <label>
                  Hours
                  <input
                    type="number"
                    min={0}
                    max={8}
                    inputMode="numeric"
                    value={timeLimitHours}
                    onChange={(e) => setTimeLimitHours(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </label>
                <label>
                  Minutes
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </label>
              </div>
              <span className="field-hint">Total exam duration for students. Auto-submits when time expires.</span>
            </div>
            <div className="build-set-meta-pass">
              <span className="build-set-field-label">Passing rate</span>
              <div className="build-set-pass-input">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={passThreshold}
                  onChange={(e) => setPassThreshold(e.target.value.replace(/[^\d.]/g, ""))}
                  required
                />
                <span className="build-set-pass-suffix">%</span>
              </div>
              <span className="field-hint">Minimum score students need to pass this exam.</span>
            </div>
            <div className="build-set-details-bar">
              <span className={`build-set-exam-badge build-set-exam-badge-${type.toLowerCase()}`}>
                {formatExamType(type)}
              </span>
              <span className="build-set-details-bar-copy">
                {isIncomingDiagnosticYear
                  ? "Shared incoming diagnostic for all programs."
                  : "Comprehensive or retake exam for year levels 2–4."}
              </span>
              <span
                className="build-set-details-bar-meta"
                title={`Uses curriculum year ${curriculumYear} subjects for ${formatProgramCourse(setProgramCourse)} when available.`}
              >
                Curriculum yr {curriculumYear} · {abbreviateProgramCourse(setProgramCourse)}
              </span>
            </div>
          </section>

          <section className="build-set-subjects">
            <div className="build-set-subjects-header">
              <h3 className="build-set-section-title">Subjects</h3>
              {groupedSubjects.length > 0 && (
                <span className="build-set-subjects-count">
                  {groupedSubjects.length} subject{groupedSubjects.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

          <div className="build-set-add-subject">
            <label>
              <span className="build-set-field-label">Add subject</span>
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

          {groupedSubjects.length === 0 ? (
            <p className="build-set-empty muted">
              {curriculumSubjects.length === 0
                ? `No ${abbreviateProgramCourse(setProgramCourse)} yr ${curriculumYear} subjects in Setup.`
                : "Add a subject above to set difficulty counts."}
            </p>
          ) : (
            groupedSubjects.map((subject) => {
              const subjectRows = rows.filter((row) => row.subjectId === subject.id);

              return (
                <div key={subject.id} className="build-set-subject">
                  <div className="build-set-subject-header">
                    <div className="build-set-subject-title">
                      <span className="build-set-subject-code">{subject.courseCode}</span>
                      <span className="build-set-subject-name">{subject.courseTitle}</span>
                    </div>
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      onClick={() => removeSubject(subject.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="build-set-subject-table-wrap modal-table-wrap">
                  <table className="build-set-subject-table">
                    <thead>
                      <tr>
                        <th className="build-set-topic-col">Topic</th>
                        <th className="build-set-num-col">Items</th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge easy">Easy</span>
                        </th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge medium">Medium</span>
                        </th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge hard">Hard</span>
                        </th>
                        <th className="build-set-num-col">Subtotal</th>
                        <th className="build-set-num-col">Remaining</th>
                        <th className="build-set-num-col build-set-avail-col">Available</th>
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
                            <td className="build-set-num-col">
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
                            <td className="build-set-num-col">
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
                            <td className="build-set-num-col">
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
                            <td className="build-set-num-col">
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
                            <td className="build-set-num-col build-set-num-readout">{subtotal}</td>
                            <td className={`build-set-num-col build-set-num-readout ${remainingClass}`}>
                              {rowItemCount(row) > 0 ? remaining : "—"}
                            </td>
                            <td className="build-set-num-col build-set-avail-col muted">
                              {availEasy} / {availMedium} / {availHard}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              );
            })
          )}
          </section>
          </div>

          <div className="build-set-form-footer">
          <div className="build-set-summary">
            <div className="build-set-summary-stats">
              <div className="build-set-stat">
                <span className="build-set-stat-label">Target items</span>
                <span className="build-set-stat-value">{targetItems > 0 ? targetItems : "—"}</span>
              </div>
              <div className="build-set-stat">
                <span className="build-set-stat-label">Assigned</span>
                <span className="build-set-stat-value">{totalItems}</span>
              </div>
              <div className="build-set-stat">
                <span className="build-set-stat-label">Remaining</span>
                <span
                  className={`build-set-stat-value ${
                    targetItems <= 0
                      ? "counter-neutral"
                      : remainingItems === 0
                        ? "counter-done"
                        : remainingItems < 0
                          ? "counter-over"
                          : "counter-pending"
                  }`}
                >
                  {targetItems > 0 ? remainingItems : "—"}
                </span>
              </div>
            </div>
            <p className="field-hint build-set-summary-hint">
              Set item targets per topic; remaining counts down as you assign difficulties.
            </p>
          </div>

          {error && <p className="error build-set-form-error">{error}</p>}

          <div className="modal-footer build-set-form-actions">
            <button type="button" className="btn secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );}
