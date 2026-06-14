import { useCallback, useEffect, useState } from "react";
import AddUserForm from "../components/AddUserForm";
import AdminUsersModal from "../components/AdminUsersModal";
import ProgramCoursesSettings from "../components/ProgramCoursesSettings";
import TabPanel from "../components/TabPanel";
import AnalyticsReports from "../components/AnalyticsReports";
import GroupAnalytics from "../components/GroupAnalytics";
import IndividualStudentAnalytics from "../components/IndividualStudentAnalytics";
import AnalyticsOverview, { type OverviewDashboardData } from "../components/AnalyticsOverview";
import QuestionPerformanceModal from "../components/QuestionPerformanceModal";
import StudentSubmissionDetailModal from "../components/StudentSubmissionDetailModal";
import StudentSubmissionsSection from "../components/StudentSubmissionsSection";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSidebar } from "../lib/sidebar";
import { useToast } from "../lib/toast";

type Tab =
  | "users-add"
  | "users-manage"
  | "settings-programs"
  | "analytics-overview"
  | "analytics-group"
  | "analytics-student"
  | "analytics-question"
  | "submissions";

const TAB_SEGMENTS = [{ id: "submissions", label: "Submissions" }];

const ADMIN_PAGE_MENUS = [
  {
    id: "users",
    label: "Users",
    items: [
      { id: "users-add", label: "Add" },
      { id: "users-manage", label: "Manage" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ id: "settings-programs", label: "Program Courses" }],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { id: "analytics-overview", label: "Overview" },
      { id: "analytics-group", label: "Group" },
      { id: "analytics-student", label: "Student" },
      { id: "analytics-question", label: "Question" },
    ],
  },
] as const;

export default function AdminDashboard() {
  const { token } = useAuth();
  const { setPageNav, setPageNavValue } = useSidebar();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("users-add");
  const [overview, setOverview] = useState<OverviewDashboardData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showQuestionPerformance, setShowQuestionPerformance] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    try {
      const o = await api<OverviewDashboardData>("/analytics/overview", {}, token);
      setOverview(o);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "analytics-overview") return;
    if (overview) return;
    refreshAnalytics().catch((err) => {
      toast.error(err.message);
    });
  }, [token, activeTab, overview]);

  useEffect(() => {
    if (activeTab !== "submissions") {
      setSelectedSubmissionId(null);
    }
  }, [activeTab]);

  const handlePageNavChange = useCallback((id: string) => {
    setActiveTab(id as Tab);
  }, []);

  useEffect(() => {
    setPageNav({
      segments: TAB_SEGMENTS,
      value: activeTab,
      onChange: handlePageNavChange,
      menusFirst: true,
      menus: ADMIN_PAGE_MENUS.map((menu) => ({
        ...menu,
        items: menu.items.map((item) => ({ ...item })),
      })),
    });

    return () => setPageNav(null);
  }, [handlePageNavChange, setPageNav]);

  useEffect(() => {
    setPageNavValue(activeTab);
  }, [activeTab, setPageNavValue]);

  function showMessage(text: string, isError = false) {
    if (isError) toast.error(text);
    else toast.success(text);
  }

  return (
    <div className="admin-dashboard">
      <div className="tab-panel">
      <TabPanel activeTab={activeTab}>
      {activeTab === "users-add" && <AddUserForm token={token} onCreated={showMessage} />}

      {activeTab === "users-manage" && (
        <AdminUsersModal inline token={token} onUpdated={showMessage} />
      )}

      {activeTab === "settings-programs" && (
        <ProgramCoursesSettings token={token} onCreated={showMessage} />
      )}

      {activeTab === "analytics-overview" && (
      <div className="grid">
      {analyticsLoading && !overview ? (
        <p className="muted">Loading analytics...</p>
      ) : overview ? (
        <AnalyticsOverview data={overview} />
      ) : null}
      </div>
      )}

      {activeTab === "analytics-group" && <GroupAnalytics token={token} />}

      {activeTab === "analytics-student" && <IndividualStudentAnalytics token={token} />}

      {activeTab === "analytics-question" && (
        <AnalyticsReports
          token={token}
          lens="question"
          onOpenQuestionPerformance={() => setShowQuestionPerformance(true)}
        />
      )}

      {activeTab === "submissions" && (
      <div className="grid">
        <StudentSubmissionsSection
          token={token}
          onViewSubmission={setSelectedSubmissionId}
        />
      </div>
      )}
      </TabPanel>
      </div>

      {showQuestionPerformance && (
        <QuestionPerformanceModal
          token={token}
          onClose={() => setShowQuestionPerformance(false)}
        />
      )}

      {selectedSubmissionId && (
        <StudentSubmissionDetailModal
          submissionId={selectedSubmissionId}
          token={token}
          onClose={() => setSelectedSubmissionId(null)}
        />
      )}
    </div>
  );
}
