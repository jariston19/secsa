import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArchivedQuestionSetsModal from "../components/ArchivedQuestionSetsModal";
import BuildQuestionSetModal from "../components/BuildQuestionSetModal";
import QuestionEncoder from "../components/QuestionEncoder";
import QuestionSetPreviewModal from "../components/QuestionSetPreviewModal";
import RetakeApprovalsModal from "../components/RetakeApprovalsModal";
import SavedQuestionsModal from "../components/SavedQuestionsModal";
import SavedSubjectsModal from "../components/SavedSubjectsModal";
import SavedTopicsModal from "../components/SavedTopicsModal";
import TabPanel from "../components/TabPanel";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSidebar } from "../lib/sidebar";
import { useToast } from "../lib/toast";
import { formatExamType, parseYearLevel, sanitizeYearInput, type QuestionSetExamType } from "../lib/constants";
import {
  subjectLabel,
  toastArchived,
  toastBatchCreated,
  toastCreated,
  toastDeleted,
  toastDeployed,
  toastLinked,
  toastRemoved,
  toastUndeployed,
} from "../lib/toastMessages";
import {
  DEFAULT_PROGRAM_COURSE,
  formatProgramCourse,
  formatProgramCoursesList,
  subjectHasProgram,
  subjectProgramCourseIds,
  type ProgramCourseId,
  type ProgramCourseFilter,
} from "../lib/programCourse";
import { useProgramCourseOptions, usePrograms } from "../lib/programs";

type Tab =
  | "setup"
  | "encode"
  | "sets"
  | "saved-subjects"
  | "saved-topics"
  | "saved-questions"
  | "retake-approvals";

type SetStatusFilter = "ALL" | "DRAFT" | "DEPLOYED";
type SetTypeFilter = "ALL" | QuestionSetExamType;

interface TopicDraftRow {
  key: string;
  name: string;
}

const TAB_SEGMENTS = [
  { id: "setup", label: "Setup" },
  { id: "encode", label: "Encode" },
  { id: "sets", label: "Build" },
];

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
  programCourses: Array<{ programCourse: ProgramCourseId }>;
  _count?: { questions: number };
  topics?: Array<{ id: string; name: string }>;
}

interface Topic {
  id: string;
  name: string;
  subjectId: string;
  subject?: { courseCode: string; courseTitle: string };
  _count?: { questions: number };
}

interface QuestionSet {
  id: string;
  name: string;
  yearLevel: number;
  programCourse: ProgramCourseId;
  type: "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE";
  status: string;
  totalItems: number;
  _count?: { examAttempts: number };
}

export default function TeacherDashboard() {
  const { token } = useAuth();
  const { setPageNav, setPageNavValue, patchPageNav } = useSidebar();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [pendingRetakes, setPendingRetakes] = useState(0);
  const [showBuildSet, setShowBuildSet] = useState(false);
  const [showArchivedSets, setShowArchivedSets] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshGeneration = useRef(0);

  const { programs, defaultSlug, refresh: refreshPrograms } = usePrograms();
  const programCourseOptions = useProgramCourseOptions();

  const [activeProgramId, setActiveProgramId] = useState("");
  const [setsProgramFilter, setSetsProgramFilter] = useState<ProgramCourseFilter>("ALL");
  const activeProgramCourse = useMemo(() => {
    const program = programs.find((item) => item.id === activeProgramId);
    return program?.slug ?? defaultSlug;
  }, [programs, activeProgramId, defaultSlug]);

  useEffect(() => {
    void refreshPrograms();
  }, [refreshPrograms]);

  useEffect(() => {
    if (programCourseOptions.length === 0) {
      setActiveProgramId("");
      return;
    }
    setActiveProgramId((current) => {
      if (current && programCourseOptions.some((course) => course.programId === current)) {
        return current;
      }
      const preferred = programCourseOptions.find((course) => course.id === defaultSlug);
      return preferred?.programId ?? programCourseOptions[0]?.programId ?? "";
    });
  }, [programCourseOptions, defaultSlug]);

  useEffect(() => {
    if (setsProgramFilter === "ALL") return;
    if (!programCourseOptions.some((course) => course.id === setsProgramFilter)) {
      setSetsProgramFilter("ALL");
    }
  }, [programCourseOptions, setsProgramFilter]);

  useEffect(() => {
    if (programCourseOptions.length === 0) return;
    const validSlugs = new Set(programCourseOptions.map((course) => course.id));
    setSubjectForm((form) => {
      const nextCourses = form.programCourses.filter((slug) => validSlugs.has(slug));
      if (nextCourses.length === form.programCourses.length) return form;
      return {
        ...form,
        programCourses:
          nextCourses.length > 0 ? nextCourses : ([defaultSlug] as ProgramCourseId[]),
      };
    });
  }, [programCourseOptions, defaultSlug]);

  const [setsStatusFilter, setSetsStatusFilter] = useState<SetStatusFilter>("ALL");
  const [setsTypeFilter, setSetsTypeFilter] = useState<SetTypeFilter>("ALL");

  const [subjectForm, setSubjectForm] = useState({
    courseCode: "",
    courseTitle: "",
    yearLevel: "1",
    programCourses: [DEFAULT_PROGRAM_COURSE] as ProgramCourseId[],
  });

  const [topicSubjectId, setTopicSubjectId] = useState("");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, TopicDraftRow[]>>({});
  const [savingTopics, setSavingTopics] = useState(false);

  async function refresh() {
    const generation = ++refreshGeneration.current;
    setLoading(true);

    try {
      const [s, t, q, r] = await Promise.all([
        api<{ subjects: Subject[] }>("/subjects", {}, token),
        api<{ topics: Topic[] }>("/topics", {}, token),
        api<{ questionSets: QuestionSet[] }>("/question-sets", {}, token),
        api<{ approvals: Array<{ id: string }> }>("/exams/retakes?status=PENDING", {}, token),
      ]);

      if (generation !== refreshGeneration.current) return;

      setSubjects(s.subjects);
      setTopics(t.topics);
      setSets(q.questionSets);
      setPendingRetakes(r.approvals.length);
    } catch (err) {
      if (generation !== refreshGeneration.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load teacher data");
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    refresh().catch(() => {});
  }, [token]);

  const handlePageNavChange = useCallback((id: string) => {
    setActiveTab(id as Tab);
  }, []);

  const savedMenu = useMemo(
    () => ({
      id: "saved",
      label: "Saved",
      items: [
        {
          id: "saved-subjects",
          label: "Subjects",
          badge: subjects.length,
        },
        {
          id: "saved-topics",
          label: "Topics",
          badge: topics.length,
        },
        {
          id: "saved-questions",
          label: "Questions",
        },
      ],
    }),
    [subjects.length, topics.length]
  );

  const retakeAction = useMemo(
    () => ({
      id: "retake-approvals",
      label: `Retake Approvals${pendingRetakes > 0 ? ` (${pendingRetakes})` : ""}`,
      onClick: () => setActiveTab("retake-approvals"),
      alert: pendingRetakes > 0,
    }),
    [pendingRetakes]
  );

  useEffect(() => {
    setPageNav({
      segments: TAB_SEGMENTS,
      value: activeTab,
      onChange: handlePageNavChange,
      menus: [savedMenu],
      actions: [retakeAction],
    });

    return () => setPageNav(null);
  }, [handlePageNavChange, setPageNav]);

  useEffect(() => {
    patchPageNav({ menus: [savedMenu], actions: [retakeAction] });
  }, [savedMenu, retakeAction, patchPageNav]);

  useEffect(() => {
    setPageNavValue(activeTab);
  }, [activeTab, setPageNavValue]);

  async function createSubject(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await api<{ subject: Subject; linkedPrograms?: boolean }>(
        "/subjects",
        {
          method: "POST",
          body: JSON.stringify({
            courseCode: subjectForm.courseCode,
            courseTitle: subjectForm.courseTitle,
            yearLevel: parseYearLevel(subjectForm.yearLevel),
            programCourses: subjectForm.programCourses,
          }),
        },
        token
      );
      const label = subjectLabel(subjectForm.courseCode, subjectForm.courseTitle);
      toast.success(
        result.linkedPrograms
          ? toastLinked("subject", label, "Linked to additional program course(s).")
          : toastCreated("subject", label)
      );
      setSubjectForm((form) => ({
        courseCode: "",
        courseTitle: "",
        yearLevel: "1",
        programCourses: form.programCourses,
      }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create subject");
    }
  }

  async function saveTopicBatch(e: FormEvent) {
    e.preventDefault();

    const payload = courseSubjects.flatMap((subject) =>
      (topicDrafts[subject.id] ?? [])
        .map((row) => row.name.trim())
        .filter(Boolean)
        .map((name) => ({ subjectId: subject.id, name }))
    );

    if (payload.length === 0) {
      toast.error("Enter at least one topic name.");
      return;
    }

    setSavingTopics(true);
    try {
      const result = await api<{
        created: number;
        skipped: Array<{ subjectId: string; name: string; reason: string }>;
      }>("/topics/batch", { method: "POST", body: JSON.stringify({ topics: payload }) }, token);

      const subjectIds = new Set(payload.map((row) => row.subjectId));
      let message: string;

      if (subjectIds.size === 1) {
        const subject = subjects.find((s) => s.id === payload[0].subjectId);
        const contextLabel = subject
          ? subjectLabel(subject.courseCode, subject.courseTitle)
          : "selected subject";
        const extra =
          result.skipped.length > 0
            ? `${result.skipped.length} skipped (duplicate or already exists).`
            : undefined;
        message = toastBatchCreated("topics", result.created, contextLabel, extra);
      } else {
        message = `Created ${result.created} topics across ${subjectIds.size} subjects.`;
        if (result.skipped.length > 0) {
          message += ` ${result.skipped.length} skipped (duplicate or already exists).`;
        }
      }
      toast.success(message);

      setTopicDrafts(
        Object.fromEntries(
          courseSubjects.map((subject) => [subject.id, [{ key: `${subject.id}-0`, name: "" }]])
        )
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save topics");
    } finally {
      setSavingTopics(false);
    }
  }

  function addTopicRow(subjectId: string) {
    setTopicDrafts((drafts) => ({
      ...drafts,
      [subjectId]: [
        ...(drafts[subjectId] ?? [{ key: `${subjectId}-0`, name: "" }]),
        { key: `${subjectId}-${Date.now()}`, name: "" },
      ],
    }));
  }

  function removeTopicRow(subjectId: string, rowKey: string) {
    setTopicDrafts((drafts) => {
      const rows = drafts[subjectId] ?? [];
      if (rows.length <= 1) return drafts;
      return {
        ...drafts,
        [subjectId]: rows.filter((row) => row.key !== rowKey),
      };
    });
  }

  function updateTopicRow(subjectId: string, rowKey: string, name: string) {
    setTopicDrafts((drafts) => ({
      ...drafts,
      [subjectId]: (drafts[subjectId] ?? []).map((row) =>
        row.key === rowKey ? { ...row, name } : row
      ),
    }));
  }

  async function deploySet(id: string, name: string) {
    try {
      await api(`/question-sets/${id}/deploy`, { method: "POST" }, token);
      toast.success(toastDeployed("question set", name));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy question set");
    }
  }

  async function undeploySet(id: string, name: string) {
    const confirmed = window.confirm(
      `Cancel deploy for "${name}"?\n\nStudents will no longer be able to start this exam until you deploy a set again.`
    );
    if (!confirmed) return;

    try {
      await api(`/question-sets/${id}/undeploy`, { method: "POST" }, token);
      toast.success(toastUndeployed("question set", name));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel deploy");
    }
  }

  async function archiveSet(id: string, name: string) {
    const confirmed = window.confirm(
      `Archive question set "${name}"?\n\nIt will be removed from this list. You can restore it later from Archive.`
    );
    if (!confirmed) return;

    try {
      await api(`/question-sets/${id}/archive`, { method: "POST" }, token);
      if (previewSetId === id) setPreviewSetId(null);
      toast.success(toastArchived("question set", name));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive question set");
    }
  }

  async function deleteSet(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete question set "${name}"?\n\nThis cannot be undone. Questions in the pool will not be deleted.`
    );
    if (!confirmed) return;

    try {
      await api(`/question-sets/${id}`, { method: "DELETE" }, token);
      if (previewSetId === id) setPreviewSetId(null);
      toast.success(toastDeleted("question set", name));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete question set");
    }
  }

  const courseSubjects = useMemo(
    () => subjects.filter((s) => subjectHasProgram(s.programCourses, activeProgramCourse)),
    [subjects, activeProgramCourse]
  );

  const courseSubjectIds = useMemo(
    () => courseSubjects.map((subject) => subject.id).join(","),
    [courseSubjects]
  );

  const existingTopicsBySubject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const topic of topics) {
      counts.set(topic.subjectId, (counts.get(topic.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [topics]);

  useEffect(() => {
    setTopicDrafts((drafts) => {
      const next = { ...drafts };
      for (const subject of courseSubjects) {
        if (!next[subject.id]) {
          next[subject.id] = [{ key: `${subject.id}-0`, name: "" }];
        }
      }
      return next;
    });
    setTopicSubjectId((current) =>
      courseSubjects.some((subject) => subject.id === current)
        ? current
        : (courseSubjects[0]?.id ?? "")
    );
  }, [activeProgramCourse, courseSubjectIds]);

  const courseSets = useMemo(
    () =>
      sets.filter(
        (s) =>
          s.status !== "ARCHIVED" &&
          (setsProgramFilter === "ALL" || s.programCourse === setsProgramFilter) &&
          (setsStatusFilter === "ALL" || s.status === setsStatusFilter) &&
          (setsTypeFilter === "ALL" || s.type === setsTypeFilter)
      ),
    [sets, setsProgramFilter, setsStatusFilter, setsTypeFilter]
  );

  const topicBatchCount = useMemo(
    () =>
      courseSubjects.reduce((count, subject) => {
        const rows = topicDrafts[subject.id] ?? [];
        return count + rows.filter((row) => row.name.trim()).length;
      }, 0),
    [courseSubjects, topicDrafts]
  );

  const selectedTopicSubject = courseSubjects.find((subject) => subject.id === topicSubjectId);
  const currentTopicRows = topicSubjectId
    ? (topicDrafts[topicSubjectId] ?? [{ key: `${topicSubjectId}-0`, name: "" }])
    : [];

  async function handleSavedUpdated(msg: string, isError?: boolean) {
    if (isError) toast.error(msg);
    else toast.success(msg);
    if (!isError) await refresh();
  }

  return (
    <div className="teacher-dashboard">
      <div className="tab-panel">
      <TabPanel activeTab={activeTab}>
      {loading && subjects.length === 0 && (
        <p className="muted teacher-loading">Loading teacher data...</p>
      )}

      {activeTab === "setup" && (
        <div className="grid">
          <div className="setup-split">
          <section className="card setup-card setup-subject-card">
            <h2>Add Subject</h2>
            <p className="muted section-desc setup-desc">
              Add a course to the curriculum (e.g. ACEE 106 — Electromagnetics). Link one subject to
              multiple programs to reuse the same question pool (e.g. Trigonometry for CE, EE, ME).
            </p>
            <form className="form-grid setup-form" onSubmit={createSubject}>
              <label>
                Course code
                <input
                  placeholder="e.g. ACEE 106"
                  value={subjectForm.courseCode}
                  onChange={(e) => setSubjectForm({ ...subjectForm, courseCode: e.target.value })}
                  required
                />
              </label>
              <label>
                Course title
                <input
                  placeholder="e.g. Electromagnetics"
                  value={subjectForm.courseTitle}
                  onChange={(e) => setSubjectForm({ ...subjectForm, courseTitle: e.target.value })}
                  required
                />
              </label>
              <fieldset className="program-course-checkboxes">
                <legend>Program courses</legend>
                <div className="program-course-checkbox-grid">
                  {programCourseOptions.map((course) => {
                    const checked = subjectForm.programCourses.includes(course.id);
                    return (
                      <label key={course.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSubjectForm((form) => {
                              const next = e.target.checked
                                ? [...form.programCourses, course.id]
                                : form.programCourses.filter((id) => id !== course.id);
                              return {
                                ...form,
                                programCourses:
                                  next.length > 0 ? next : ([course.id] as ProgramCourseId[]),
                              };
                            });
                          }}
                        />
                        {course.abbr}
                      </label>
                    );
                  })}
                </div>
                <span className="field-hint">
                  Select every program that shares this subject. Questions are encoded once.
                </span>
              </fieldset>
              <label>
                Curriculum year level
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={subjectForm.yearLevel}
                  onChange={(e) =>
                    setSubjectForm({
                      ...subjectForm,
                      yearLevel: sanitizeYearInput(e.target.value),
                    })
                  }
                  onBlur={() =>
                    setSubjectForm((form) => ({
                      ...form,
                      yearLevel: String(parseYearLevel(form.yearLevel)),
                    }))
                  }
                  required
                />
                <span className="field-hint">1–4 only (1 = 1st year subjects).</span>
              </label>
              <button className="btn">Save Subject</button>
            </form>
          </section>

          <section className="card setup-card topic-batch-card">
            <h2>Add Topics (optional)</h2>
            <p className="muted section-desc setup-desc">
              Pick a subject, add topic rows, then save. Switch subjects to batch topics across
              multiple courses before saving.
            </p>
            <form className="topic-batch-form" onSubmit={saveTopicBatch}>
              <label>
                Program filter
                <select
                  value={activeProgramId}
                  onChange={(e) => setActiveProgramId(e.target.value)}
                >
                  {programCourseOptions.map((course) => (
                    <option key={course.programId} value={course.programId}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>

              {courseSubjects.length === 0 ? (
                <p className="muted">No subjects for this program course yet.</p>
              ) : (
                <>
                  <label>
                    Subject
                    <select
                      value={topicSubjectId}
                      onChange={(e) => setTopicSubjectId(e.target.value)}
                      required
                    >
                      {courseSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.courseCode} — {subject.courseTitle}
                        </option>
                      ))}
                    </select>
                    {selectedTopicSubject && (
                      <span className="field-hint">
                        Yr {selectedTopicSubject.yearLevel}
                        {(existingTopicsBySubject.get(selectedTopicSubject.id) ?? 0) > 0
                          ? ` · ${existingTopicsBySubject.get(selectedTopicSubject.id)} existing topic${
                              existingTopicsBySubject.get(selectedTopicSubject.id) === 1 ? "" : "s"
                            }`
                          : ""}
                      </span>
                    )}
                  </label>

                  <div className="topic-batch-rows">
                    {currentTopicRows.map((row, index) => (
                      <div key={row.key} className="topic-batch-row">
                        <label>
                          Topic / unit name
                          <input
                            placeholder="e.g. Magnetic Fields"
                            value={row.name}
                            onChange={(e) =>
                              updateTopicRow(topicSubjectId, row.key, e.target.value)
                            }
                          />
                        </label>
                        <div className="topic-batch-row-actions">
                          {currentTopicRows.length > 1 && (
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => removeTopicRow(topicSubjectId, row.key)}
                            >
                              Remove
                            </button>
                          )}
                          {index === currentTopicRows.length - 1 && (
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => addTopicRow(topicSubjectId)}
                            >
                              Add row
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                className="btn"
                disabled={savingTopics || courseSubjects.length === 0 || topicBatchCount === 0}
              >
                {savingTopics
                  ? "Saving..."
                  : `Save topic${topicBatchCount === 1 ? "" : "s"}${topicBatchCount > 0 ? ` (${topicBatchCount})` : ""}`}
              </button>
            </form>
          </section>
          </div>
        </div>
      )}

      {activeTab === "encode" && (
        <QuestionEncoder
          subjects={subjects}
          topics={topics}
          programCourse={activeProgramCourse}
          token={token}
          onSaved={(msg) => {
            toast.success(msg);
            refresh().catch(() => {});
          }}
        />
      )}

      {activeTab === "sets" && (
        <section className="card">
          <div className="sets-header">
            <div>
              <h2>Build &amp; Deploy Question Sets</h2>
              <p className="muted section-desc">
                Create a set with per-topic difficulty assignments, then deploy when ready.
              </p>
              <div className="sets-filters">
                <label className="sets-program-filter">
                  Program filter
                  <select
                    value={setsProgramFilter}
                    onChange={(e) =>
                      setSetsProgramFilter(e.target.value as ProgramCourseFilter)
                    }
                  >
                    <option value="ALL">All</option>
                    {programCourseOptions.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sets-status-filter">
                  Status
                  <select
                    value={setsStatusFilter}
                    onChange={(e) =>
                      setSetsStatusFilter(e.target.value as SetStatusFilter)
                    }
                  >
                    <option value="ALL">All</option>
                    <option value="DRAFT">Draft</option>
                    <option value="DEPLOYED">Deployed</option>
                  </select>
                </label>
                <label className="sets-type-filter">
                  Exam type
                  <select
                    value={setsTypeFilter}
                    onChange={(e) => setSetsTypeFilter(e.target.value as SetTypeFilter)}
                  >
                    <option value="ALL">All</option>
                    <option value="COMPREHENSIVE">{formatExamType("COMPREHENSIVE")}</option>
                    <option value="DIAGNOSTIC">{formatExamType("DIAGNOSTIC")}</option>
                    <option value="RETAKE">{formatExamType("RETAKE")}</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="sets-header-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowArchivedSets(true)}
              >
                Archive
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditingSetId(null);
                  setShowBuildSet(true);
                }}
              >
                Build question set
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="sets-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="sets-col-center">Year</th>
                <th>Course</th>
                <th>Type</th>
                <th>Status</th>
                <th className="sets-col-center">Items</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {courseSets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted sets-empty-row">
                    No question sets match these filters. Try Program, Status, or Exam type
                    set to &quot;All&quot;.
                  </td>
                </tr>
              ) : (
              courseSets.map((set) => (
                <tr key={set.id}>
                  <td>{set.name}</td>
                  <td className="sets-col-center">{set.yearLevel}</td>
                  <td>{formatProgramCourse(set.programCourse)}</td>
                  <td>{formatExamType(set.type)}</td>
                  <td>{set.status}</td>
                  <td className="sets-col-center">{set.totalItems}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setPreviewSetId(set.id)}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          setEditingSetId(set.id);
                          setShowBuildSet(true);
                        }}
                      >
                        Edit
                      </button>
                      {set.status === "DEPLOYED" ? (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => undeploySet(set.id, set.name)}
                        >
                          Cancel Deploy
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => deploySet(set.id, set.name)}
                        >
                          Deploy
                        </button>
                      )}
                      {set.status !== "DEPLOYED" && (
                        <>
                          {(set._count?.examAttempts ?? 0) === 0 && (
                            <button
                              type="button"
                              className="btn danger"
                              onClick={() => deleteSet(set.id, set.name)}
                            >
                              Delete
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => archiveSet(set.id, set.name)}
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {activeTab === "saved-subjects" && (
        <SavedSubjectsModal
          inline
          subjects={subjects}
          token={token}
          onUpdated={handleSavedUpdated}
        />
      )}

      {activeTab === "saved-topics" && (
        <SavedTopicsModal
          inline
          topics={topics}
          subjects={subjects}
          token={token}
          onUpdated={handleSavedUpdated}
        />
      )}

      {activeTab === "saved-questions" && (
        <SavedQuestionsModal
          inline
          subjects={subjects}
          topics={topics}
          token={token}
          onUpdated={handleSavedUpdated}
        />
      )}

      {activeTab === "retake-approvals" && (
        <RetakeApprovalsModal inline token={token} onUpdated={handleSavedUpdated} />
      )}
      </TabPanel>
      </div>

      {showBuildSet && (
        <BuildQuestionSetModal
          subjects={subjects}
          topics={topics}
          programCourse={activeProgramCourse}
          token={token}
          setId={editingSetId}
          onClose={() => {
            setShowBuildSet(false);
            setEditingSetId(null);
          }}
          onCreated={async (msg) => {
            toast.success(msg);
            await refresh();
          }}
        />
      )}

      {showArchivedSets && (
        <ArchivedQuestionSetsModal
          programCourse={setsProgramFilter}
          token={token}
          onClose={() => setShowArchivedSets(false)}
          onUpdated={async (msg, isError) => {
            if (isError) toast.error(msg);
            else toast.success(msg);
            if (!isError) await refresh();
          }}
          onPreview={(setId) => {
            setShowArchivedSets(false);
            setPreviewSetId(setId);
          }}
        />
      )}

      {previewSetId && (
        <QuestionSetPreviewModal
          setId={previewSetId}
          token={token}
          onClose={() => setPreviewSetId(null)}
          onQuestionRemoved={(questionPreview, setName) =>
            toast.success(
              toastRemoved("question", questionPreview.slice(0, 72), setName)
            )
          }
          onSetDeleted={(name) => {
            toast.success(toastDeleted("question set", name));
            refresh().catch(() => {});
          }}
          onSetArchived={(name) => {
            toast.success(toastArchived("question set", name));
            setPreviewSetId(null);
            refresh().catch(() => {});
          }}
          onSetUndeployed={(name) => {
            toast.success(toastUndeployed("question set", name));
            refresh().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
