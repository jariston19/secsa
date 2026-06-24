import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { formatFullName } from "../lib/names";
import { DEFAULT_PROGRAM_COURSE, type ProgramCourseId } from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";
import {
  GENDER_OPTIONS,
  SCHOOL_TYPE_OPTIONS,
  type GenderId,
  type SchoolTypeId,
} from "../lib/studentDemographics";
import { duplicateUserEmailMessage } from "../lib/userEmailDuplicates";
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
  hintError = false,
  reserveHintSpace = false,
  children,
}: {
  label: string;
  hint?: string;
  hintError?: boolean;
  reserveHintSpace?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="add-user-field">
      <span className="add-user-field-label">{label}</span>
      <div className="add-user-field-control">{children}</div>
      {hint ? (
        <span
          className={`field-hint add-user-field-hint${hintError ? " field-hint-error" : ""}`}
          role={hintError ? "alert" : undefined}
        >
          {hint}
        </span>
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

  function createEmptyForm() {
    return {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "STUDENT" as UserRole,
      yearLevel: "1",
      programCourse: programCourseOptions[0]?.id ?? DEFAULT_PROGRAM_COURSE,
      gender: "MALE" as GenderId,
      schoolType: "PUBLIC" as SchoolTypeId,
      qaUnlimited: false,
    };
  }

  const [submitting, setSubmitting] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailDuplicate, setEmailDuplicate] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [form, setForm] = useState(createEmptyForm);

  useEffect(() => {
    if (programCourseOptions.length === 0) return;
    const first = programCourseOptions[0].id;
    setForm((current) => {
      const programValid = programCourseOptions.some((course) => course.id === current.programCourse);
      if (programValid) return current;
      return { ...current, programCourse: first };
    });
  }, [programCourseOptions]);

  useEffect(() => {
    const email = form.email.trim();
    if (!email || !email.includes("@")) {
      setEmailDuplicate(null);
      setEmailChecking(false);
      return;
    }

    setEmailChecking(true);
    const timer = window.setTimeout(() => {
      api<{
        available: boolean;
        duplicate: { email: string; firstName: string; lastName: string } | null;
      }>(`/users/check-email?email=${encodeURIComponent(email)}`, {}, token)
        .then((result) => {
          setEmailDuplicate(result.available ? null : result.duplicate);
        })
        .catch(() => {
          setEmailDuplicate(null);
        })
        .finally(() => {
          setEmailChecking(false);
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [form.email, token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (emailDuplicate) {
      onCreated(duplicateUserEmailMessage(emailDuplicate), true);
      return;
    }

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
            yearLevel: form.role === "STUDENT" ? parseYearLevel(form.yearLevel, form.programCourse) : undefined,
            programCourse: form.role === "STUDENT" ? form.programCourse : undefined,
            gender: form.role === "STUDENT" ? form.gender : undefined,
            schoolType: form.role === "STUDENT" ? form.schoolType : undefined,
            qaUnlimited: form.role === "STUDENT" ? form.qaUnlimited : undefined,
          }),
        },
        token
      );

      const createdName = formatFullName(form.firstName.trim(), form.lastName.trim());
      setForm(createEmptyForm());
      onCreated(toastCreated("user", createdName));
    } catch (error) {
      onCreated(error instanceof Error ? error.message : "Failed to create user", true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card build-sets-panel add-user-card">
      <header className="sets-header build-set-inline-header add-user-header">
        <div className="add-user-header-copy">
          <h2>Add User</h2>
        </div>
      </header>

      <form className="add-user-form build-set-form" onSubmit={handleSubmit}>
        <div className="add-user-form-body build-set-form-body">
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
              <FormField
                label="Email"
                hintError={Boolean(emailDuplicate)}
                hint={
                  emailDuplicate
                    ? duplicateUserEmailMessage(emailDuplicate)
                    : emailChecking
                      ? "Checking email availability..."
                      : "Used for sign-in."
                }
              >
                <input
                  placeholder="e.g. student@school.edu"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  aria-invalid={emailDuplicate ? true : undefined}
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
                  hint="Incoming year for this program (Architecture allows up to year 5)."
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1"
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
                        yearLevel: String(parseYearLevel(current.yearLevel, current.programCourse)),
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
                      setForm((current) => {
                        const programCourse = event.target.value as ProgramCourseId;
                        return {
                          ...current,
                          programCourse,
                          yearLevel: String(parseYearLevel(current.yearLevel, programCourse)),
                        };
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
                <FormField label="Gender" hint="Used for demographic cohort analytics.">
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      setForm({ ...form, gender: event.target.value as GenderId })
                    }
                    required
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="School" hint="Public or private senior high school.">
                  <select
                    value={form.schoolType}
                    onChange={(event) =>
                      setForm({ ...form, schoolType: event.target.value as SchoolTypeId })
                    }
                    required
                  >
                    {SCHOOL_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
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

        </div>

        <div className="add-user-actions build-set-form-footer">
          <button
            className="btn"
            type="submit"
            disabled={submitting || emailChecking || Boolean(emailDuplicate)}
          >
            {submitting ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </section>
  );
}
