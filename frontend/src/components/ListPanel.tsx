import { useRef, type ReactNode } from "react";
import { ListPanelScrollContext } from "./ListPanelContext";

interface Props {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  rowHeight?: "default" | "tall";
}

export default function ListPanel({
  children,
  footer,
  className,
  rowHeight = "default",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollClass = [
    "list-panel-scroll",
    rowHeight === "tall" ? "list-panel-scroll-tall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ListPanelScrollContext.Provider value={scrollRef}>
      <div className={`list-panel${className ? ` ${className}` : ""}`}>
        <div ref={scrollRef} className={scrollClass}>
          {children}
        </div>
        {footer ? <div className="list-panel-footer">{footer}</div> : null}
      </div>
    </ListPanelScrollContext.Provider>
  );
}
