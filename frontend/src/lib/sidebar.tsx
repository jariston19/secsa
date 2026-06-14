import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type SidebarPageAction = {
  id: string;
  label: string;
  onClick: () => void;
  alert?: boolean;
};

export type SidebarPageNavItem = {
  id: string;
  label: string;
  badge?: number;
};

export type SidebarPageMenu = {
  id: string;
  label: string;
  items: SidebarPageNavItem[];
};

export type SidebarPageNav = {
  segments: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  actions?: SidebarPageAction[];
  menus?: SidebarPageMenu[];
  menusFirst?: boolean;
};

type SidebarContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  pageNav: SidebarPageNav | null;
  setPageNav: (nav: SidebarPageNav | null) => void;
  setPageNavValue: (value: string) => void;
  patchPageNav: (patch: Partial<SidebarPageNav>) => void;
};

const STORAGE_KEY = "secsa-sidebar-open";

const SidebarContext = createContext<SidebarContextValue | null>(null);

function readStoredOpen() {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return window.innerWidth >= 1024;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(readStoredOpen);
  const [pageNav, setPageNavState] = useState<SidebarPageNav | null>(null);

  const persistOpen = useCallback((next: boolean) => {
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const close = useCallback(() => {
    persistOpen(false);
  }, [persistOpen]);

  const setPageNav = useCallback((nav: SidebarPageNav | null) => {
    setPageNavState(nav);
  }, []);

  const setPageNavValue = useCallback((value: string) => {
    setPageNavState((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const patchPageNav = useCallback((patch: Partial<SidebarPageNav>) => {
    setPageNavState((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <SidebarContext.Provider
      value={{ open, toggle, close, pageNav, setPageNav, setPageNavValue, patchPageNav }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
