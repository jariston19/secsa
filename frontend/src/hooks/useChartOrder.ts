import { useEffect, useState } from "react";

function mergeChartOrder(saved: string[], defaultOrder: readonly string[]) {
  const allowed = new Set(defaultOrder);
  const result = saved.filter((id): id is string => typeof id === "string" && allowed.has(id));

  if (result.length === 0) return [...defaultOrder];

  for (const id of defaultOrder) {
    if (result.includes(id)) continue;

    const defaultIndex = defaultOrder.indexOf(id);
    let insertAt = result.length;

    for (let i = defaultIndex + 1; i < defaultOrder.length; i++) {
      const afterIndex = result.indexOf(defaultOrder[i]);
      if (afterIndex >= 0) {
        insertAt = afterIndex;
        break;
      }
    }

    if (insertAt === result.length) {
      for (let i = defaultIndex - 1; i >= 0; i--) {
        const beforeIndex = result.indexOf(defaultOrder[i]);
        if (beforeIndex >= 0) {
          insertAt = beforeIndex + 1;
          break;
        }
      }
    }

    result.splice(insertAt, 0, id);
  }

  return result;
}

export function useChartOrder(storageKey: string, defaultOrder: readonly string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [...defaultOrder];

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [...defaultOrder];

      return mergeChartOrder(parsed, defaultOrder);
    } catch {
      return [...defaultOrder];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(order));
  }, [order, storageKey]);

  return [order, setOrder] as const;
}
