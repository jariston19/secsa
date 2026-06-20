import { createContext, useContext, type RefObject } from "react";

export const ListPanelScrollContext = createContext<RefObject<HTMLElement | null> | null>(
  null
);

export function useListPanelScrollRef() {
  return useContext(ListPanelScrollContext);
}
