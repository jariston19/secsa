import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  DEFAULT_PROGRAM_COURSE,
  syncProgramCourses,
  type ProgramRecord,
} from "./programCourse";

interface ProgramsContextValue {
  programs: ProgramRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertProgram: (program: ProgramRecord) => void;
  removeProgram: (id: string) => void;
  defaultSlug: string;
}

const ProgramsContext = createContext<ProgramsContextValue | null>(null);

export function ProgramsProvider({ children }: { children: ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const applyPrograms = useCallback((nextPrograms: ProgramRecord[]) => {
    syncProgramCourses(nextPrograms);
    setPrograms(nextPrograms);
  }, []);

  const loadPrograms = useCallback(async () => {
    if (!token) {
      applyPrograms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ programs: ProgramRecord[] }>("/programs", {}, token);
      applyPrograms(data.programs);
    } catch {
      applyPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [token, applyPrograms]);

  const refresh = useCallback(() => loadPrograms(), [loadPrograms]);

  const removeProgram = useCallback(
    (id: string) => {
      setPrograms((prev) => {
        const next = prev.filter((program) => program.id !== id);
        syncProgramCourses(next);
        return next;
      });
    },
    []
  );

  const upsertProgram = useCallback((program: ProgramRecord) => {
    setPrograms((prev) => {
      const next = [...prev.filter((item) => item.id !== program.id), program].sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      syncProgramCourses(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadPrograms();
  }, [authLoading, loadPrograms]);

  const defaultSlug = useMemo(() => {
    if (programs.some((program) => program.slug === DEFAULT_PROGRAM_COURSE)) {
      return DEFAULT_PROGRAM_COURSE;
    }
    return programs[0]?.slug ?? DEFAULT_PROGRAM_COURSE;
  }, [programs]);

  const value = useMemo(
    () => ({ programs, loading, refresh, upsertProgram, removeProgram, defaultSlug }),
    [programs, loading, refresh, upsertProgram, removeProgram, defaultSlug]
  );

  return <ProgramsContext.Provider value={value}>{children}</ProgramsContext.Provider>;
}

export function usePrograms() {
  const context = useContext(ProgramsContext);
  if (!context) {
    throw new Error("usePrograms must be used within ProgramsProvider");
  }
  return context;
}

export function useProgramCourseOptions() {
  const { programs } = usePrograms();

  return useMemo(
    () =>
      programs.map((program) => ({
        id: program.slug,
        programId: program.id,
        label: program.label,
        abbr: program.abbr,
      })),
    [programs]
  );
}
