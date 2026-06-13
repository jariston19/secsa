import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AdminUserGroupTable, { type UserEditDraft, type UserRow } from "./AdminUserGroupTable";
import SegmentedControl from "./SegmentedControl";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseYearLevel } from "../lib/constants";
import { compareByName, formatFullName } from "../lib/names";
import { DEFAULT_PROGRAM_COURSE } from "../lib/programCourse";

type RoleTab = "all" | "students" | "teachers" | "admins";

const ROLE_SEGMENTS = [
  { id: "all", label: "All" },
  { id: "students", label: "Students" },
  { id: "teachers", label: "Teachers" },
  { id: "admins", label: "Admin" },
] as const;

const STUDENT_YEAR_SEGMENTS = [
  { id: "1", label: "First Year" },
  { id: "2", label: "Second Year" },
  { id: "3", label: "Third Year" },
  { id: "4", label: "Fourth Year" },
] as const;

const ROLE_ORDER: Record<UserRow["role"], number> = {
  STUDENT: 0,
  TEACHER: 1,
  SUPERADMIN: 2,
};

interface Props {
  token: string | null;
  onClose: () => void;
  onUpdated: (message: string, isError?: boolean) => void;
}

export default function AdminUsersModal({ token, onClose, onUpdated }: Props) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<RoleTab>("all");
  const [studentYearTab, setStudentYearTab] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<UserEditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

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
  const allUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
        return roleDiff !== 0 ? roleDiff : compareByName(a, b);
      }),
    [users]
  );

  const visibleUsers = useMemo(() => {
    if (roleTab === "all") return allUsers;
    if (roleTab === "teachers") return teachers;
    if (roleTab === "admins") return admins;
    const year = Number(studentYearTab);
    return students.filter((user) => user.yearLevel === year);
  }, [roleTab, studentYearTab, allUsers, teachers, admins, students]);

  const tableGroup = useMemo(() => {
    if (roleTab === "all") return "all" as const;
    if (roleTab === "students") return "student" as const;
    if (roleTab === "teachers") return "teacher" as const;
    return "admin" as const;
  }, [roleTab]);

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
    if (tab === "all") cancelEditIfHidden(allUsers);
    else if (tab === "teachers") cancelEditIfHidden(teachers);
    else if (tab === "admins") cancelEditIfHidden(admins);
    else {
      const year = Number(studentYearTab);
      cancelEditIfHidden(students.filter((user) => user.yearLevel === year));
    }
  }

  function handleStudentYearChange(next: string) {
    setStudentYearTab(next);
    const year = Number(next);
    cancelEditIfHidden(students.filter((user) => user.yearLevel === year));
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditDraft({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      yearLevel: user.yearLevel != null ? String(user.yearLevel) : "2",
      programCourse: user.programCourse ?? DEFAULT_PROGRAM_COURSE,
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
            yearLevel: editDraft.role === "STUDENT" ? parseYearLevel(editDraft.yearLevel) : null,
            programCourse: editDraft.role === "STUDENT" ? editDraft.programCourse : null,
            ...(editDraft.role !== "SUPERADMIN" ? { isActive: editDraft.isActive } : {}),
            qaUnlimited: editDraft.role === "STUDENT" ? editDraft.qaUnlimited : false,
            ...(editDraft.password.trim() ? { password: editDraft.password } : {}),
          }),
        },
        token
      );
      const message = "User updated.";
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
      const message = isActive ? "User enabled." : "User disabled.";
      onUpdated(message, false);
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: previous } : u)));
      const message = err instanceof Error ? err.message : "Failed to update user status";
      onUpdated(message, true);
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteUser(user: UserRow) {
    if (currentUser?.id === user.id || user.role === "SUPERADMIN") return;

    const label = formatFullName(user.firstName, user.lastName);
    const confirmed = window.confirm(
      `Delete user "${label}" (${user.email})?\n\nThis cannot be undone. Exam and retake records for this account will also be removed.`
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    if (editingId === user.id) cancelEdit();

    try {
      await api(`/users/${user.id}`, { method: "DELETE" }, token);
      const message = "User deleted.";
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
      ? `No students in ${activeYearLabel.toLowerCase()}.`
      : roleTab === "teachers"
        ? "No teacher accounts."
        : roleTab === "admins"
          ? "No admin accounts."
          : "No accounts found.";

  return createPortal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("admin-users-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Users</h2>
            <p className="muted">
              Browse by role and year. Leave password blank when editing to keep the current
              password.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
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
          <span className="muted admin-users-modal-count">{countLabel}</span>
        </div>

        <div className="admin-users-modal-body">
          {loading ? (
            <p className="muted">Loading users...</p>
          ) : (
            <AdminUserGroupTable
              users={visibleUsers}
              group={tableGroup}
              hideYearColumn={roleTab === "students"}
              emptyMessage={emptyMessage}
              editingId={editingId}
              editDraft={editDraft}
              savingId={savingId}
              deletingId={deletingId}
              togglingId={togglingId}
              currentUserId={currentUser?.id ?? null}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={deleteUser}
              onToggleActive={toggleActive}
              setEditDraft={setEditDraft}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
