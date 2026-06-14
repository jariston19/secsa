import { FormEvent, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { formatFullName } from "../lib/names";
import { DEFAULT_PROGRAM_COURSE, type ProgramCourseId } from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import { toastCreated } from "../lib/toastMessages";

type UserRole = "STUDENT" | "TEACHER" | "SUPERADMIN";

const ROLE_OPTIONS: Array<{ id: UserRole; label: string; description: string }> = [
  { id: "STUDENT", label: "Student", description: "Take comprehensive and retake exams" },
  { id: "TEACHER", label: "Teacher", description: "Encode questions and approve retakes" },
  { id: "SUPERADMIN", label: "Superadmin", description: "Manage users, content, and analytics" },
];

function FormField({
  label,
  hint,
  reserveHintSpace = false,
  children,
}: {
  label: string;
  hint?: string;
  reserveHintSpace?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="add-user-field">
      <span className="add-user-field-label">{label}</span>
      <div className="add-user-field-control">{children}</div>
      {hint ? (
        <span className="field-hint add-user-field-hint">{hint}</span>
      ) : reserveHintSpace ? (
        <span className="add-user-field-hint-spacer" aria-hidden="true" />
      ) : null}
    </div>
  );
}

interface Props {
  token: string | null;
  onCreated: (message: string, isError?: boolean) => void;
}

export default function AddUserForm({ token, onCreated }: Props) {
  const programCourseOptions = useProgramCourseOptions();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "STUDENT" as UserRole,
    yearLevel: "2",
    programCourse: DEFAULT_PROGRAM_COURSE,
    qaUnlimited: false,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await api(
        "/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            firstName: form.firstName,
            lastName: form.lastName,
            role: form.role,
            yearLevel: form.role === "STUDENT" ? parseYearLevel(form.yearLevel) : undefined,
            programCourse: form.role === "STUDENT" ? form.programCourse : undefined,
            qaUnlimited: form.role === "STUDENT" ? form.qaUnlimited : undefined,
          }),
        },
        token
      );

      const createdName = formatFullName(form.firstName.trim(), form.lastName.trim());
      setForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "STUDENT",
        yearLevel: "2",
        programCourse: DEFAULT_PROGRAM_COURSE,
        qaUnlimited: false,
      });
      onCreated(toastCreated("user", createdName));
    } catch (error) {
      onCreated(error instanceof Error ? error.message : "Failed to create user", true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="add-user-page">
      <section className="card add-user-card">
        <header className="add-user-header">
          <div className="add-user-header-copy">
            <h2>Add User</h2>
            <p className="muted section-desc">
              Create accounts for students, teachers, or superadmins. Student settings determine
              which exams they receive.
            </p>
          </div>
        </header>

        <form className="add-user-form" onSubmit={handleSubmit}>
          <fieldset className="add-user-section">
            <legend>Profile</legend>
            <div className="add-user-fields add-user-fields-2">
              <FormField label="First name" reserveHintSpace>
                <input
                  placeholder="e.g. Juan"
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  required
                />
              </FormField>
              <FormField label="Last name" reserveHintSpace>
                <input
                  placeholder="e.g. Dela Cruz"
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  required
                />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="add-user-section">
            <legend>Account</legend>
            <div className="add-user-fields add-user-fields-2">
              <FormField label="Email" hint="Used for sign-in.">
                <input
                  placeholder="e.g. student@school.edu"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </FormField>
              <FormField label="Password" reserveHintSpace>
                <input
                  placeholder="Minimum 6 characters"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                  minLength={6}
                />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="add-user-section">
            <legend>Role</legend>
            <div className="add-user-role-grid" role="radiogroup" aria-label="User role">
              {ROLE_OPTIONS.map((role) => {
                const active = form.role === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`add-user-role-card${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setForm({ ...form, role: role.id })}
                  >
                    <span className="add-user-role-label">{role.label}</span>
                    <span className="add-user-role-desc">{role.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {form.role === "STUDENT" && (
            <fieldset className="add-user-section add-user-student-panel">
              <legend>Student settings</legend>
              <div className="add-user-fields add-user-fields-2">
                <FormField
                  label="Year level"
                  hint="Incoming year 1–4. Sets which exam they receive."
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="2"
                    value={form.yearLevel}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        yearLevel: sanitizeYearInput(event.target.value),
                      })
                    }
                    onBlur={() =>
                      setForm((current) => ({
                        ...current,
                        yearLevel: String(parseYearLevel(current.yearLevel)),
                      }))
                    }
                    required
                  />
                </FormField>
                <FormField
                  label="Program course"
                  hint="Question pool and exam set for this program."
                >
                  <select
                    value={form.programCourse}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        programCourse: event.target.value as ProgramCourseId,
                      })
                    }
                    required
                  >
                    {programCourseOptions.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="add-user-toggle-row">
                <div>
                  <span className="add-user-toggle-title">QA profile</span>
                  <p className="muted add-user-toggle-desc">Unlimited exam takes for testing.</p>
                </div>
                <label className="ios-toggle ios-toggle-inline" title="QA profile (unlimited exam takes)">
                  <input
                    type="checkbox"
                    checked={form.qaUnlimited}
                    onChange={(event) => setForm({ ...form, qaUnlimited: event.target.checked })}
                  />
                  <span className="ios-toggle-slider" aria-hidden="true" />
                  <span className="sr-only">QA profile (unlimited exam takes)</span>
                </label>
              </div>
            </fieldset>
          )}

          <div className="add-user-actions">
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
