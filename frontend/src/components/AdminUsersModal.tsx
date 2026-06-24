import { useEffect, useMemo, useState } from "react";
import AdminUserGroupTable, { type UserEditDraft, type UserRow } from "./AdminUserGroupTable";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import SegmentedControl from "./SegmentedControl";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseYearLevel } from "../lib/constants";
import { compareByName, formatFullName } from "../lib/names";
import { formatProgramCourse, maxYearLevelForProgram, type ProgramCourseId } from "../lib/programCourse";
import { duplicateUserEmailMessage, findDuplicateUserEmail } from "../lib/userEmailDuplicates";
import { toastDeleted, toastRestored, toastUpdated } from "../lib/toastMessages";
import { useConfirm } from "../lib/confirm";
import { useProgramCourseOptions } from "../lib/programs";

type RoleTab = "students" | "teachers" | "admins";

const ROLE_SEGMENTS = [
  { id: "students", label: "Students" },
  { id: "teachers", label: "Teachers" },
  { id: "admins", label: "Admin" },
] as const;

const STUDENT_YEAR_SEGMENTS = [
  { id: "1", label: "First Year" },
  { id: "2", label: "Second Year" },
  { id: "3", label: "Third Year" },
  { id: "4", label: "Fourth Year" },
  { id: "5", label: "Fifth Year" },
  { id: "archive", label: "Archive" },
] as const;

interface Props {
  token: string | null;
  onClose?: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
  inline?: boolean;
}

export default function AdminUsersModal({
  token,
  onClose,
  onUpdated,
  inline = false,
}: Props) {
  const confirm = useConfirm();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<RoleTab>("students");
  const [studentYearTab, setStudentYearTab] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<UserEditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const courseOptions = useProgramCourseOptions();
  const [bulkProgramCourse, setBulkProgramCourse] = useState<ProgramCourseId | "">("");
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(
    onClose ?? (() => {}),
    !inline
  );

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api<{ users: UserRow[] }>("/users", {}, token);
      setUsers(data.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      onUpdated(message, true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {});
  }, [token]);

  useEffect(() => {
    if (courseOptions.length === 0) return;
    setBulkProgramCourse((current) => {
      if (current && courseOptions.some((option) => option.id === current)) {
        return current;
      }
      return courseOptions[0].id;
    });
  }, [courseOptions]);

  const students = useMemo(
    () => users.filter((u) => u.role === "STUDENT").sort(compareByName),
    [users]
  );
  const teachers = useMemo(
    () => users.filter((u) => u.role === "TEACHER").sort(compareByName),
    [users]
  );
  const admins = useMemo(
    () => users.filter((u) => u.role === "SUPERADMIN").sort(compareByName),
    [users]
  );

  function studentsForView(year: number, programCourse = bulkProgramCourse) {
    return students.filter((user) => {
      if (!user.isActive) return false;
      if (user.yearLevel !== year) return false;
      if (currentUser?.role === "SUPERADMIN") {
        return user.programCourse === programCourse;
      }
      return true;
    });
  }

  function archivedStudentsForView(programCourse = bulkProgramCourse) {
    return students.filter((user) => {
      if (user.isActive) return false;
      if (currentUser?.role === "SUPERADMIN") {
        return user.programCourse === programCourse;
      }
      return true;
    });
  }

  const isArchiveView = roleTab === "students" && studentYearTab === "archive";

  const visibleUsers = useMemo(() => {
    if (roleTab === "teachers") return teachers;
    if (roleTab === "admins") return admins;
    if (isArchiveView) return archivedStudentsForView();
    return studentsForView(Number(studentYearTab));
  }, [roleTab, studentYearTab, teachers, admins, students, bulkProgramCourse, currentUser?.role, isArchiveView]);

  const usersResetKey = `${roleTab}-${studentYearTab}-${bulkProgramCourse}-${visibleUsers.length}`;
  const {
    paginatedItems: paginatedUsers,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(visibleUsers, { resetKey: usersResetKey });

  const tableGroup = useMemo(() => {
    if (roleTab === "students") return "student" as const;
    if (roleTab === "teachers") return "teacher" as const;
    return "admin" as const;
  }, [roleTab]);

  const bulkMaxYear = maxYearLevelForProgram(bulkProgramCourse);

  const rolloverPromoteChain = useMemo(() => {
    const parts = [];
    for (let year = bulkMaxYear - 1; year >= 1; year -= 1) {
      parts.push(`Y${year}→Y${year + 1}`);
    }
    return parts.join(", ");
  }, [bulkMaxYear]);

  const activeYearLabel =
    STUDENT_YEAR_SEGMENTS.find((segment) => segment.id === studentYearTab)?.label ?? "year";

  const countLabel = `${visibleUsers.length} account${visibleUsers.length === 1 ? "" : "s"}`;

  function cancelEditIfHidden(nextUsers: UserRow[]) {
    if (!editingId) return;
    if (!nextUsers.some((user) => user.id === editingId)) {
      setEditingId(null);
      setEditDraft(null);
    }
  }

  function handleRoleTabChange(next: string) {
    const tab = next as RoleTab;
    setRoleTab(tab);
    if (tab === "teachers") cancelEditIfHidden(teachers);
    else if (tab === "admins") cancelEditIfHidden(admins);
    else {
      if (studentYearTab === "archive") {
        cancelEditIfHidden(archivedStudentsForView());
      } else {
        cancelEditIfHidden(studentsForView(Number(studentYearTab)));
      }
    }
  }

  function handleStudentYearChange(next: string) {
    setStudentYearTab(next);
    if (next === "archive") {
      cancelEditIfHidden(archivedStudentsForView());
      return;
    }
    cancelEditIfHidden(studentsForView(Number(next)));
  }

  function handleBulkProgramCourseChange(next: string) {
    setBulkProgramCourse(next);
    if (isArchiveView) {
      cancelEditIfHidden(archivedStudentsForView(next));
      return;
    }
    cancelEditIfHidden(studentsForView(Number(studentYearTab), next));
  }

  async function restoreStudent(user: UserRow) {
    const label = formatFullName(user.firstName, user.lastName);
    const confirmed = await confirm({
      title: "Restore student?",
      message: `Restore "${label}" (${user.email})?\n\nThey will be able to sign in again at incoming year ${user.yearLevel ?? "—"}.`,
      confirmLabel: "Restore",
    });
    if (!confirmed) return;

    setRestoringId(user.id);
    if (editingId === user.id) cancelEdit();

    try {
      await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }, token);
      onUpdated(toastRestored("student", label), false);
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore student";
      onUpdated(message, true);
    } finally {
      setRestoringId(null);
    }
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditDraft({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      yearLevel: user.yearLevel != null ? String(user.yearLevel) : "2",
      programCourse: user.programCourse ?? courseOptions[0]?.id ?? "",
      gender: user.gender ?? "MALE",
      schoolType: user.schoolType ?? "PUBLIC",
      isActive: user.isActive,
      qaUnlimited: user.qaUnlimited,
      password: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;

    const duplicate = findDuplicateUserEmail(users, editDraft.email, id);
    if (duplicate) {
      onUpdated(duplicateUserEmailMessage(duplicate), true);
      return;
    }

    setSavingId(id);

    try {
      await api(
        `/users/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            email: editDraft.email.trim(),
            firstName: editDraft.firstName.trim(),
            lastName: editDraft.lastName.trim(),
            role: editDraft.role,
            yearLevel:
              editDraft.role === "STUDENT"
                ? parseYearLevel(editDraft.yearLevel, editDraft.programCourse)
                : null,
            programCourse: editDraft.role === "STUDENT" ? editDraft.programCourse : null,
            gender: editDraft.role === "STUDENT" ? editDraft.gender : null,
            schoolType: editDraft.role === "STUDENT" ? editDraft.schoolType : null,
            ...(editDraft.role !== "SUPERADMIN" ? { isActive: editDraft.isActive } : {}),
            qaUnlimited: editDraft.role === "STUDENT" ? editDraft.qaUnlimited : false,
            ...(editDraft.password.trim() ? { password: editDraft.password } : {}),
          }),
        },
        token
      );
      const message = toastUpdated(
        "user",
        formatFullName(editDraft.firstName.trim(), editDraft.lastName.trim())
      );
      onUpdated(message, false);
      cancelEdit();
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      onUpdated(message, true);
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(user: UserRow, isActive: boolean) {
    if (user.role !== "SUPERADMIN") return;
    if (currentUser?.id === user.id && !isActive) return;

    const previous = user.isActive;
    setTogglingId(user.id);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive } : u)));

    try {
      await api(
        `/users/${user.id}`,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        token
      );
      const message = toastUpdated(
        "user",
        formatFullName(user.firstName, user.lastName),
        isActive ? "Account enabled." : "Account disabled."
      );
      onUpdated(message, false);
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: previous } : u)));
      const message = err instanceof Error ? err.message : "Failed to update user status";
      onUpdated(message, true);
    } finally {
      setTogglingId(null);
    }
  }

  async function runBulkAction(
    actionKey: string,
    previewPath: string,
    executePath: string,
    body: Record<string, unknown>,
    confirmTitle: string
  ) {
    setBulkBusy(actionKey);
    try {
      const preview = await api<{ message: string; matchCount?: number }>(
        previewPath,
        { method: "POST", body: JSON.stringify(body) },
        token
      );
      const confirmed = await confirm({
        title: confirmTitle,
        message: preview.message,
        confirmLabel: "Continue",
      });
      if (!confirmed) return;

      const result = await api<{
        updatedCount?: number;
        graduatedCount?: number;
        promotedCount?: number;
      }>(executePath, { method: "POST", body: JSON.stringify(body) }, token);
      const count =
        result.updatedCount ?? result.graduatedCount ?? result.promotedCount ?? preview.matchCount ?? 0;
      onUpdated(
        count > 0 ? `Updated ${count} student account${count === 1 ? "" : "s"}.` : "No matching active students.",
        false
      );
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk action failed";
      onUpdated(message, true);
    } finally {
      setBulkBusy(null);
    }
  }

  async function promoteCurrentYear() {
    const fromYearLevel = Number(studentYearTab);
    if (fromYearLevel >= bulkMaxYear) {
      onUpdated(
        `Incoming year ${bulkMaxYear} students should be graduated, not promoted.`,
        true
      );
      return;
    }
    await runBulkAction(
      "promote",
      "/users/bulk/promote/preview",
      "/users/bulk/promote",
      { programCourse: bulkProgramCourse, fromYearLevel },
      `Promote incoming year ${fromYearLevel}?`
    );
  }

  async function graduateFinishedYear() {
    await runBulkAction(
      "graduate",
      "/users/bulk/graduate/preview",
      "/users/bulk/graduate",
      { programCourse: bulkProgramCourse },
      `Archive finished incoming year ${bulkMaxYear}?`
    );
  }

  async function rolloverSchoolYear() {
    setBulkBusy("rollover");
    try {
      const preview = await api<{
        message: string;
        graduate: { matchCount: number };
        promoteSteps: Array<{ fromYearLevel: number; toYearLevel: number; matchCount: number }>;
      }>(
        "/users/bulk/rollover/preview",
        { method: "POST", body: JSON.stringify({ programCourse: bulkProgramCourse }) },
        token
      );
      const stepSummary = preview.promoteSteps
        .filter((step) => step.matchCount > 0)
        .map((step) => `Y${step.fromYearLevel}→Y${step.toYearLevel}: ${step.matchCount}`)
        .join("\n");
      const confirmed = await confirm({
        title: "Run school-year rollover?",
        message: `${preview.message}${stepSummary ? `\n\n${stepSummary}` : ""}\n\nRuns in order: archive Y${bulkMaxYear}, then ${rolloverPromoteChain} — avoids mixed year levels.`,
        confirmLabel: "Run rollover",
      });
      if (!confirmed) return;

      const result = await api<{ graduatedCount: number; promotedCount: number }>(
        "/users/bulk/rollover",
        { method: "POST", body: JSON.stringify({ programCourse: bulkProgramCourse }) },
        token
      );
      onUpdated(
        `Rollover complete: archived ${result.graduatedCount}, promoted ${result.promotedCount}.`,
        false
      );
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rollover failed";
      onUpdated(message, true);
    } finally {
      setBulkBusy(null);
    }
  }

  async function deleteUser(user: UserRow) {
    if (currentUser?.id === user.id || user.role === "SUPERADMIN") return;

    const label = formatFullName(user.firstName, user.lastName);
    const confirmed = await confirm({
      title: "Delete user?",
      message: `Delete user "${label}" (${user.email})?\n\nThis cannot be undone. Exam and retake records for this account will also be removed.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingId(user.id);
    if (editingId === user.id) cancelEdit();

    try {
      await api(`/users/${user.id}`, { method: "DELETE" }, token);
      const message = toastDeleted("user", formatFullName(user.firstName, user.lastName));
      onUpdated(message, false);
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      onUpdated(message, true);
    } finally {
      setDeletingId(null);
    }
  }

  const emptyMessage =
    roleTab === "students"
      ? isArchiveView
        ? currentUser?.role === "SUPERADMIN"
          ? `No archived ${formatProgramCourse(bulkProgramCourse)} students.`
          : "No archived students."
        : currentUser?.role === "SUPERADMIN"
          ? `No ${formatProgramCourse(bulkProgramCourse)} students in ${activeYearLabel.toLowerCase()}.`
          : `No students in ${activeYearLabel.toLowerCase()}.`
      : roleTab === "teachers"
        ? "No teacher accounts."
        : roleTab === "admins"
          ? "No admin accounts."
          : "No accounts found.";

  const panel = (
    <>
      <div className={inline ? "saved-panel-header" : "modal-header"}>
        <div>
          <h2>Manage Users</h2>
          <p className="muted section-desc">
            Browse by role and year. Leave password blank when editing to keep the current
            password.
          </p>
        </div>
        <div className="saved-panel-header-end">
          <span className="muted saved-panel-count">{loading ? "Loading..." : countLabel}</span>
          {!inline && (
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <div className="admin-users-modal-nav">
        <SegmentedControl segments={[...ROLE_SEGMENTS]} value={roleTab} onChange={handleRoleTabChange} />
        {roleTab === "students" && (
          <div className="admin-users-modal-subnav">
            <SegmentedControl
              segments={[...STUDENT_YEAR_SEGMENTS]}
              value={studentYearTab}
              onChange={handleStudentYearChange}
            />
          </div>
        )}
      </div>

      {roleTab === "students" && currentUser?.role === "SUPERADMIN" && !isArchiveView ? (
        <div className="admin-users-bulk-panel card">
          <div className="admin-users-bulk-copy">
            <h3>School year actions</h3>
            <p className="muted section-desc">
              Promote one incoming year at a time, or run a full rollover that archives finished Y
              {bulkMaxYear} then moves {rolloverPromoteChain} in one step so year levels stay
              aligned.
            </p>
          </div>
          <div className="admin-users-bulk-controls">
            <label className="admin-users-bulk-field">
              Program
              <select
                value={bulkProgramCourse}
                onChange={(event) => handleBulkProgramCourseChange(event.target.value)}
              >
                {courseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-users-bulk-buttons">
              {Number(studentYearTab) < bulkMaxYear ? (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={bulkBusy != null}
                  onClick={() => promoteCurrentYear().catch(() => {})}
                >
                  {bulkBusy === "promote"
                    ? "Promoting…"
                    : `Promote Y${studentYearTab} → Y${Number(studentYearTab) + 1}`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn secondary"
                disabled={bulkBusy != null}
                onClick={() => graduateFinishedYear().catch(() => {})}
              >
                {bulkBusy === "graduate" ? "Archiving…" : `Archive finished Y${bulkMaxYear}`}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={bulkBusy != null}
                onClick={() => rolloverSchoolYear().catch(() => {})}
              >
                {bulkBusy === "rollover" ? "Running…" : `Rollover ${formatProgramCourse(bulkProgramCourse)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isArchiveView ? (
        <div className="admin-users-archive-panel card">
          <div className="admin-users-archive-copy">
            <h3>Finished students</h3>
            <p className="muted section-desc">
              Students archived after graduating or school-year rollover. Restore an account to
              re-enable login while keeping exam history.
            </p>
          </div>
          {currentUser?.role === "SUPERADMIN" ? (
            <label className="admin-users-bulk-field">
              Program
              <select
                value={bulkProgramCourse}
                onChange={(event) => handleBulkProgramCourseChange(event.target.value)}
              >
                {courseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="admin-users-modal-body">
        {loading ? (
          <p className="muted">Loading users...</p>
        ) : (
          <>
            <ListPanel
              footer={
                <ModalPagination
                  page={page}
                  totalPages={totalPages}
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  totalItems={totalItems}
                  onPageChange={setPage}
                />
              }
            >
              <AdminUserGroupTable
                users={paginatedUsers}
                allUsers={users}
                group={tableGroup}
                hideYearColumn={roleTab === "students" && !isArchiveView}
                archiveMode={isArchiveView}
                emptyMessage={emptyMessage}
                editingId={editingId}
                editDraft={editDraft}
                savingId={savingId}
                deletingId={deletingId}
                togglingId={togglingId}
                restoringId={restoringId}
                currentUserId={currentUser?.id ?? null}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onDelete={deleteUser}
                onToggleActive={toggleActive}
                onRestore={restoreStudent}
                setEditDraft={setEditDraft}
              />
            </ListPanel>
          </>
        )}
      </div>
    </>
  );

  if (inline) {
    return <section className="card saved-panel admin-users-modal">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("admin-users-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
