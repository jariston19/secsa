import { useEffect, useMemo, useState } from "react";
import AdminUserEditModal from "./AdminUserEditModal";
import AdminUserGroupTable, { type UserEditDraft, type UserRow } from "./AdminUserGroupTable";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import SegmentedControl from "./SegmentedControl";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseYearLevel } from "../lib/constants";
import { compareByName, formatDisplayFullName, formatFullName } from "../lib/names";
import { formatProgramCourse, maxYearLevelForProgram, type ProgramCourseId } from "../lib/programCourse";
import { duplicateUserEmailMessage, findDuplicateUserEmail } from "../lib/userEmailDuplicates";
import { toastDeleted, toastRestored, toastUpdated } from "../lib/toastMessages";
import { useConfirm } from "../lib/confirm";
import { useProgramCourseOptions } from "../lib/programs";
import type { GenderId, SchoolTypeId } from "../lib/studentDemographics";

type RoleTab = "students" | "teachers" | "admins";
type GenderFilter = "all" | GenderId;
type SchoolFilter = "all" | SchoolTypeId;

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

const GENDER_FILTER_KEY = "secsa-admin-gender-filter";
const SCHOOL_FILTER_KEY = "secsa-admin-school-filter";

function readStoredFilter<T extends string>(key: string, allowed: readonly T[], defaultValue: T) {
  if (typeof window === "undefined") return defaultValue;
  const stored = localStorage.getItem(key);
  return stored && allowed.includes(stored as T) ? (stored as T) : defaultValue;
}

function matchesUserSearch(user: UserRow, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

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
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editDraft, setEditDraft] = useState<UserEditDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const courseOptions = useProgramCourseOptions();
  const [bulkProgramCourse, setBulkProgramCourse] = useState<ProgramCourseId | "">("");
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(() =>
    readStoredFilter(GENDER_FILTER_KEY, ["all", "MALE", "FEMALE"] as const, "all")
  );
  const [schoolFilter, setSchoolFilter] = useState<SchoolFilter>(() =>
    readStoredFilter(SCHOOL_FILTER_KEY, ["all", "PUBLIC", "PRIVATE"] as const, "all")
  );
  const [searchQuery, setSearchQuery] = useState("");
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

  function matchesStudentDemographics(user: UserRow) {
    if (genderFilter !== "all" && user.gender !== genderFilter) return false;
    if (schoolFilter !== "all" && user.schoolType !== schoolFilter) return false;
    return true;
  }

  function studentsForView(year: number, programCourse = bulkProgramCourse) {
    return students.filter((user) => {
      if (!user.isActive) return false;
      if (user.yearLevel !== year) return false;
      if (!matchesStudentDemographics(user)) return false;
      if (currentUser?.role === "SUPERADMIN") {
        return user.programCourse === programCourse;
      }
      return true;
    });
  }

  function archivedStudentsForView(programCourse = bulkProgramCourse) {
    return students.filter((user) => {
      if (user.isActive) return false;
      if (!matchesStudentDemographics(user)) return false;
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
  }, [
    roleTab,
    studentYearTab,
    teachers,
    admins,
    students,
    bulkProgramCourse,
    currentUser?.role,
    isArchiveView,
    genderFilter,
    schoolFilter,
  ]);

  const filteredUsers = useMemo(
    () => visibleUsers.filter((user) => matchesUserSearch(user, searchQuery)),
    [visibleUsers, searchQuery]
  );

  const usersResetKey = `${roleTab}-${studentYearTab}-${bulkProgramCourse}-${genderFilter}-${schoolFilter}-${searchQuery}-${filteredUsers.length}`;
  const {
    paginatedItems: paginatedUsers,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(filteredUsers, { resetKey: usersResetKey });

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

  const countLabel = searchQuery.trim()
    ? `${filteredUsers.length} of ${visibleUsers.length} account${visibleUsers.length === 1 ? "" : "s"}`
    : `${visibleUsers.length} account${visibleUsers.length === 1 ? "" : "s"}`;

  const selectedUsers = useMemo(
    () => visibleUsers.filter((user) => selectedIds.has(user.id)),
    [visibleUsers, selectedIds]
  );

  const selectedCount = selectedUsers.length;

  const deletableSelected = useMemo(
    () =>
      selectedUsers.filter(
        (user) => user.id !== currentUser?.id && user.role !== "SUPERADMIN"
      ),
    [selectedUsers, currentUser?.id]
  );

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelect(userId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  function toggleSelectAll(userIds: string[], selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const userId of userIds) {
        if (selected) next.add(userId);
        else next.delete(userId);
      }
      return next;
    });
  }

  function cancelEditIfHidden(nextUsers: UserRow[]) {
    if (!editingUser) return;
    if (!nextUsers.some((user) => user.id === editingUser.id)) {
      cancelEdit();
    }
  }

  function handleSelectionContextChange() {
    clearSelection();
    cancelEdit();
  }

  function handleRoleTabChange(next: string) {
    const tab = next as RoleTab;
    setRoleTab(tab);
    setSearchQuery("");
    handleSelectionContextChange();
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
    handleSelectionContextChange();
    if (next === "archive") {
      cancelEditIfHidden(archivedStudentsForView());
      return;
    }
    cancelEditIfHidden(studentsForView(Number(next)));
  }

  function handleBulkProgramCourseChange(next: string) {
    setBulkProgramCourse(next);
    handleSelectionContextChange();
    if (isArchiveView) {
      cancelEditIfHidden(archivedStudentsForView(next));
      return;
    }
    cancelEditIfHidden(studentsForView(Number(studentYearTab), next));
  }

  function handleGenderFilterChange(next: GenderFilter) {
    setGenderFilter(next);
    localStorage.setItem(GENDER_FILTER_KEY, next);
    handleSelectionContextChange();
    if (isArchiveView) {
      cancelEditIfHidden(archivedStudentsForView());
      return;
    }
    if (roleTab === "students") {
      cancelEditIfHidden(studentsForView(Number(studentYearTab)));
    }
  }

  function handleSchoolFilterChange(next: SchoolFilter) {
    setSchoolFilter(next);
    localStorage.setItem(SCHOOL_FILTER_KEY, next);
    handleSelectionContextChange();
    if (isArchiveView) {
      cancelEditIfHidden(archivedStudentsForView());
      return;
    }
    if (roleTab === "students") {
      cancelEditIfHidden(studentsForView(Number(studentYearTab)));
    }
  }

  function startEdit(user: UserRow) {
    setEditingUser(user);
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
    setEditingUser(null);
    setEditDraft(null);
  }

  function handleToolbarEdit() {
    if (selectedUsers.length !== 1) return;
    startEdit(selectedUsers[0]);
  }

  async function saveEdit() {
    if (!editDraft || !editingUser) return;

    const duplicate = findDuplicateUserEmail(users, editDraft.email, editingUser.id);
    if (duplicate) {
      onUpdated(duplicateUserEmailMessage(duplicate), true);
      return;
    }

    setSavingId(editingUser.id);

    try {
      await api(
        `/users/${editingUser.id}`,
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
      clearSelection();
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

  async function deleteSelectedUsers() {
    if (deletableSelected.length === 0) return;

    const preview =
      deletableSelected.length === 1
        ? `"${formatDisplayFullName(deletableSelected[0].firstName, deletableSelected[0].lastName)}" (${deletableSelected[0].email})`
        : `${deletableSelected.length} selected accounts`;

    const confirmed = await confirm({
      title: deletableSelected.length === 1 ? "Delete user?" : "Delete selected users?",
      message: `Delete ${preview}?\n\nThis cannot be undone. Exam and retake records for these accounts will also be removed.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    for (const user of deletableSelected) {
      setDeletingId(user.id);
      try {
        await api(`/users/${user.id}`, { method: "DELETE" }, token);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete user";
        onUpdated(message, true);
        setDeletingId(null);
        return;
      }
    }

    onUpdated(
      toastDeleted(
        "user",
        deletableSelected.length === 1
          ? formatDisplayFullName(deletableSelected[0].firstName, deletableSelected[0].lastName)
          : `${deletableSelected.length} accounts`
      ),
      false
    );
    clearSelection();
    cancelEdit();
    setDeletingId(null);
    await loadUsers();
  }

  async function restoreSelectedUsers() {
    if (selectedUsers.length === 0) return;

    const preview =
      selectedUsers.length === 1
        ? `"${formatDisplayFullName(selectedUsers[0].firstName, selectedUsers[0].lastName)}" (${selectedUsers[0].email})`
        : `${selectedUsers.length} selected students`;

    const confirmed = await confirm({
      title: selectedUsers.length === 1 ? "Restore student?" : "Restore selected students?",
      message: `Restore ${preview}?\n\nThey will be able to sign in again.`,
      confirmLabel: "Restore",
    });
    if (!confirmed) return;

    for (const user of selectedUsers) {
      setRestoringId(user.id);
      try {
        await api(
          `/users/${user.id}`,
          { method: "PATCH", body: JSON.stringify({ isActive: true }) },
          token
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to restore student";
        onUpdated(message, true);
        setRestoringId(null);
        return;
      }
    }

    onUpdated(
      toastRestored(
        "student",
        selectedUsers.length === 1
          ? formatDisplayFullName(selectedUsers[0].firstName, selectedUsers[0].lastName)
          : `${selectedUsers.length} students`
      ),
      false
    );
    clearSelection();
    cancelEdit();
    setRestoringId(null);
    await loadUsers();
  }

  const emptyMessage =
    roleTab === "students"
      ? searchQuery.trim()
        ? "No students match your search."
        : isArchiveView
        ? currentUser?.role === "SUPERADMIN"
          ? `No archived ${formatProgramCourse(bulkProgramCourse)} students.`
          : "No archived students."
        : currentUser?.role === "SUPERADMIN"
          ? `No ${formatProgramCourse(bulkProgramCourse)} students in ${activeYearLabel.toLowerCase()}.`
          : `No students in ${activeYearLabel.toLowerCase()}.`
      : roleTab === "teachers"
        ? searchQuery.trim()
          ? "No teachers match your search."
          : "No teacher accounts."
        : roleTab === "admins"
          ? searchQuery.trim()
            ? "No admins match your search."
            : "No admin accounts."
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
        <div className="admin-users-modal-nav-row">
          <SegmentedControl segments={[...ROLE_SEGMENTS]} value={roleTab} onChange={handleRoleTabChange} />
          <label className="admin-users-search">
            Search
            <input
              type="search"
              placeholder="Name or email…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        {roleTab === "students" && (
          <div className="admin-users-modal-subnav">
            <SegmentedControl
              segments={[...STUDENT_YEAR_SEGMENTS]}
              value={studentYearTab}
              onChange={handleStudentYearChange}
            />
            <div className="admin-users-student-filters" role="group" aria-label="Student filters">
              <label className="admin-users-student-filter">
                Gender
                <select
                  value={genderFilter}
                  onChange={(event) => handleGenderFilterChange(event.target.value as GenderFilter)}
                >
                  <option value="all">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </label>
              <label className="admin-users-student-filter">
                School
                <select
                  value={schoolFilter}
                  onChange={(event) => handleSchoolFilterChange(event.target.value as SchoolFilter)}
                >
                  <option value="all">All</option>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {roleTab === "students" && currentUser?.role === "SUPERADMIN" && !isArchiveView ? (
        <div className="admin-users-bulk-panel card">
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
          <div className="admin-users-row-actions">
            {!isArchiveView ? (
              <button
                type="button"
                className="btn secondary"
                disabled={selectedCount !== 1}
                onClick={handleToolbarEdit}
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="btn danger"
              disabled={deletableSelected.length === 0 || deletingId != null}
              onClick={() => deleteSelectedUsers().catch(() => {})}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}

      {isArchiveView && currentUser?.role === "SUPERADMIN" ? (
        <div className="admin-users-bulk-panel card">
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
          <div className="admin-users-row-actions">
            <button
              type="button"
              className="btn"
              disabled={selectedCount === 0 || restoringId != null}
              onClick={() => restoreSelectedUsers().catch(() => {})}
            >
              {restoringId ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={deletableSelected.length === 0 || deletingId != null}
              onClick={() => deleteSelectedUsers().catch(() => {})}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}

      {roleTab !== "students" || currentUser?.role !== "SUPERADMIN" ? (
        <div className="admin-users-bulk-panel card admin-users-bulk-panel-row-actions-only">
          <div className="admin-users-row-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={selectedCount !== 1}
              onClick={handleToolbarEdit}
            >
              Edit
            </button>
            {roleTab !== "admins" ? (
              <button
                type="button"
                className="btn danger"
                disabled={deletableSelected.length === 0 || deletingId != null}
                onClick={() => deleteSelectedUsers().catch(() => {})}
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            ) : null}
          </div>
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
                group={tableGroup}
                hideYearColumn={roleTab === "students" && !isArchiveView}
                emptyMessage={emptyMessage}
                selectedIds={selectedIds}
                togglingId={togglingId}
                currentUserId={currentUser?.id ?? null}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onToggleActive={toggleActive}
              />
            </ListPanel>
            <AdminUserEditModal
              user={editingUser}
              allUsers={users}
              editDraft={editDraft}
              saving={savingId === editingUser?.id}
              group={tableGroup}
              onClose={cancelEdit}
              onSave={() => saveEdit().catch(() => {})}
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
