import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";

export default function AdminDashboard() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [questions, setQuestions] = useState<Array<Record<string, unknown>>>([]);
  const [cohorts, setCohorts] = useState<Record<string, unknown> | null>(null);
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");

  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "STUDENT",
    yearLevel: "2",
  });

  async function refresh() {
    const [o, q, c, r] = await Promise.all([
      api<{ [key: string]: number }>("/analytics/overview", {}, token),
      api<{ questions: Array<Record<string, unknown>> }>("/analytics/questions", {}, token),
      api<Record<string, unknown>>("/analytics/cohorts", {}, token),
      api<{ approvals: Array<Record<string, unknown>> }>("/exams/retakes?status=PENDING", {}, token),
    ]);
    setOverview(o);
    setQuestions(q.questions);
    setCohorts(c);
    setApprovals(r.approvals);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
  }, [token]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    await api(
      "/users",
      {
        method: "POST",
        body: JSON.stringify({
          ...userForm,
          yearLevel: userForm.role === "STUDENT" ? parseYearLevel(userForm.yearLevel) : undefined,
        }),
      },
      token
    );
    setMessage("User created.");
    await refresh();
  }

  async function approveRetake(id: string) {
    await api(`/exams/retakes/${id}/approve`, { method: "POST", body: "{}" }, token);
    setMessage("Retake approved.");
    await refresh();
  }

  return (
    <div className="grid">
      {message && <p className="success">{message}</p>}

      <section className="card">
        <h2>Add User</h2>
        <p className="muted section-desc">
          Create student or teacher accounts. Students need a year level from 1 to 4 (2 = incoming
          2nd year).
        </p>
        <form className="form-grid" onSubmit={createUser}>
          <label>
            Full name
            <input
              placeholder="e.g. Juan Dela Cruz"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
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
          )}
          <button className="btn">Create User</button>
        </form>
      </section>

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
        {cohorts && (
          <pre className="code-block">{JSON.stringify(cohorts, null, 2)}</pre>
        )}
      </section>

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
                Student: {(a.student as { name: string })?.name} · Year{" "}
                {(a.student as { yearLevel: number })?.yearLevel}
              </span>
              <button className="btn secondary" onClick={() => approveRetake(String(a.id))}>
                Approve Retake
              </button>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Question Performance (lowest correct rate first)</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Topic</th>
              <th>Difficulty</th>
              <th>Correct %</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={String(q.questionId)}>
                <td>{String(q.subject)}</td>
                <td>{String(q.topic ?? "—")}</td>
                <td>{String(q.difficulty)}</td>
                <td>{Number(q.correctRate).toFixed(1)}%</td>
                <td>{Number(q.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
