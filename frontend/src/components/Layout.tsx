import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../lib/auth";
import { formatFullName } from "../lib/names";
import { formatProgramCourse } from "../lib/programCourse";
import { SidebarProvider, useSidebar } from "../lib/sidebar";

const SUPERADMIN_SECTIONS = [
  { id: "admin", label: "Admin", path: "/admin" },
  { id: "teach", label: "Teacher Tools", path: "/teach" },
] as const;

const EXPANDED_MENUS_KEY = "secsa-sidebar-expanded-menus";

function readExpandedMenus() {
  const menus = new Set<string>();
  if (typeof window === "undefined") return menus;
  try {
    const stored = localStorage.getItem(EXPANDED_MENUS_KEY);
    if (stored) {
      for (const id of JSON.parse(stored) as string[]) {
        menus.add(id);
      }
    }
  } catch {
    // ignore invalid storage
  }
  return menus;
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LayoutShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { open, toggle, close, pageNav } = useSidebar();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(readExpandedMenus);
  const navRef = useRef<HTMLElement>(null);
  const navScrollTopRef = useRef(0);

  useEffect(() => {
    if (!pageNav?.value || !pageNav.menus?.length) return;
    const menuIds = pageNav.menus
      .filter(
        (menu) =>
          pageNav.value === menu.id ||
          pageNav.value.startsWith(`${menu.id}-`) ||
          menu.items.some((item) => item.id === pageNav.value)
      )
      .map((menu) => menu.id);
    if (menuIds.length === 0) return;

    setExpandedMenus((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of menuIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      localStorage.setItem(EXPANDED_MENUS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [pageNav?.value, pageNav?.menus]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    if (!open) {
      navScrollTopRef.current = nav.scrollTop;
      return;
    }

    nav.scrollTop = navScrollTopRef.current;
  }, [open]);

  const superadminSection = location.pathname.startsWith("/teach") ? "teach" : "admin";

  function formatRole(role: string) {
    if (role === "SUPERADMIN") return "Superadmin";
    if (role === "TEACHER") return "Teacher";
    if (role === "STUDENT") return "Student";
    return role;
  }

  function navigateSection(path: string) {
    navigate(path);
    if (window.innerWidth < 1024) close();
  }

  function handlePageNavChange(id: string) {
    pageNav?.onChange(id);
    if (window.innerWidth < 1024) close();
  }

  function handlePageAction(action: () => void) {
    action();
    if (window.innerWidth < 1024) close();
  }

  function toggleMenu(menuId: string) {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      localStorage.setItem(EXPANDED_MENUS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function renderPageMenus() {
    if (!pageNav?.menus) return null;

    return pageNav.menus.map((menu) => {
      const expanded = expandedMenus.has(menu.id);
      return (
        <div key={menu.id} className="sidebar-menu">
          <button
            type="button"
            className={`sidebar-link sidebar-menu-toggle${expanded ? " expanded" : ""}`}
            onClick={() => toggleMenu(menu.id)}
            aria-expanded={expanded}
          >
            <span>{menu.label}</span>
            <span className="sidebar-menu-chevron" aria-hidden />
          </button>
          <div className={`sidebar-submenu${expanded ? " is-open" : ""}`}>
            <div className="sidebar-submenu-inner">
              {menu.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-link sidebar-sublink${
                    pageNav.value === item.id ? " active" : ""
                  }`}
                  onClick={() => handlePageNavChange(item.id)}
                >
                  <span>{item.label}</span>
                  {item.badge != null && (
                    <span className="sidebar-nav-badge">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    });
  }

  function renderNavItems(items: NonNullable<typeof pageNav>["segments"]) {
    if (!pageNav) return null;

    return items.map((segment) => (
      <button
        key={segment.id}
        type="button"
        className={`sidebar-link sidebar-link-row${
          pageNav.value === segment.id ? " active" : ""
        }${segment.badge != null && segment.badge > 0 ? " sidebar-link-has-badge" : ""}`}
        onClick={() => handlePageNavChange(segment.id)}
      >
        <span>{segment.label}</span>
        {segment.badge != null && segment.badge > 0 ? (
          <span className="sidebar-nav-badge sidebar-nav-badge-alert">{segment.badge}</span>
        ) : null}
      </button>
    ));
  }

  function renderPageSegments() {
    if (!pageNav) return null;
    return renderNavItems(pageNav.segments);
  }

  function renderTrailingSegments() {
    if (!pageNav?.trailingSegments?.length) return null;
    return renderNavItems(pageNav.trailingSegments);
  }

  return (
    <div className={`app-shell${open ? " sidebar-open" : ""}`}>
      <div
        className="sidebar-backdrop"
        aria-hidden
        onClick={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />

      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <img className="sidebar-logo" src="/secsa.png" alt="SECSA" />
          <div className="sidebar-brand-text">
            <h1>SECSA Exam Platform</h1>
            <p className="muted">
              {user ? formatFullName(user.firstName, user.lastName) : ""}
              {user?.role ? ` · ${formatRole(user.role)}` : ""}
            </p>
            {(user?.yearLevel || user?.programCourse) && (
              <p className="muted sidebar-meta">
                {user?.yearLevel ? `Incoming Year ${user.yearLevel}` : ""}
                {user?.yearLevel && user?.programCourse ? " · " : ""}
                {user?.programCourse ? formatProgramCourse(user.programCourse) : ""}
              </p>
            )}
          </div>
        </div>

        <nav className="sidebar-nav" ref={navRef} onScroll={() => {
          if (navRef.current) navScrollTopRef.current = navRef.current.scrollTop;
        }}>
          {user?.role === "SUPERADMIN" && (
            <div className="sidebar-section">
              <p className="sidebar-section-label">Workspace</p>
              {SUPERADMIN_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`sidebar-link${superadminSection === section.id ? " active" : ""}`}
                  onClick={() => navigateSection(section.path)}
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}

          {pageNav && (
            <div className="sidebar-section">
              {pageNav.menusFirst && renderPageMenus()}
              {renderPageSegments()}
              {!pageNav.menusFirst && renderPageMenus()}
              {renderTrailingSegments()}
              {pageNav.actions?.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`sidebar-link sidebar-link-action${
                    action.alert ? " sidebar-link-alert" : ""
                  }${pageNav.value === action.id ? " active" : ""}`}
                  onClick={() => handlePageNavChange(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <button type="button" className="btn btn-text sidebar-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggle}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
          >
            <SidebarToggleIcon />
          </button>
          <span className="app-topbar-title">SECSA Exam Platform</span>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutShell />
    </SidebarProvider>
  );
}
