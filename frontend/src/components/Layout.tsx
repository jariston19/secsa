import { Outlet } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../lib/auth";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>SECSA Exam Platform</h1>
          <p className="muted">
            {user?.name} · {user?.role}
            {user?.yearLevel ? ` · Incoming Year ${user.yearLevel}` : ""}
          </p>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="btn btn-text" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
