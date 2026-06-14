import { useEffect, useMemo, useState } from "react";
import AdminUserGroupTable, { type UserEditDraft, type UserRow } from "./AdminUserGroupTable";
import ModalPagination from "./ModalPagination";
import SegmentedControl from "./SegmentedControl";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseYearLevel } from "../lib/constants";
import { compareByName, formatFullName } from "../lib/names";
import { DEFAULT_PROGRAM_COURSE } from "../lib/programCourse";
import { toastDeleted, toastUpdated } from "../lib/toastMessages";

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
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose ?? (() => {}));

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
  const visibleUsers = useMemo(() => {
    if (roleTab === "teachers") return teachers;
    if (roleTab === "admins") return admins;
    const year = Number(studentYearTab);
    return students.filter((user) => user.yearLevel === year);
  }, [roleTab, studentYearTab, teachers, admins, students]);

  const usersResetKey = `${roleTab}-${studentYearTab}-${visibleUsers.length}`;
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
      ? `No students in ${activeYearLabel.toLowerCase()}.`
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

      <div className="admin-users-modal-body">
        {loading ? (
          <p className="muted">Loading users...</p>
        ) : (
          <>
            <div className="admin-users-toolbar">
              <ModalPagination
                variant="inline"
                page={page}
                totalPages={totalPages}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalItems={totalItems}
                onPageChange={setPage}
              />
            </div>
            <AdminUserGroupTable
              users={paginatedUsers}
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
