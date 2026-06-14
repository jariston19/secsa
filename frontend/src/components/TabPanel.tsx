import { useEffect, type ReactNode } from "react";

interface Props {
  activeTab: string;
  children: ReactNode;
}

export default function TabPanel({ activeTab, children }: Props) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  return (
    <div key={activeTab} className="tab-content">
      {children}
    </div>
  );
}
