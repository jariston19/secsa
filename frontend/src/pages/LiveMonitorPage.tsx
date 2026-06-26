import { useEffect } from "react";
import LiveExamMonitorSection from "../components/LiveExamMonitorSection";
import { useAuth } from "../lib/auth";
import { useSidebar } from "../lib/sidebar";

export default function LiveMonitorPage() {
  const { token } = useAuth();
  const { setPageNav } = useSidebar();

  useEffect(() => {
    setPageNav(null);
    return () => setPageNav(null);
  }, [setPageNav]);

  return (
    <div className="live-monitor-page">
      <LiveExamMonitorSection token={token} />
    </div>
  );
}
