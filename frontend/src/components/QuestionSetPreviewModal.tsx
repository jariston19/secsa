import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { formatExamType } from "../lib/constants";
import { useConfirm } from "../lib/confirm";

interface PreviewQuestion {
  id: string;
  text: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  imagePath: string | null;
  topic: string | null;
  subject: string;
}

interface PreviewSection {
  configId: string;
  subject: { courseCode: string; courseTitle: string };
  topic: { name: string } | null;
  required: { easy: number; medium: number; hard: number };
  available: { easy: number; medium: number; hard: number };
  questions: PreviewQuestion[];
}

interface PreviewData {
  questionSet: {
    id: string;
    name: string;
    yearLevel: number;
    type: string;
    status: string;
    totalItems: number;
    _count?: { examAttempts: number };
  };
  sections: PreviewSection[];
  isReady: boolean;
  validationErrors: string[];
}

interface Props {
  setId: string;
  token: string | null;
  onClose: () => void;
  onQuestionRemoved: (questionPreview: string, setName: string) => void;
  onSetDeleted: (name: string) => void;
  onSetArchived: (name: string) => void;
  onSetUndeployed: (name: string) => void;
}

export default function QuestionSetPreviewModal({
  setId,
  token,
  onClose,
  onQuestionRemoved,
  onSetDeleted,
  onSetArchived,
  onSetUndeployed,
}: Props) {
  const confirm = useConfirm();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  const [archivingSet, setArchivingSet] = useState(false);
  const [undeployingSet, setUndeployingSet] = useState(false);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose);

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      const result = await api<PreviewData>(`/question-sets/${setId}/preview`, {}, token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [setId, token]);

  async function undeployQuestionSet() {
    if (!data) return;

    const confirmed = await confirm({
      title: "Cancel deploy?",
      message: `Cancel deploy for "${data.questionSet.name}"?\n\nStudents will no longer be able to start this exam until you deploy a set again.`,
      tone: "warning",
      confirmLabel: "Cancel deploy",
    });
    if (!confirmed) return;

    setUndeployingSet(true);
    setError("");
    try {
      await api(`/question-sets/${setId}/undeploy`, { method: "POST" }, token);
      onSetUndeployed(data.questionSet.name);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel deploy");
    } finally {
      setUndeployingSet(false);
    }
  }

  async function archiveQuestionSet() {
    if (!data) return;

    const confirmed = await confirm({
      title: "Archive question set?",
      message: `Archive question set "${data.questionSet.name}"?\n\nIt will be removed from your Build list. You can restore it later from Archive.`,
      tone: "warning",
      confirmLabel: "Archive",
    });
    if (!confirmed) return;

    setArchivingSet(true);
    setError("");
    try {
      await api(`/question-sets/${setId}/archive`, { method: "POST" }, token);
      onSetArchived(data.questionSet.name);
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive question set");
    } finally {
      setArchivingSet(false);
    }
  }

  async function deleteQuestionSet() {
    if (!data) return;

    const confirmed = await confirm({
      title: "Delete question set?",
      message: `Delete question set "${data.questionSet.name}"?\n\nThis cannot be undone. Questions in the pool will not be deleted.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    setDeletingSet(true);
    setError("");
    try {
      await api(`/question-sets/${setId}`, { method: "DELETE" }, token);
      onSetDeleted(data.questionSet.name);
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete question set");
    } finally {
      setDeletingSet(false);
    }
  }

  async function removeQuestion(questionId: string, questionText: string) {
    const confirmed = await confirm({
      title: "Remove question?",
      message: `Remove this question from the pool?\n\n"${questionText.slice(0, 80)}${questionText.length > 80 ? "…" : ""}"`,
      tone: "danger",
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    setRemovingId(questionId);
    try {
      await api(`/questions/${questionId}`, { method: "DELETE" }, token);
      await loadPreview();
      onQuestionRemoved(questionText, data!.questionSet.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove question");
    } finally {
      setRemovingId(null);
    }
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass()} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Question Set Preview</h2>
            {data && (
              <p className="muted">
                {data.questionSet.name} · Year {data.questionSet.yearLevel} ·{" "}
                {formatExamType(data.questionSet.type)}{" "}
                · {data.questionSet.status}
              </p>
            )}
          </div>
          <div className="modal-actions">
            {data && data.questionSet.status === "DEPLOYED" && (
              <button
                type="button"
                className="btn secondary"
                disabled={undeployingSet}
                onClick={undeployQuestionSet}
              >
                {undeployingSet ? "Cancelling..." : "Cancel Deploy"}
              </button>
            )}
            {data && data.questionSet.status !== "DEPLOYED" && data.questionSet.status !== "ARCHIVED" && (
              <>
                {(data.questionSet._count?.examAttempts ?? 0) === 0 && (
                  <button
                    type="button"
                    className="btn danger"
                    disabled={deletingSet}
                    onClick={deleteQuestionSet}
                  >
                    {deletingSet ? "Deleting..." : "Delete Set"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary"
                  disabled={archivingSet}
                  onClick={archiveQuestionSet}
                >
                  {archivingSet ? "Archiving..." : "Archive Set"}
                </button>
              </>
            )}
            <button type="button" className="btn secondary" onClick={requestClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-scroll-area">
        {loading && <p>Loading preview...</p>}
        {error && <p className="error">{error}</p>}

        {data && !loading && (
          <>
            <div className="preview-summary">
              <span>Total exam items: {data.questionSet.totalItems}</span>
              <span className={data.isReady ? "success" : "error"}>
                {data.isReady ? "Ready to deploy" : "Pool incomplete"}
              </span>
            </div>

            {data.validationErrors.length > 0 && (
              <ul className="validation-errors">
                {data.validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}

            {data.sections.map((section) => {
              const sectionReady =
                section.available.easy >= section.required.easy &&
                section.available.medium >= section.required.medium &&
                section.available.hard >= section.required.hard;

              return (
              <div
                key={section.configId}
                className={`preview-section${sectionReady ? "" : " preview-section-incomplete"}`}
              >
                <h3>
                  {section.subject.courseCode} — {section.subject.courseTitle}
                  {section.topic ? ` / ${section.topic.name}` : " / Whole subject"}
                </h3>
                <p className={`field-hint${sectionReady ? "" : " preview-pool-gap"}`}>
                  Required: {section.required.easy} easy, {section.required.medium} medium,{" "}
                  {section.required.hard} hard · Available: {section.available.easy} easy,{" "}
                  {section.available.medium} medium, {section.available.hard} hard
                  {!sectionReady && " · Pool short"}
                </p>

                {section.questions.length === 0 ? (
                  <p className="muted">No questions in this pool yet.</p>
                ) : (
                  <div className="preview-questions">
                    {section.questions.map((q) => (
                      <div key={q.id} className="preview-question">
                        <div className="preview-question-main">
                          <span className={`difficulty-badge ${q.difficulty.toLowerCase()}`}>
                            {q.difficulty}
                          </span>
                          <p className="preview-question-text">{q.text}</p>
                          <p className="field-hint">
                            Answer: {q.correctOption} · {q.optionA} | {q.optionB} | {q.optionC} |{" "}
                            {q.optionD}
                          </p>
                          {q.imagePath && (
                            <img
                              src={`/uploads/${q.imagePath}`}
                              alt="Question"
                              className="preview-question-image"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={removingId === q.id}
                          onClick={() => removeQuestion(q.id, q.text)}
                        >
                          {removingId === q.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
            })}
          </>
        )}
        </div>
      </div>
    </div>
  );}
