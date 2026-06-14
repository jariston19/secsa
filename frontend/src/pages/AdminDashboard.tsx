import { FormEvent, useEffect, useState } from "react";
import AdminUsersModal from "../components/AdminUsersModal";
import AnalyticsReports from "../components/AnalyticsReports";
import CohortScorecard, { type CohortsData } from "../components/CohortScorecard";
import QuestionPerformanceModal from "../components/QuestionPerformanceModal";
import SegmentedControl from "../components/SegmentedControl";
import StudentSubmissionDetailModal from "../components/StudentSubmissionDetailModal";
import StudentSubmissionsSection from "../components/StudentSubmissionsSection";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { formatFullName } from "../lib/names";
import { DEFAULT_PROGRAM_COURSE, PROGRAM_COURSES, type ProgramCourseId } from "../lib/programCourse";
import { toastApproved, toastCreated } from "../lib/toastMessages";

type Tab = "users" | "analytics" | "submissions";

const TAB_SEGMENTS = [
  { id: "users", label: "Users" },
  { id: "analytics", label: "Analytics" },
  { id: "submissions", label: "Submissions" },
];

export default function AdminDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [cohorts, setCohorts] = useState<CohortsData | null>(null);
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showQuestionPerformance, setShowQuestionPerformance] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "STUDENT",
    yearLevel: "2",
    programCourse: DEFAULT_PROGRAM_COURSE,
    qaUnlimited: false,
  });

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    try {
      const [o, c, r] = await Promise.all([
        api<{ [key: string]: number }>("/analytics/overview", {}, token),
        api<CohortsData>("/analytics/cohorts", {}, token),
        api<{ approvals: Array<Record<string, unknown>> }>(
          "/exams/retakes?status=PENDING",
          {},
          token
        ),
      ]);
      setOverview(o);
      setCohorts(c);
      setApprovals(r.approvals);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "analytics") return;
    refreshAnalytics().catch((err) => {
      toast.error(err.message);
    });
  }, [token, activeTab]);

  useEffect(() => {
    if (activeTab !== "submissions") {
      setSelectedSubmissionId(null);
    }
  }, [activeTab]);

  function showMessage(text: string, isError = false) {
    if (isError) toast.error(text);
    else toast.success(text);
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    try {
      await api(
        "/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: userForm.email,
            password: userForm.password,
            firstName: userForm.firstName,
            lastName: userForm.lastName,
            role: userForm.role,
            yearLevel: userForm.role === "STUDENT" ? parseYearLevel(userForm.yearLevel) : undefined,
            programCourse: userForm.role === "STUDENT" ? userForm.programCourse : undefined,
            qaUnlimited: userForm.role === "STUDENT" ? userForm.qaUnlimited : undefined,
          }),
        },
        token
      );
      const createdName = formatFullName(userForm.firstName.trim(), userForm.lastName.trim());
      setUserForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "STUDENT",
        yearLevel: "2",
        programCourse: DEFAULT_PROGRAM_COURSE,
        qaUnlimited: false,
      });
      showMessage(toastCreated("user", createdName));
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to create user", true);
    }
  }

  async function approveRetake(id: string, studentName: string) {
    await api(`/exams/retakes/${id}/approve`, { method: "POST", body: "{}" }, token);
    showMessage(toastApproved("retake request", studentName));
    await refreshAnalytics();
  }

  return (
    <div className="admin-dashboard">
      <nav className="tabs">
        <SegmentedControl
          segments={TAB_SEGMENTS}
          value={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
        />
      </nav>

      <div className="tab-panel">
      {activeTab === "users" && (
      <div className="grid">
      <section className="card">
        <div className="row-between admin-users-launch">
          <div>
            <h2>Users</h2>
            <p className="muted section-desc">
              Create accounts or manage existing students, teachers, and admins.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={() => setShowUsers(true)}>
            Manage Users
          </button>
        </div>
        <form className="form-grid" onSubmit={createUser}>
          <label>
            First name
            <input
              placeholder="e.g. Juan"
              value={userForm.firstName}
              onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
              required
            />
          </label>
          <label>
            Last name
            <input
              placeholder="e.g. Dela Cruz"
              value={userForm.lastName}
              onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              placeholder="e.g. student@school.edu"
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
            />
            <span className="field-hint">Used for login.</span>
          </label>
          <label>
            Password
            <input
              placeholder="Minimum 6 characters"
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label>
            Role
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            >
              <option value="STUDENT">Student — can take exams only</option>
              <option value="TEACHER">Teacher — encode questions and approve retakes</option>
              <option value="SUPERADMIN">Superadmin — manage users and analytics</option>
            </select>
          </label>
          {userForm.role === "STUDENT" && (
            <>
              <label>
                Year level
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  value={userForm.yearLevel}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      yearLevel: sanitizeYearInput(e.target.value),
                    })
                  }
                  onBlur={() =>
                    setUserForm((form) => ({
                      ...form,
                      yearLevel: String(parseYearLevel(form.yearLevel)),
                    }))
                  }
                  required
                />
                <span className="field-hint">
                  1–4 only. 2 means incoming 2nd year — determines which exam they receive.
                </span>
              </label>
              <label>
                Program course
                <select
                  value={userForm.programCourse}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      programCourse: e.target.value as ProgramCourseId,
                    })
                  }
                  required
                >
                  {PROGRAM_COURSES.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Determines which question pool and exams the student receives.
                </span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userForm.qaUnlimited}
                  onChange={(e) => setUserForm({ ...userForm, qaUnlimited: e.target.checked })}
                />
                QA profile (unlimited exam takes)
              </label>
            </>
          )}
          <button className="btn">Create User</button>
        </form>
      </section>
      </div>
      )}

      {activeTab === "analytics" && (
      <div className="grid">
      {analyticsLoading && !overview ? (
        <p className="muted">Loading analytics...</p>
      ) : (
        <>
      <section className="card">
        <h2>Analytics Overview</h2>
        {overview && (
          <ul className="stats">
            <li>Students: {overview.students}</li>
            <li>Exams taken: {overview.examsTaken}</li>
            <li>First takers: {overview.firstTakers}</li>
            <li>Retakers: {overview.retakers}</li>
            <li>Pass rate: {overview.passRate?.toFixed(1)}%</li>
            <li>Average score: {overview.averageScore?.toFixed(1)}%</li>
          </ul>
        )}
      </section>

      <section className="card">
        <h2>First Takers vs Retakers</h2>
        <p className="muted section-desc">
          Compare pass rate and average score between first-time and retake attempts.
        </p>
        {cohorts && <CohortScorecard cohorts={cohorts} />}
      </section>

      <section className="card">
        <div className="row-between admin-users-launch">
          <div>
            <h2>Question Performance</h2>
            <p className="muted section-desc">
              Review correct rates by subject, topic, and difficulty — lowest first.
            </p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowQuestionPerformance(true)}
          >
            View Performance
          </button>
        </div>
      </section>

      <AnalyticsReports token={token} />

      <section className="card">
        <h2>Pending Retake Approvals</h2>
        <p className="muted section-desc">
          Students who failed can retake up to 2 times after approval.
        </p>
        {approvals.length === 0 ? (
          <p className="muted">No pending approvals.</p>
        ) : (
          approvals.map((a) => (
            <div key={String(a.id)} className="row-between">
              <span>
                Student: {formatFullName(
                  (a.student as { firstName: string }).firstName,
                  (a.student as { lastName: string }).lastName
                )}{" "}
                · Year {(a.student as { yearLevel: number }).yearLevel}
              </span>
              <button
                className="btn secondary"
                onClick={() =>
                  approveRetake(
                    String(a.id),
                    formatFullName(
                      (a.student as { firstName: string }).firstName,
                      (a.student as { lastName: string }).lastName
                    )
                  )
                }
              >
                Approve Retake
              </button>
            </div>
          ))
        )}
      </section>
        </>
      )}
      </div>
      )}

      {activeTab === "submissions" && (
      <div className="grid">
        <StudentSubmissionsSection
          token={token}
          onViewSubmission={setSelectedSubmissionId}
        />
      </div>
      )}
      </div>

      {showUsers && (
        <AdminUsersModal
          token={token}
          onClose={() => setShowUsers(false)}
          onUpdated={showMessage}
        />
      )}

      {showQuestionPerformance && (
        <QuestionPerformanceModal
          token={token}
          onClose={() => setShowQuestionPerformance(false)}
        />
      )}

      {selectedSubmissionId && (
        <StudentSubmissionDetailModal
          submissionId={selectedSubmissionId}
          token={token}
          onClose={() => setSelectedSubmissionId(null)}
        />
      )}
    </div>
  );
}
