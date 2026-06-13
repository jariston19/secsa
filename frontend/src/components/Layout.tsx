import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import SegmentedControl from "./SegmentedControl";
import { useAuth } from "../lib/auth";
import { formatFullName } from "../lib/names";
import { formatProgramCourse } from "../lib/programCourse";

const SUPERADMIN_SECTIONS = [
  { id: "admin", label: "Admin" },
  { id: "teach", label: "Teacher Tools" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const superadminSection = location.pathname.startsWith("/teach") ? "teach" : "admin";

  function formatRole(role: string) {
    if (role === "SUPERADMIN") return "Superadmin";
    if (role === "TEACHER") return "Teacher";
    if (role === "STUDENT") return "Student";
    return role;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>SECSA Exam Platform</h1>
          <p className="muted">
            {user ? formatFullName(user.firstName, user.lastName) : ""} · {user?.role ? formatRole(user.role) : ""}
            {user?.yearLevel ? ` · Incoming Year ${user.yearLevel}` : ""}
            {user?.programCourse ? ` · ${formatProgramCourse(user.programCourse)}` : ""}
          </p>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="btn btn-text" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {user?.role === "SUPERADMIN" && (
        <nav className="role-nav">
          <SegmentedControl
            segments={SUPERADMIN_SECTIONS}
            value={superadminSection}
            onChange={(id) => navigate(id === "teach" ? "/teach" : "/admin")}
          />
        </nav>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
