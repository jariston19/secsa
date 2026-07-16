import { useCallback, useEffect, useState } from "react";
import AddUserForm from "../components/AddUserForm";
import AdminUsersModal from "../components/AdminUsersModal";
import ProgramCoursesSettings from "../components/ProgramCoursesSettings";
import BackupRestorePanel from "../components/BackupRestorePanel";
import TabPanel from "../components/TabPanel";
import AnalyticsReports from "../components/AnalyticsReports";
import GroupAnalytics from "../components/GroupAnalytics";
import IndividualStudentAnalytics from "../components/IndividualStudentAnalytics";
import AnalyticsOverview from "../components/AnalyticsOverview";
import AnalyticsDemographics from "../components/AnalyticsDemographics";
import AnalyticsRetention from "../components/AnalyticsRetention";
import AnalyticsTrends from "../components/AnalyticsTrends";
import AnalyticsRankings from "../components/AnalyticsRankings";
import AnalyticsExamStatus, {
  type ExamStatusNavigationRequest,
} from "../components/AnalyticsExamStatus";
import AnalyticsExamResults from "../components/AnalyticsExamResults";
import QuestionPerformanceModal from "../components/QuestionPerformanceModal";
import StudentSubmissionDetailModal from "../components/StudentSubmissionDetailModal";
import StudentSubmissionsSection from "../components/StudentSubmissionsSection";
import { useAuth } from "../lib/auth";
import { AnalyticsSeasonProvider } from "../lib/analyticsSeason";
import { useSidebar } from "../lib/sidebar";
import { useToast } from "../lib/toast";

type Tab =
  | "users-add"
  | "users-manage"
  | "settings-programs"
  | "settings-backup"
  | "analytics-overview"
  | "analytics-trends"
  | "analytics-demographics"
  | "analytics-retention"
  | "analytics-rankings"
  | "analytics-exam-status"
  | "analytics-exam-results"
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
    items: [
      { id: "settings-programs", label: "Program Courses" },
      { id: "settings-backup", label: "Backup / Restore" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { id: "analytics-overview", label: "Overview" },
      { id: "analytics-trends", label: "Trends" },
      { id: "analytics-demographics", label: "Demographics" },
      { id: "analytics-retention", label: "Retention" },
      { id: "analytics-rankings", label: "Rankings" },
      { id: "analytics-exam-status", label: "Exam Status" },
      { id: "analytics-exam-results", label: "Exam Results" },
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
  const [showQuestionPerformance, setShowQuestionPerformance] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [studentViewRequest, setStudentViewRequest] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [examStatusRequest, setExamStatusRequest] =
    useState<ExamStatusNavigationRequest | null>(null);

  useEffect(() => {
    if (activeTab !== "submissions") {
      setSelectedSubmissionId(null);
    }
    if (activeTab !== "analytics-question") {
      setShowQuestionPerformance(false);
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

  const showMessage = useCallback(
    (text: string, isError = false) => {
      if (isError) toast.error(text);
      else toast.success(text);
    },
    [toast]
  );

  return (
    <AnalyticsSeasonProvider token={token}>
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

      {activeTab === "settings-backup" && (
        <BackupRestorePanel token={token} onUpdated={showMessage} />
      )}

      {activeTab === "analytics-overview" && (
        <AnalyticsOverview
          token={token}
          onOpenExamStatus={(request) => {
            setExamStatusRequest(request);
            setActiveTab("analytics-exam-status");
          }}
        />
      )}

      {activeTab === "analytics-trends" && <AnalyticsTrends token={token} />}

      {activeTab === "analytics-demographics" && <AnalyticsDemographics token={token} />}

      {activeTab === "analytics-retention" && <AnalyticsRetention token={token} />}

      {activeTab === "analytics-rankings" && (
        <AnalyticsRankings
          token={token}
          onViewStudent={(studentId, name) => {
            setStudentViewRequest({ id: studentId, name });
            setActiveTab("analytics-student");
          }}
          onOpenExamStatus={(request) => {
            setExamStatusRequest(request);
            setActiveTab("analytics-exam-status");
          }}
        />
      )}

      {activeTab === "analytics-exam-status" && (
        <AnalyticsExamStatus
          token={token}
          navigationRequest={examStatusRequest}
          onNavigationConsumed={() => setExamStatusRequest(null)}
        />
      )}

      {activeTab === "analytics-exam-results" && <AnalyticsExamResults token={token} />}

      {activeTab === "analytics-group" && <GroupAnalytics token={token} />}

      {activeTab === "analytics-student" && (
        <IndividualStudentAnalytics
          token={token}
          viewRequest={studentViewRequest}
          onViewRequestConsumed={() => setStudentViewRequest(null)}
        />
      )}

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
    </AnalyticsSeasonProvider>
  );
}
