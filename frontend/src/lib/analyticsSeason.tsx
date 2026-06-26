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

const STORAGE_KEY = "secsa-analytics-exam-year";

export type AnalyticsExamYear = "ALL" | number;

interface AnalyticsSeasonContextValue {
  examYear: AnalyticsExamYear;
  setExamYear: (value: AnalyticsExamYear) => void;
  availableYears: number[];
  loadingYears: boolean;
  appendExamYear: (params: URLSearchParams) => void;
  seasonLabel: string;
}

const AnalyticsSeasonContext = createContext<AnalyticsSeasonContextValue | null>(null);

function readStoredExamYear(): AnalyticsExamYear {
  if (typeof window === "undefined") return "ALL";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored || stored === "ALL") return "ALL";
  const year = Number(stored);
  return Number.isFinite(year) ? year : "ALL";
}

export function AnalyticsSeasonProvider({
  token,
  children,
}: {
  token: string | null;
  children: ReactNode;
}) {
  const [examYear, setExamYearState] = useState<AnalyticsExamYear>(readStoredExamYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);

  useEffect(() => {
    setLoadingYears(true);
    api<{ years: number[] }>("/analytics/seasons", {}, token)
      .then((data) => {
        setAvailableYears(data.years);
        setExamYearState((current) => {
          if (current === "ALL") return current;
          return data.years.includes(current) ? current : "ALL";
        });
      })
      .catch(() => setAvailableYears([]))
      .finally(() => setLoadingYears(false));
  }, [token]);

  const setExamYear = useCallback((value: AnalyticsExamYear) => {
    setExamYearState(value);
    localStorage.setItem(STORAGE_KEY, value === "ALL" ? "ALL" : String(value));
  }, []);

  const appendExamYear = useCallback(
    (params: URLSearchParams) => {
      if (examYear !== "ALL") {
        params.set("examYear", String(examYear));
      }
    },
    [examYear]
  );

  const seasonLabel = useMemo(
    () => (examYear === "ALL" ? "All collected years" : `Exam year ${examYear}`),
    [examYear]
  );

  const value = useMemo(
    () => ({
      examYear,
      setExamYear,
      availableYears,
      loadingYears,
      appendExamYear,
      seasonLabel,
    }),
    [examYear, setExamYear, availableYears, loadingYears, appendExamYear, seasonLabel]
  );

  return (
    <AnalyticsSeasonContext.Provider value={value}>{children}</AnalyticsSeasonContext.Provider>
  );
}

export function useAnalyticsSeason() {
  const context = useContext(AnalyticsSeasonContext);
  if (!context) {
    throw new Error("useAnalyticsSeason must be used within AnalyticsSeasonProvider");
  }
  return context;
}

export function useOptionalAnalyticsSeason() {
  return useContext(AnalyticsSeasonContext);
}
