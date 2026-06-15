import type { ReactNode } from "react";

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
  const scrollClass = [
    "list-panel-scroll",
    rowHeight === "tall" ? "list-panel-scroll-tall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`list-panel${className ? ` ${className}` : ""}`}>
      <div className={scrollClass}>{children}</div>
      {footer ? <div className="list-panel-footer">{footer}</div> : null}
    </div>
  );
}
