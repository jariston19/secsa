import { useEffect, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";

interface QuestionRow {
  questionId: string;
  subject: string;
  topic: string | null;
  difficulty: string;
  correctRate: number;
  total: number;
}

interface Props {
  token: string | null;
  onClose: () => void;
}

export default function QuestionPerformanceModal({ token, onClose }: Props) {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { requestClose, overlayClass, panelClass } = useAnimatedModal(onClose);

  useEffect(() => {
    setLoading(true);
    setError("");

    api<{ questions: QuestionRow[] }>("/analytics/questions", {}, token)
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load questions"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("question-performance-modal")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Question Performance</h2>
            <p className="muted">
              Sorted by lowest correct rate first. Use this to spot weak or misleading items.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="question-performance-modal-body">
          {loading ? (
            <p className="muted">Loading question performance...</p>
          ) : questions.length === 0 ? (
            <p className="muted">No question data yet.</p>
          ) : (
            <div className="table-responsive question-performance-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Correct %</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.questionId}>
                      <td>{question.subject}</td>
                      <td>{question.topic ?? "—"}</td>
                      <td>{question.difficulty}</td>
                      <td>{question.correctRate.toFixed(1)}%</td>
                      <td>{question.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
