import { Fragment } from "react";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import {
  DEFAULT_PROGRAM_COURSE,
  PROGRAM_COURSES,
  abbreviateProgramCourse,
  formatProgramCourse,
} from "../lib/programCourse";

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "STUDENT" | "TEACHER" | "SUPERADMIN";
  yearLevel: number | null;
  programCourse: string | null;
  isActive: boolean;
  qaUnlimited: boolean;
}

export interface UserEditDraft {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  yearLevel: string;
  programCourse: string;
  isActive: boolean;
  qaUnlimited: boolean;
  password: string;
}

type UserGroup = "all" | "student" | "teacher" | "admin";

interface Props {
  users: UserRow[];
  group: UserGroup;
  hideYearColumn?: boolean;
  editingId: string | null;
  editDraft: UserEditDraft | null;
  savingId: string | null;
  deletingId: string | null;
  togglingId: string | null;
  currentUserId: string | null;
  emptyMessage?: string;
  onStartEdit: (user: UserRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (user: UserRow) => void;
  onToggleActive: (user: UserRow, isActive: boolean) => void;
  setEditDraft: React.Dispatch<React.SetStateAction<UserEditDraft | null>>;
}

function formatRole(role: string) {
  if (role === "SUPERADMIN") return "Admin";
  if (role === "TEACHER") return "Teacher";
  if (role === "STUDENT") return "Student";
  return role;
}

function UserEditFields({
  editDraft,
  setEditDraft,
  showRole,
  showYearFields,
  showCourseFields,
  showQaFields,
}: {
  editDraft: UserEditDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<UserEditDraft | null>>;
  showRole: boolean;
  showYearFields: boolean;
  showCourseFields: boolean;
  showQaFields: boolean;
}) {
  return (
    <div className="admin-user-edit-fields">
      {showRole && (
        <label>
          <span className="admin-user-edit-label">Role</span>
          <span className="admin-user-edit-control">
            <select
              className="table-input"
              value={editDraft.role}
              onChange={(e) =>
                setEditDraft((draft) => draft && { ...draft, role: e.target.value })
              }
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
          </span>
        </label>
      )}
      {showYearFields && editDraft.role === "STUDENT" && (
        <label className="admin-user-edit-field-narrow">
          <span className="admin-user-edit-label">Year level</span>
          <span className="admin-user-edit-control">
            <input
              className="table-input table-input-narrow"
              type="text"
              inputMode="numeric"
              value={editDraft.yearLevel}
              onChange={(e) =>
                setEditDraft(
                  (draft) =>
                    draft && {
                      ...draft,
                      yearLevel: sanitizeYearInput(e.target.value),
                    }
                )
              }
              onBlur={() =>
                setEditDraft(
                  (draft) =>
                    draft && {
                      ...draft,
                      yearLevel: String(parseYearLevel(draft.yearLevel)),
                    }
                )
              }
            />
          </span>
        </label>
      )}
      {showCourseFields && editDraft.role === "STUDENT" && (
        <label>
          <span className="admin-user-edit-label">Program course</span>
          <span className="admin-user-edit-control">
            <select
              className="table-input"
              value={editDraft.programCourse}
              onChange={(e) =>
                setEditDraft(
                  (draft) => draft && { ...draft, programCourse: e.target.value }
                )
              }
            >
              {PROGRAM_COURSES.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      {showQaFields && editDraft.role === "STUDENT" && (
        <label>
          <span className="admin-user-edit-label">QA profile</span>
          <span className="admin-user-edit-control">
            <input
              type="checkbox"
              checked={editDraft.qaUnlimited}
              onChange={(e) =>
                setEditDraft(
                  (draft) => draft && { ...draft, qaUnlimited: e.target.checked }
                )
              }
            />
          </span>
        </label>
      )}
      <label>
        <span className="admin-user-edit-label">New password</span>
        <span className="admin-user-edit-control">
          <input
            className="table-input"
            type="password"
            placeholder="Leave blank to keep current"
            value={editDraft.password}
            onChange={(e) =>
              setEditDraft((draft) => draft && { ...draft, password: e.target.value })
            }
            minLength={6}
          />
        </span>
      </label>
    </div>
  );
}

export default function AdminUserGroupTable({
  users,
  group,
  hideYearColumn = false,
  editingId,
  editDraft,
  savingId,
  deletingId,
  togglingId,
  currentUserId,
  emptyMessage = "No accounts found.",
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleActive,
  setEditDraft,
}: Props) {
  const showYearColumn = (group === "all" || group === "student") && !hideYearColumn;
  const showCourseColumn = group === "all" || group === "student";
  const showQaColumn = group === "all" || group === "student";
  const showRoleColumn = group === "all";
  const showActiveColumn = group !== "admin";
  const colSpan =
    3 +
    (showRoleColumn ? 1 : 0) +
    (showYearColumn ? 1 : 0) +
    (showCourseColumn ? 1 : 0) +
    (showActiveColumn ? 1 : 0) +
    (showQaColumn ? 1 : 0) +
    1;

  if (users.length === 0) {
    return <p className="muted admin-user-group-empty">{emptyMessage}</p>;
  }

  return (
    <div className="modal-table-scroll admin-users-table-scroll">
      <table className="admin-users-table">
        <thead>
          <tr>
            <th>First name</th>
            <th>Last name</th>
            <th>Email</th>
            {showRoleColumn && <th>Role</th>}
            {showYearColumn && <th className="admin-users-year-cell">Year</th>}
            {showCourseColumn && <th className="admin-users-course-cell">Course</th>}
            {showActiveColumn && <th className="admin-users-active-cell">Active</th>}
            {showQaColumn && <th className="admin-users-qa-cell">QA</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isEditing = editingId === user.id;
            const isStudentRow = user.role === "STUDENT";
            const isAdminRow = user.role === "SUPERADMIN";
            const editingAsStudent = editDraft?.role === "STUDENT";

            return (
              <Fragment key={user.id}>
                <tr className={isEditing ? "admin-users-editing-row" : undefined}>
                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={editDraft?.firstName ?? ""}
                        onChange={(e) =>
                          setEditDraft(
                            (draft) => draft && { ...draft, firstName: e.target.value }
                          )
                        }
                      />
                    ) : (
                      user.firstName
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={editDraft?.lastName ?? ""}
                        onChange={(e) =>
                          setEditDraft(
                            (draft) => draft && { ...draft, lastName: e.target.value }
                          )
                        }
                      />
                    ) : (
                      user.lastName
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        type="email"
                        value={editDraft?.email ?? ""}
                        onChange={(e) =>
                          setEditDraft((draft) => draft && { ...draft, email: e.target.value })
                        }
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  {showRoleColumn && (
                    <td>
                      {isEditing ? (
                        <select
                          className="table-input"
                          value={editDraft?.role ?? "STUDENT"}
                          onChange={(e) =>
                            setEditDraft((draft) => draft && { ...draft, role: e.target.value })
                          }
                        >
                          <option value="STUDENT">Student</option>
                          <option value="TEACHER">Teacher</option>
                          <option value="SUPERADMIN">Superadmin</option>
                        </select>
                      ) : (
                        formatRole(user.role)
                      )}
                    </td>
                  )}
                  {showYearColumn && (
                    <td className="admin-users-year-cell">
                      {isEditing && editingAsStudent ? (
                        <input
                          className="table-input table-input-narrow"
                          type="text"
                          inputMode="numeric"
                          value={editDraft.yearLevel}
                          onChange={(e) =>
                            setEditDraft(
                              (draft) =>
                                draft && {
                                  ...draft,
                                  yearLevel: sanitizeYearInput(e.target.value),
                                }
                            )
                          }
                          onBlur={() =>
                            setEditDraft(
                              (draft) =>
                                draft && {
                                  ...draft,
                                  yearLevel: String(parseYearLevel(draft.yearLevel)),
                                }
                            )
                          }
                        />
                      ) : isStudentRow ? (
                        user.yearLevel ?? "—"
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {showCourseColumn && (
                    <td className="admin-users-course-cell">
                      {isEditing && editingAsStudent ? (
                        <select
                          className="table-input table-input-narrow"
                          value={editDraft.programCourse}
                          onChange={(e) =>
                            setEditDraft(
                              (draft) =>
                                draft && { ...draft, programCourse: e.target.value }
                            )
                          }
                        >
                          {PROGRAM_COURSES.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.abbr}
                            </option>
                          ))}
                        </select>
                      ) : isStudentRow ? (
                        <span title={formatProgramCourse(user.programCourse)}>
                          {abbreviateProgramCourse(user.programCourse)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {showActiveColumn && (
                    <td className="admin-users-active-cell">
                      {isAdminRow ? (
                        "—"
                      ) : isEditing ? (
                        <input
                          type="checkbox"
                          checked={editDraft?.isActive ?? true}
                          onChange={(e) =>
                            setEditDraft(
                              (draft) => draft && { ...draft, isActive: e.target.checked }
                            )
                          }
                        />
                      ) : user.isActive ? (
                        <span title="Active">Y</span>
                      ) : (
                        <span title="Inactive">N</span>
                      )}
                    </td>
                  )}
                  {showQaColumn && (
                    <td className="admin-users-qa-cell">
                      {isEditing && editingAsStudent ? (
                        <input
                          type="checkbox"
                          checked={editDraft.qaUnlimited}
                          onChange={(e) =>
                            setEditDraft(
                              (draft) => draft && { ...draft, qaUnlimited: e.target.checked }
                            )
                          }
                        />
                      ) : user.qaUnlimited ? (
                        "Y"
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="admin-users-actions-cell">
                    <div className="action-buttons">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={savingId === user.id}
                            onClick={() => onSaveEdit(user.id)}
                          >
                            {savingId === user.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="btn secondary btn-sm"
                            onClick={onCancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn secondary btn-sm"
                            onClick={() => onStartEdit(user)}
                          >
                            Edit
                          </button>
                          {isAdminRow ? (
                            <label
                              className="ios-toggle ios-toggle-inline"
                              title={
                                currentUserId === user.id
                                  ? "Cannot disable your own account"
                                  : user.isActive
                                    ? "Enabled — click to disable"
                                    : "Disabled — click to enable"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={user.isActive}
                                disabled={togglingId === user.id || currentUserId === user.id}
                                onChange={(e) => onToggleActive(user, e.target.checked)}
                              />
                              <span className="ios-toggle-slider" aria-hidden="true" />
                              <span className="sr-only">
                                {user.isActive ? "Disable" : "Enable"} {user.firstName}{" "}
                                {user.lastName}
                              </span>
                            </label>
                          ) : (
                            currentUserId !== user.id && (
                              <button
                                type="button"
                                className="btn danger btn-sm"
                                disabled={deletingId === user.id}
                                onClick={() => onDelete(user)}
                              >
                                {deletingId === user.id ? "Deleting..." : "Delete"}
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isEditing && editDraft && (
                  <tr className="admin-user-edit-row">
                    <td colSpan={colSpan}>
                      <UserEditFields
                        editDraft={editDraft}
                        setEditDraft={setEditDraft}
                        showRole={!showRoleColumn}
                        showYearFields={editingAsStudent && !showYearColumn}
                        showCourseFields={editingAsStudent && !showCourseColumn}
                        showQaFields={!showQaColumn && editingAsStudent}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
