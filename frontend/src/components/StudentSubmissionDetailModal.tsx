import { useEffect, useMemo, useState } from "react";
import { DomainProgressionLineChart } from "./charts/AnalyticsCharts";
import DiagnosticResultProfile, { type DiagnosticProfile } from "./DiagnosticResultProfile";
import SegmentedControl from "./SegmentedControl";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { usePagination } from "../hooks/usePagination";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import type { DomainProgressionSeries } from "../lib/domainProgressionChart";
import { formatFullName } from "../lib/names";
import {
  printSubmissionDomainsReport,
  printSubmissionExamReport,
  printSubmissionProfileReport,
} from "../lib/printSubmissionReport";

interface SubmissionAnswer {
  id: string;
  text: string;
  subject: string;
  topic: string | null;
  difficulty: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean | null;
}

interface SubmissionDetail {
  id: string;
  student: { id: string; firstName: string; lastName: string; email: string; yearLevel: number | null };
  questionSet: {
    name: string;
    yearLevel: number;
    type: string;
    passThreshold: number;
  };
  attemptType: string;
  attemptNumber: number;
  score: number | null;
  totalItems: number;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  profileVariant: "diagnostic" | "comprehensive" | null;
  profile: DiagnosticProfile | null;
  domainProgression: {
    hasAnyData: boolean;
    domains: DomainProgressionSeries[];
  };
  answers: SubmissionAnswer[];
}

type SubmissionTab = "exam" | "profile" | "domains";

interface Props {
  submissionId: string;
  token: string | null;
  onClose: () => void;
}

function formatAttemptType(type: string) {
  return type === "RETAKE" ? "Retake" : "First";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function SubmissionAnswersTable({
  answers,
  startIndex = 1,
}: {
  answers: SubmissionAnswer[];
  startIndex?: number;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Subject</th>
          <th>Selected</th>
          <th>Correct</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {answers.map((answer, index) => (
          <tr key={answer.id}>
            <td>{startIndex + index}</td>
            <td>
              <div className="submission-question-text">{answer.text}</div>
              {answer.topic && <div className="muted table-subtext">{answer.topic}</div>}
            </td>
            <td>{answer.subject}</td>
            <td>{answer.selectedOption ?? "—"}</td>
            <td>{answer.correctOption}</td>
            <td>
              {answer.isCorrect == null ? "—" : answer.isCorrect ? "Correct" : "Wrong"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubmissionSummary({ submission, isDiagnostic }: { submission: SubmissionDetail; isDiagnostic: boolean }) {
  return (
    <div className="submission-detail-summary">
      {isDiagnostic ? (
        <div>
          <strong>Diagnostic profile complete</strong>
          <div className="muted">
            Score is recorded internally ({submission.score ?? 0} / {submission.totalItems},{" "}
            {submission.percentage?.toFixed(1) ?? "0.0"}%) but not shown to the student as
            pass/fail.
          </div>
        </div>
      ) : (
        <>
          <div>
            <strong>
              {submission.score ?? 0} / {submission.totalItems}
            </strong>{" "}
            ({submission.percentage?.toFixed(1) ?? "0.0"}%)
          </div>
          <div className={submission.passed ? "success" : "error"}>
            {submission.passed ? "Passed" : "Failed"} · pass threshold{" "}
            {submission.questionSet.passThreshold}%
          </div>
        </>
      )}
      <div className="muted">
        {formatAttemptType(submission.attemptType)} attempt #{submission.attemptNumber} ·{" "}
        {formatExamType(submission.questionSet.type)} · submitted{" "}
        {submission.submittedAt ? formatDate(submission.submittedAt) : "—"}
      </div>
    </div>
  );
}

export default function StudentSubmissionDetailModal({ submissionId, token, onClose }: Props) {
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SubmissionTab>("exam");
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose);

  useEffect(() => {
    setLoading(true);
    setError("");
    setActiveTab("exam");

    api<{ submission: SubmissionDetail }>(`/analytics/submissions/${submissionId}`, {}, token)
      .then((data) => setSubmission(data.submission))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load submission"))
      .finally(() => setLoading(false));
  }, [submissionId, token]);

  const answers = submission?.answers ?? [];
  const {
    paginatedItems: paginatedAnswers,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(answers, { resetKey: submissionId });

  const studentName = submission
    ? formatFullName(submission.student.firstName, submission.student.lastName)
    : "";
  const isDiagnostic = submission?.questionSet.type === "DIAGNOSTIC";
  const hasProfile = Boolean(submission?.profile);
  const profileVariant = submission?.profileVariant ?? (isDiagnostic ? "diagnostic" : "comprehensive");
  const profileTabLabel = profileVariant === "diagnostic" ? "Diagnostic profile" : "Exam evaluation";

  const tabSegments = useMemo(() => {
    const segments: Array<{ id: SubmissionTab; label: string }> = [
      { id: "exam", label: "Exam responses" },
    ];
    if (hasProfile) {
      segments.push({ id: "profile", label: profileTabLabel });
    }
    segments.push({ id: "domains", label: "Domain progression" });
    return segments;
  }, [hasProfile, profileTabLabel]);

  useEffect(() => {
    if (!hasProfile && activeTab === "profile") {
      setActiveTab("exam");
    }
  }, [activeTab, hasProfile]);

  function buildPrintInput() {
    if (!submission) return null;
    return {
      studentName,
      studentEmail: submission.student.email,
      yearLevel: submission.student.yearLevel,
      questionSetName: submission.questionSet.name,
      questionSetType: submission.questionSet.type,
      attemptType: submission.attemptType,
      attemptNumber: submission.attemptNumber,
      submittedAt: submission.submittedAt,
      score: submission.score,
      totalItems: submission.totalItems,
      percentage: submission.percentage,
      passed: submission.passed,
      passThreshold: submission.questionSet.passThreshold,
      answers: submission.answers,
      profile: submission.profile,
      profileVariant: submission.profileVariant,
      domainProgression: submission.domainProgression,
    };
  }

  function handlePrint() {
    const printInput = buildPrintInput();
    if (!printInput) return;

    if (activeTab === "profile") {
      printSubmissionProfileReport(printInput);
      return;
    }

    if (activeTab === "domains") {
      printSubmissionDomainsReport(printInput);
      return;
    }

    printSubmissionExamReport(printInput);
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div
        className={panelClass("student-submission-detail-modal")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Exam Submission</h2>
            {submission && (
              <p className="muted">
                {studentName} · Year {submission.student.yearLevel ?? "—"} ·{" "}
                {submission.questionSet.name}
              </p>
            )}
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading submission...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : submission ? (
          <>
            <div className="student-submission-toolbar">
              {tabSegments.length > 1 ? (
                <SegmentedControl
                  segments={tabSegments}
                  value={activeTab}
                  onChange={(tab) => setActiveTab(tab as SubmissionTab)}
                  scrollable
                />
              ) : null}
              <button type="button" className="btn secondary analytics-print-btn" onClick={handlePrint}>
                Print
              </button>
            </div>

            <div className="student-submission-detail-body">
              <div
                className={`submission-tab-panel${activeTab === "exam" ? "" : " is-hidden"}`}
                aria-hidden={activeTab !== "exam"}
              >
                <div className="submission-tab-scroll">
                  <SubmissionSummary submission={submission} isDiagnostic={isDiagnostic} />

                  <section className="submission-answers-section">
                    <h3 className="submission-answers-heading">Question responses</h3>
                    <ListPanel
                      footer={
                        <ModalPagination
                          page={page}
                          totalPages={totalPages}
                          pageStart={pageStart}
                          pageEnd={pageEnd}
                          totalItems={totalItems}
                          onPageChange={setPage}
                        />
                      }
                    >
                      <div className="modal-table-wrap student-submission-answers-table">
                        <SubmissionAnswersTable
                          answers={paginatedAnswers}
                          startIndex={pageStart}
                        />
                      </div>
                    </ListPanel>
                  </section>
                </div>
              </div>

              {hasProfile && submission.profile ? (
                <div
                  className={`submission-tab-panel${activeTab === "profile" ? "" : " is-hidden"}`}
                  aria-hidden={activeTab !== "profile"}
                >
                  <div className="submission-tab-scroll">
                    <section className="submission-profile-section diagnostic-profile-card">
                      <h3>{profileTabLabel}</h3>
                      <DiagnosticResultProfile
                        profile={submission.profile}
                        variant={profileVariant ?? "diagnostic"}
                        reportMode
                      />
                    </section>
                  </div>
                </div>
              ) : null}

              <div
                className={`submission-tab-panel${activeTab === "domains" ? "" : " is-hidden"}`}
                aria-hidden={activeTab !== "domains"}
              >
                <div className="submission-tab-scroll">
                  <section className="submission-domains-section">
                    <h3>Domain progression</h3>
                    <p className="muted section-desc">
                      Cognitive domain scores from Year 1 through Year 4. Each line shows how this
                      student performed in one L1–L6 domain across incoming years.
                    </p>
                    <DomainProgressionLineChart domains={submission.domainProgression.domains} />
                  </section>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
