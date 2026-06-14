import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { MAX_YEAR_LEVEL, MIN_YEAR_LEVEL } from "../lib/constants";
import { PROGRAM_COURSES, subjectHasProgram, type ProgramCourseId } from "../lib/programCourse";
import { subjectLabel, toastBatchCreated, toastCreated, truncateLabel } from "../lib/toastMessages";

export interface QuestionDraft {
  id: string;
  difficulty: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  image: File | null;
  imagePreview: string | null;
}

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

interface Props {
  subjects: Subject[];
  topics: Topic[];
  programCourse: ProgramCourseId;
  token: string | null;
  onSaved: (message: string) => void;
}

function createQuestionId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // randomUUID is blocked over HTTP on non-localhost hosts (e.g. LAN IP).
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyQuestion(): QuestionDraft {
  return {
    id: createQuestionId(),
    difficulty: "EASY",
    text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    image: null,
    imagePreview: null,
  };
}

function isComplete(q: QuestionDraft) {
  return q.text.trim() && q.optionA.trim() && q.optionB.trim() && q.optionC.trim() && q.optionD.trim();
}

export default function QuestionEncoder({ subjects, topics, programCourse, token, onSaved }: Props) {
  const [yearLevel, setYearLevel] = useState("1");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateQuestion(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => {
      const target = prev.find((q) => q.id === id);
      if (target?.imagePreview) URL.revokeObjectURL(target.imagePreview);
      if (prev.length === 1) return [emptyQuestion()];
      return prev.filter((q) => q.id !== id);
    });
  }

  function handleImageChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const current = questions.find((q) => q.id === id);
    if (current?.imagePreview) URL.revokeObjectURL(current.imagePreview);

    if (!file) {
      updateQuestion(id, { image: null, imagePreview: null });
      return;
    }

    updateQuestion(id, {
      image: file,
      imagePreview: URL.createObjectURL(file),
    });
  }

  async function saveAll() {
    if (!subjectId) {
      setError("Select a subject before saving.");
      return;
    }

    const toSave = questions.filter(isComplete);
    if (toSave.length === 0) {
      setError("Add at least one complete question before saving.");
      return;
    }

    setSaving(true);
    setError("");

    let saved = 0;
    const failures: string[] = [];

    for (let i = 0; i < toSave.length; i++) {
      const q = toSave[i];
      const formData = new FormData();
      formData.append("subjectId", subjectId);
      if (topicId) formData.append("topicId", topicId);
      formData.append("difficulty", q.difficulty);
      formData.append("text", q.text.trim());
      formData.append("optionA", q.optionA.trim());
      formData.append("optionB", q.optionB.trim());
      formData.append("optionC", q.optionC.trim());
      formData.append("optionD", q.optionD.trim());
      formData.append("correctOption", q.correctOption);
      if (q.image) formData.append("image", q.image);

      try {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        saved += 1;
      } catch (err) {
        failures.push(`Question ${i + 1}: ${err instanceof Error ? err.message : "Save failed"}`);
      }
    }

    setSaving(false);

    if (saved > 0) {
      questions.forEach((q) => {
        if (q.imagePreview) URL.revokeObjectURL(q.imagePreview);
      });
      setQuestions([emptyQuestion()]);
      const subject = subjects.find((s) => s.id === subjectId);
      const contextLabel = subject
        ? subjectLabel(subject.courseCode, subject.courseTitle)
        : "selected subject";
      const message =
        saved === 1
          ? toastCreated("question", truncateLabel(toSave[0].text))
          : toastBatchCreated("questions", saved, contextLabel);
      onSaved(message);
    }

    if (failures.length > 0) {
      setError(failures.join(" "));
    } else if (saved === 0) {
      setError("No questions were saved.");
    }
  }

  const completeCount = questions.filter(isComplete).length;

  const filteredSubjects = useMemo(
    () =>
      subjects
        .filter(
          (s) => s.yearLevel === Number(yearLevel) && subjectHasProgram(s.programCourses, programCourse)
        )
        .sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [subjects, yearLevel, programCourse]
  );

  const filteredTopics = topics.filter((t) => t.subjectId === subjectId);

  useEffect(() => {
    const subjectStillValid = filteredSubjects.some((s) => s.id === subjectId);
    if (!subjectStillValid) {
      setSubjectId("");
      setTopicId("");
    }
  }, [filteredSubjects, subjectId, programCourse]);

  function handleYearLevelChange(value: string) {
    setYearLevel(value);
    setSubjectId("");
    setTopicId("");
    setError("");
  }

  return (
    <div className="encoder">
      <div className="encoder-header card">
        <h2>Encode Questions</h2>
        <p className="muted section-desc">
          Pick a curriculum year level for{" "}
          {PROGRAM_COURSES.find((c) => c.id === programCourse)?.label ?? "this program"}, then
          choose the subject and optional topic for all questions below.
        </p>
        <div className="encoder-meta">
          <label>
            Curriculum year level
            <select value={yearLevel} onChange={(e) => handleYearLevelChange(e.target.value)}>
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
          <label>
            Subject
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId("");
              }}
              required
              disabled={filteredSubjects.length === 0}
            >
              <option value="">
                {filteredSubjects.length === 0
                  ? "No subjects for this year and program course"
                  : "Select a subject"}
              </option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseCode} — {s.courseTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            Topic (optional)
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">No topic — subject only</option>
              {filteredTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="encoder-rows">
        {questions.map((q, index) => (
          <div key={q.id} className="question-row-card card">
            <div className="question-row-header">
              <h3>Question {index + 1}</h3>
              <button
                type="button"
                className="btn secondary btn-sm"
                onClick={() => removeQuestion(q.id)}
              >
                Remove
              </button>
            </div>

            <div className="encoder-form-grid">
              <label>
                Difficulty
                <select
                  value={q.difficulty}
                  onChange={(e) => updateQuestion(q.id, { difficulty: e.target.value })}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </label>

              <label>
                Correct answer
                <select
                  value={q.correctOption}
                  onChange={(e) => updateQuestion(q.id, { correctOption: e.target.value })}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>

              <label className="encoder-field-full">
                Question
                <textarea
                  placeholder="Enter question text"
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                />
              </label>

              <label>
                Option A
                <input
                  value={q.optionA}
                  onChange={(e) => updateQuestion(q.id, { optionA: e.target.value })}
                />
              </label>
              <label>
                Option B
                <input
                  value={q.optionB}
                  onChange={(e) => updateQuestion(q.id, { optionB: e.target.value })}
                />
              </label>
              <label>
                Option C
                <input
                  value={q.optionC}
                  onChange={(e) => updateQuestion(q.id, { optionC: e.target.value })}
                />
              </label>
              <label>
                Option D
                <input
                  value={q.optionD}
                  onChange={(e) => updateQuestion(q.id, { optionD: e.target.value })}
                />
              </label>

              <label className="encoder-field-full">
                Attach image (optional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleImageChange(q.id, e)}
                />
              </label>

              {q.imagePreview && (
                <div className="image-preview-block encoder-field-full">
                  <img src={q.imagePreview} alt="Preview" className="image-preview" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn secondary add-question-btn" onClick={addQuestion}>
        + Add question
      </button>

      <div className="encoder-footer card">
        <div className="encoder-footer-status">
          <div>
            <strong>{completeCount}</strong> of {questions.length} question
            {questions.length === 1 ? "" : "s"} ready to save
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <button
          type="button"
          className="btn"
          onClick={saveAll}
          disabled={saving || !subjectId || completeCount === 0}
        >
          {saving ? "Saving..." : `Save all (${completeCount})`}
        </button>
      </div>
    </div>
  );
}
