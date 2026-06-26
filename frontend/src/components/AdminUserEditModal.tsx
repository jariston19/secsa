import { useMemo } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { useProgramCourseOptions } from "../lib/programs";
import {
  duplicateUserEmailMessage,
  findDuplicateUserEmail,
} from "../lib/userEmailDuplicates";
import {
  GENDER_OPTIONS,
  SCHOOL_TYPE_OPTIONS,
  type GenderId,
  type SchoolTypeId,
} from "../lib/studentDemographics";
import type { UserEditDraft, UserRow } from "./AdminUserGroupTable";

interface Props {
  user: UserRow | null;
  allUsers: UserRow[];
  editDraft: UserEditDraft | null;
  saving: boolean;
  group: "student" | "teacher" | "admin";
  onClose: () => void;
  onSave: () => void;
  setEditDraft: React.Dispatch<React.SetStateAction<UserEditDraft | null>>;
}

function UserEditFields({
  editDraft,
  setEditDraft,
  showRole,
  showYearFields,
  showCourseFields,
  showGenderField,
  showSchoolField,
  showQaFields,
}: {
  editDraft: UserEditDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<UserEditDraft | null>>;
  showRole: boolean;
  showYearFields: boolean;
  showCourseFields: boolean;
  showGenderField: boolean;
  showSchoolField: boolean;
  showQaFields: boolean;
}) {
  const programCourseOptions = useProgramCourseOptions();

  return (
    <div className="admin-user-edit-fields admin-user-edit-fields-modal">
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
                      yearLevel: String(parseYearLevel(draft.yearLevel, draft.programCourse)),
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
                setEditDraft((draft) => {
                  if (!draft) return draft;
                  const programCourse = e.target.value;
                  return {
                    ...draft,
                    programCourse,
                    yearLevel: String(parseYearLevel(draft.yearLevel, programCourse)),
                  };
                })
              }
            >
              {programCourseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      {showGenderField && editDraft.role === "STUDENT" && (
        <label>
          <span className="admin-user-edit-label">Gender</span>
          <span className="admin-user-edit-control">
            <select
              className="table-input"
              value={editDraft.gender}
              onChange={(e) =>
                setEditDraft(
                  (draft) =>
                    draft && { ...draft, gender: e.target.value as GenderId }
                )
              }
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      {showSchoolField && editDraft.role === "STUDENT" && (
        <label>
          <span className="admin-user-edit-label">School</span>
          <span className="admin-user-edit-control">
            <select
              className="table-input"
              value={editDraft.schoolType}
              onChange={(e) =>
                setEditDraft(
                  (draft) =>
                    draft && { ...draft, schoolType: e.target.value as SchoolTypeId }
                )
              }
            >
              {SCHOOL_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
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
      {editDraft.role !== "SUPERADMIN" && (
        <label>
          <span className="admin-user-edit-label">Active</span>
          <span className="admin-user-edit-control">
            <input
              type="checkbox"
              checked={editDraft.isActive}
              onChange={(e) =>
                setEditDraft(
                  (draft) => draft && { ...draft, isActive: e.target.checked }
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

export default function AdminUserEditModal({
  user,
  allUsers,
  editDraft,
  saving,
  group,
  onClose,
  onSave,
  setEditDraft,
}: Props) {
  const open = Boolean(user && editDraft);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose, open);

  const editingEmailDuplicate = useMemo(() => {
    if (!user || !editDraft?.email.trim()) return null;
    return findDuplicateUserEmail(allUsers, editDraft.email, user.id);
  }, [allUsers, editDraft?.email, user]);

  if (!open || !user || !editDraft) return null;

  const editingAsStudent = editDraft.role === "STUDENT";

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div
        className={panelClass("admin-user-edit-modal")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-edit-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="admin-user-edit-title">Edit user</h2>
            <p className="muted">{user.email}</p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        <div className="admin-user-edit-modal-body">
          <div className="admin-user-edit-modal-core">
            <label>
              <span className="admin-user-edit-label">First name</span>
              <input
                className="table-input"
                value={editDraft.firstName}
                onChange={(e) =>
                  setEditDraft((draft) => draft && { ...draft, firstName: e.target.value })
                }
              />
            </label>
            <label>
              <span className="admin-user-edit-label">Last name</span>
              <input
                className="table-input"
                value={editDraft.lastName}
                onChange={(e) =>
                  setEditDraft((draft) => draft && { ...draft, lastName: e.target.value })
                }
              />
            </label>
            <label>
              <span className="admin-user-edit-label">Email</span>
              <input
                className="table-input"
                type="email"
                value={editDraft.email}
                onChange={(e) =>
                  setEditDraft((draft) => draft && { ...draft, email: e.target.value })
                }
                aria-invalid={editingEmailDuplicate ? true : undefined}
              />
              {editingEmailDuplicate && (
                <span className="field-hint field-hint-error" role="alert">
                  {duplicateUserEmailMessage(editingEmailDuplicate)}
                </span>
              )}
            </label>
          </div>

          <UserEditFields
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            showRole={group !== "student"}
            showYearFields={editingAsStudent}
            showCourseFields={editingAsStudent}
            showGenderField={editingAsStudent}
            showSchoolField={editingAsStudent}
            showQaFields={editingAsStudent && group === "student"}
          />
        </div>

        <div className="admin-user-edit-modal-footer">
          <button type="button" className="btn secondary" onClick={requestClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={saving || Boolean(editingEmailDuplicate)}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
