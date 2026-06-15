import { useEffect, useState } from "react";

export function useChartOrder(storageKey: string, defaultOrder: readonly string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [...defaultOrder];

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [...defaultOrder];

      const allowed = new Set(defaultOrder);
      const valid = parsed.filter((id): id is string => typeof id === "string" && allowed.has(id));
      const missing = defaultOrder.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    } catch {
      return [...defaultOrder];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(order));
  }, [order, storageKey]);

  return [order, setOrder] as const;
}
