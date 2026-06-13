import { FormEvent, useEffect, useState } from "react";
import BuildQuestionSetModal from "../components/BuildQuestionSetModal";
import QuestionEncoder from "../components/QuestionEncoder";
import QuestionSetPreviewModal from "../components/QuestionSetPreviewModal";
import SavedSubjectsModal from "../components/SavedSubjectsModal";
import SavedTopicsModal from "../components/SavedTopicsModal";
import SegmentedControl from "../components/SegmentedControl";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatExamType, parseYearLevel, sanitizeYearInput } from "../lib/constants";

type Tab = "setup" | "encode" | "sets";

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
  type: "DIAGNOSTIC" | "RETAKE";
  status: string;
  totalItems: number;
}

export default function TeacherDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [showSavedSubjects, setShowSavedSubjects] = useState(false);
  const [showSavedTopics, setShowSavedTopics] = useState(false);
  const [showBuildSet, setShowBuildSet] = useState(false);

  const [subjectForm, setSubjectForm] = useState({
    courseCode: "",
    courseTitle: "",
    yearLevel: "1",
  });

  const [topicForm, setTopicForm] = useState({ name: "", subjectId: "" });

  async function refresh() {
    const [s, t, q] = await Promise.all([
      api<{ subjects: Subject[] }>("/subjects", {}, token),
      api<{ topics: Topic[] }>("/topics", {}, token),
      api<{ questionSets: QuestionSet[] }>("/question-sets", {}, token),
    ]);
    setSubjects(s.subjects);
    setTopics(t.topics);
    setSets(q.questionSets);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
  }, [token]);

  async function createSubject(e: FormEvent) {
    e.preventDefault();
    await api(
      "/subjects",
      {
        method: "POST",
        body: JSON.stringify({
          ...subjectForm,
          yearLevel: parseYearLevel(subjectForm.yearLevel),
        }),
      },
      token
    );
    setMessage("Subject created.");
    setMessageIsError(false);
    setSubjectForm({ courseCode: "", courseTitle: "", yearLevel: "1" });
    await refresh();
  }

  async function createTopic(e: FormEvent) {
    e.preventDefault();
    await api("/topics", { method: "POST", body: JSON.stringify(topicForm) }, token);
    setMessage("Topic created.");
    setMessageIsError(false);
    setTopicForm({ name: "", subjectId: "" });
    await refresh();
  }

  async function deploySet(id: string) {
    await api(`/question-sets/${id}/deploy`, { method: "POST" }, token);
    setMessage("Question set deployed.");
    setMessageIsError(false);
    await refresh();
  }

  async function undeploySet(id: string, name: string) {
    const confirmed = window.confirm(
      `Cancel deploy for "${name}"?\n\nStudents will no longer be able to start this exam until you deploy a set again.`
    );
    if (!confirmed) return;

    try {
      await api(`/question-sets/${id}/undeploy`, { method: "POST" }, token);
      setMessage("Deploy cancelled. Question set is back to draft.");
      setMessageIsError(false);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to cancel deploy");
      setMessageIsError(true);
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
      setMessage("Question set deleted.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete question set");
    }
  }

  return (
    <div className="teacher-dashboard">
      {message && (
        <p className={messageIsError ? "error banner-message" : "success banner-message"}>
          {message}
        </p>
      )}

      <nav className="tabs">
        <SegmentedControl
          segments={TAB_SEGMENTS}
          value={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
        />
        <div className="tabs-nav-actions">
          <button
            type="button"
            className="tab tab-nav-action"
            onClick={() => setShowSavedSubjects(true)}
          >
            Saved Subjects ({subjects.length})
          </button>
          <button
            type="button"
            className="tab tab-nav-action"
            onClick={() => setShowSavedTopics(true)}
          >
            Saved Topics ({topics.length})
          </button>
        </div>
      </nav>

      <div className="tab-panel" key={activeTab}>
      {activeTab === "setup" && (
        <div className="grid">
          <div className="setup-split">
          <section className="card setup-card">
            <h2>Add Subject</h2>
            <p className="muted section-desc setup-desc">
              Add a course to the curriculum (e.g. ACEE 106 — Electromagnetics). Set year level to
              match which curriculum it belongs to — incoming 2nd year students use year level 1.
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

          <section className="card setup-card">
            <h2>Add Topic (optional)</h2>
            <p className="muted section-desc setup-desc">
              Optional unit or chapter within a subject (e.g. Magnetic Fields). Use this to organize
              questions by topic — skip if all questions sit directly under the subject.
            </p>
            <form className="form-grid setup-form" onSubmit={createTopic}>
              <label>
                Subject
                <select
                  value={topicForm.subjectId}
                  onChange={(e) => setTopicForm({ ...topicForm, subjectId: e.target.value })}
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.courseCode} — {s.courseTitle}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Topic / unit name
                <input
                  placeholder="e.g. Magnetic Fields"
                  value={topicForm.name}
                  onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                  required
                />
              </label>
              <button className="btn">Save Topic</button>
            </form>
          </section>
          </div>
        </div>
      )}

      {activeTab === "encode" && (
        <QuestionEncoder
          subjects={subjects}
          topics={topics}
          token={token}
          onSaved={(msg) => {
            setMessage(msg);
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
            </div>
            <button type="button" className="btn" onClick={() => setShowBuildSet(true)}>
              Build question set
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Year</th>
                <th>Type</th>
                <th>Status</th>
                <th>Items</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((set) => (
                <tr key={set.id}>
                  <td>{set.name}</td>
                  <td>{set.yearLevel}</td>
                  <td>{formatExamType(set.type)}</td>
                  <td>{set.status}</td>
                  <td>{set.totalItems}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setPreviewSetId(set.id)}
                      >
                        Preview
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
                          onClick={() => deploySet(set.id)}
                        >
                          Deploy
                        </button>
                      )}
                      {set.status !== "DEPLOYED" && (
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => deleteSet(set.id, set.name)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      </div>

      {showBuildSet && (
        <BuildQuestionSetModal
          subjects={subjects}
          topics={topics}
          token={token}
          onClose={() => setShowBuildSet(false)}
          onCreated={async (msg) => {
            setMessage(msg);
            setMessageIsError(false);
            await refresh();
          }}
        />
      )}

      {showSavedTopics && (
        <SavedTopicsModal
          topics={topics}
          subjects={subjects}
          token={token}
          onClose={() => setShowSavedTopics(false)}
          onUpdated={async (msg, isError) => {
            setMessage(msg);
            setMessageIsError(Boolean(isError));
            if (!isError) await refresh();
          }}
        />
      )}

      {showSavedSubjects && (
        <SavedSubjectsModal
          subjects={subjects}
          token={token}
          onClose={() => setShowSavedSubjects(false)}
          onUpdated={async (msg, isError) => {
            setMessage(msg);
            setMessageIsError(Boolean(isError));
            if (!isError) await refresh();
          }}
        />
      )}

      {previewSetId && (
        <QuestionSetPreviewModal
          setId={previewSetId}
          token={token}
          onClose={() => setPreviewSetId(null)}
          onQuestionRemoved={() => setMessage("Question removed from pool.")}
          onSetDeleted={() => setMessage("Question set deleted.")}
          onSetUndeployed={() => {
            setMessage("Deploy cancelled. Question set is back to draft.");
            setMessageIsError(false);
            refresh().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
