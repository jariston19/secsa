import { useMemo } from "react";
import { formatDisplayNamePart } from "../lib/names";
import {
  abbreviateProgramCourse,
  formatProgramCourse,
} from "../lib/programCourse";
import {
  formatGender,
  formatSchoolType,
} from "../lib/studentDemographics";

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "STUDENT" | "TEACHER" | "SUPERADMIN";
  yearLevel: number | null;
  programCourse: string | null;
  gender: import("../lib/studentDemographics").GenderId | null;
  schoolType: import("../lib/studentDemographics").SchoolTypeId | null;
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
  gender: import("../lib/studentDemographics").GenderId;
  schoolType: import("../lib/studentDemographics").SchoolTypeId;
  isActive: boolean;
  qaUnlimited: boolean;
  password: string;
}

type UserGroup = "student" | "teacher" | "admin";

interface Props {
  users: UserRow[];
  group: UserGroup;
  hideYearColumn?: boolean;
  selectedIds: Set<string>;
  togglingId: string | null;
  currentUserId: string | null;
  emptyMessage?: string;
  onToggleSelect: (userId: string, selected: boolean) => void;
  onToggleSelectAll: (userIds: string[], selected: boolean) => void;
  onToggleActive: (user: UserRow, isActive: boolean) => void;
}

function formatRole(role: string) {
  if (role === "SUPERADMIN") return "Admin";
  if (role === "TEACHER") return "Teacher";
  if (role === "STUDENT") return "Student";
  return role;
}

export default function AdminUserGroupTable({
  users,
  group,
  hideYearColumn = false,
  selectedIds,
  togglingId,
  currentUserId,
  emptyMessage = "No accounts found.",
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
}: Props) {
  const showYearColumn = group === "student" && !hideYearColumn;
  const showCourseColumn = group === "student";
  const showGenderCol = group === "student";
  const showSchoolCol = group === "student";
  const showQaColumn = group === "student";
  const showActiveColumn = group !== "admin";
  const showEnabledColumn = group === "admin";

  const pageUserIds = useMemo(() => users.map((user) => user.id), [users]);
  const allPageSelected =
    pageUserIds.length > 0 && pageUserIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    !allPageSelected && pageUserIds.some((id) => selectedIds.has(id));

  if (users.length === 0) {
    return <p className="muted admin-user-group-empty">{emptyMessage}</p>;
  }

  return (
    <div className="modal-table-wrap admin-users-table-wrap">
      <table className="admin-users-table">
        <thead>
          <tr>
            <th className="admin-users-select-cell">
              <input
                type="checkbox"
                checked={allPageSelected}
                ref={(input) => {
                  if (input) input.indeterminate = somePageSelected;
                }}
                onChange={(e) => onToggleSelectAll(pageUserIds, e.target.checked)}
                aria-label="Select all on this page"
              />
            </th>
            <th>First name</th>
            <th>Last name</th>
            <th>Email</th>
            {showYearColumn && <th className="admin-users-year-cell">Year</th>}
            {showCourseColumn && <th className="admin-users-course-cell">Course</th>}
            {showGenderCol && <th className="admin-users-gender-cell">Gender</th>}
            {showSchoolCol && <th className="admin-users-school-cell">School</th>}
            {showActiveColumn && <th className="admin-users-active-cell">Active</th>}
            {showQaColumn && <th className="admin-users-qa-cell">QA</th>}
            {showEnabledColumn && <th className="admin-users-enabled-cell">Enabled</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isStudentRow = user.role === "STUDENT";
            const isAdminRow = user.role === "SUPERADMIN";
            const isSelected = selectedIds.has(user.id);

            return (
              <tr key={user.id} className={isSelected ? "admin-users-selected-row" : undefined}>
                <td className="admin-users-select-cell">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelect(user.id, e.target.checked)}
                    aria-label={`Select ${formatDisplayNamePart(user.firstName)} ${formatDisplayNamePart(user.lastName)}`}
                  />
                </td>
                <td>{formatDisplayNamePart(user.firstName)}</td>
                <td>{formatDisplayNamePart(user.lastName)}</td>
                <td>{user.email}</td>
                {showYearColumn && (
                  <td className="admin-users-year-cell">
                    {isStudentRow ? user.yearLevel ?? "—" : "—"}
                  </td>
                )}
                {showCourseColumn && (
                  <td className="admin-users-course-cell">
                    {isStudentRow ? (
                      <span title={formatProgramCourse(user.programCourse)}>
                        {abbreviateProgramCourse(user.programCourse)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {showGenderCol && (
                  <td className="admin-users-gender-cell">
                    {isStudentRow ? formatGender(user.gender) : "—"}
                  </td>
                )}
                {showSchoolCol && (
                  <td className="admin-users-school-cell">
                    {isStudentRow ? formatSchoolType(user.schoolType) : "—"}
                  </td>
                )}
                {showActiveColumn && (
                  <td className="admin-users-active-cell">
                    {isAdminRow ? (
                      "—"
                    ) : user.isActive ? (
                      <span title="Active">Y</span>
                    ) : (
                      <span title="Inactive">N</span>
                    )}
                  </td>
                )}
                {showQaColumn && (
                  <td className="admin-users-qa-cell">
                    {user.qaUnlimited ? "Y" : "—"}
                  </td>
                )}
                {showEnabledColumn && (
                  <td className="admin-users-enabled-cell">
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
                        {user.isActive ? "Disable" : "Enable"} {formatDisplayNamePart(user.firstName)}{" "}
                        {formatDisplayNamePart(user.lastName)}
                      </span>
                    </label>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
