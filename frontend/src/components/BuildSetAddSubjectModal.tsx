import { useMemo, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
}

interface Topic {
  id: string;
  name: string;
  subjectId: string;
}

export type BuildSetSubjectSelection = {
  subjectId: string;
  selectedTopicIds: string[];
};

interface Props {
  subjects: Subject[];
  topics: Topic[];
  questions: Array<{ subjectId: string; topicId: string | null }>;
  isPreboard: boolean;
  hint: string;
  onClose: () => void;
  onAdd: (selections: BuildSetSubjectSelection[]) => boolean;
}

export default function BuildSetAddSubjectModal({
  subjects,
  topics,
  questions,
  isPreboard,
  hint,
  onClose,
  onAdd,
}: Props) {
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(() => new Set());
  const [topicSelectionBySubject, setTopicSelectionBySubject] = useState<Record<string, Set<string>>>(
    {}
  );
  const [error, setError] = useState("");
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(onClose, true);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [subjects]
  );

  const selectedSubjects = useMemo(
    () => sortedSubjects.filter((subject) => selectedSubjectIds.has(subject.id)),
    [sortedSubjects, selectedSubjectIds]
  );

  function topicsForSubject(subjectId: string) {
    return topics
      .filter((topic) => topic.subjectId === subjectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function topicQuestionCount(subjectId: string, topicId: string) {
    return questions.filter(
      (question) => question.subjectId === subjectId && question.topicId === topicId
    ).length;
  }

  function subjectQuestionCount(subjectId: string) {
    return questions.filter((question) => question.subjectId === subjectId).length;
  }

  function toggleSubject(subjectId: string, checked: boolean) {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(subjectId);
      else next.delete(subjectId);
      return next;
    });
    setTopicSelectionBySubject((prev) => {
      const next = { ...prev };
      if (checked) {
        next[subjectId] = new Set(topicsForSubject(subjectId).map((topic) => topic.id));
      } else {
        delete next[subjectId];
      }
      return next;
    });
    setError("");
  }

  function setAllSubjects(checked: boolean) {
    if (!checked) {
      setSelectedSubjectIds(new Set());
      setTopicSelectionBySubject({});
      setError("");
      return;
    }

    const nextSubjects = new Set(sortedSubjects.map((subject) => subject.id));
    const nextTopics: Record<string, Set<string>> = {};
    for (const subject of sortedSubjects) {
      nextTopics[subject.id] = new Set(topicsForSubject(subject.id).map((topic) => topic.id));
    }
    setSelectedSubjectIds(nextSubjects);
    setTopicSelectionBySubject(nextTopics);
    setError("");
  }

  function toggleTopic(subjectId: string, topicId: string, checked: boolean) {
    setTopicSelectionBySubject((prev) => {
      const current = prev[subjectId] ?? new Set<string>();
      const next = new Set(current);
      if (checked) next.add(topicId);
      else next.delete(topicId);
      return { ...prev, [subjectId]: next };
    });
    setError("");
  }

  function setAllTopics(checked: boolean) {
    setTopicSelectionBySubject((prev) => {
      const next = { ...prev };
      for (const subject of selectedSubjects) {
        const subjectTopics = topicsForSubject(subject.id);
        if (subjectTopics.length === 0) continue;
        next[subject.id] = checked
          ? new Set(subjectTopics.map((topic) => topic.id))
          : new Set();
      }
      return next;
    });
    setError("");
  }

  function handleAdd() {
    if (selectedSubjectIds.size === 0) {
      setError("Select at least one subject.");
      return;
    }

    const selections: BuildSetSubjectSelection[] = [];

    for (const subject of selectedSubjects) {
      const subjectTopics = topicsForSubject(subject.id);
      const selectedTopicIds = [...(topicSelectionBySubject[subject.id] ?? new Set<string>())];

      if (subjectTopics.length > 0 && selectedTopicIds.length === 0) {
        setError(`${subject.courseCode}: select at least one topic.`);
        return;
      }

      selections.push({ subjectId: subject.id, selectedTopicIds });
    }

    const added = onAdd(selections);
    if (added) requestClose();
  }

  const selectedSubjectCount = selectedSubjectIds.size;
  const addLabel =
    selectedSubjectCount > 0
      ? `Add ${selectedSubjectCount} subject${selectedSubjectCount === 1 ? "" : "s"}`
      : "Add subjects";

  return portal(
    <div
      className={`${overlayClass} build-set-add-subject-overlay`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={panelClass("build-set-add-subject-modal")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-set-add-subject-title"
      >
        <div className="modal-header build-set-add-subject-header">
          <div>
            <h2 id="build-set-add-subject-title">Add subjects</h2>
            <p className="muted">{hint}</p>
          </div>
          <button type="button" className="btn secondary" onClick={requestClose}>
            Close
          </button>
        </div>

        <div className="build-set-add-subject-body">
          {sortedSubjects.length === 0 ? (
            <p className="muted build-set-add-subject-empty">No subjects available to add.</p>
          ) : (
            <div className="build-set-add-subject-layout">
              <div className="build-set-add-subject-panel">
                <div className="build-set-add-subject-panel-header">
                  <span className="build-set-add-subject-panel-label">Subjects</span>
                  <div className="build-set-add-subject-topics-actions">
                    <button type="button" className="btn-link" onClick={() => setAllSubjects(true)}>
                      Select all
                    </button>
                    <button type="button" className="btn-link" onClick={() => setAllSubjects(false)}>
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="build-set-add-subject-subject-list" aria-label="Subjects">
                  {sortedSubjects.map((subject) => (
                    <li key={subject.id}>
                      <label className="checkbox-label build-set-add-subject-check-option">
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.has(subject.id)}
                          onChange={(event) => toggleSubject(subject.id, event.target.checked)}
                        />
                        <span className="build-set-add-subject-subject-code">
                          {subject.courseCode}
                        </span>
                        <span className="build-set-add-subject-subject-title">
                          {subject.courseTitle}
                        </span>
                        {isPreboard ? (
                          <span className="build-set-add-subject-subject-meta">
                            Yr {subject.yearLevel}
                          </span>
                        ) : null}
                        <span className="build-set-add-subject-subject-meta">
                          {subjectQuestionCount(subject.id)} Q
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="build-set-add-subject-panel">
                <div className="build-set-add-subject-panel-header">
                  <span className="build-set-add-subject-panel-label">Topics</span>
                  {selectedSubjects.some((subject) => topicsForSubject(subject.id).length > 0) ? (
                    <div className="build-set-add-subject-topics-actions">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setAllTopics(true)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setAllTopics(false)}
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedSubjects.length === 0 ? (
                  <p className="muted build-set-add-subject-topics-placeholder">
                    Select one or more subjects to choose topics.
                  </p>
                ) : (
                  <div className="build-set-add-subject-topic-list">
                    {selectedSubjects.map((subject) => {
                      const subjectTopics = topicsForSubject(subject.id);
                      const selectedTopics =
                        topicSelectionBySubject[subject.id] ?? new Set<string>();

                      return (
                        <section key={subject.id} className="build-set-add-subject-topic-group">
                          <h3 className="build-set-add-subject-topic-group-title">
                            <span className="build-set-add-subject-subject-code">
                              {subject.courseCode}
                            </span>
                            <span>{subject.courseTitle}</span>
                          </h3>
                          {subjectTopics.length === 0 ? (
                            <p className="muted build-set-add-subject-topic-group-empty">
                              No topics — questions come from the whole subject.
                            </p>
                          ) : (
                            <ul className="build-set-add-subject-topic-group-list">
                              {subjectTopics.map((topic) => (
                                <li key={topic.id}>
                                  <label className="checkbox-label build-set-add-subject-check-option">
                                    <input
                                      type="checkbox"
                                      checked={selectedTopics.has(topic.id)}
                                      onChange={(event) =>
                                        toggleTopic(subject.id, topic.id, event.target.checked)
                                      }
                                    />
                                    <span className="build-set-add-subject-topic-name">
                                      {topic.name}
                                    </span>
                                    <span className="build-set-add-subject-topic-count muted">
                                      {topicQuestionCount(subject.id, topic.id)} questions
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error ? <p className="error build-set-add-subject-error">{error}</p> : null}

        <div className="modal-footer build-set-add-subject-footer">
          <button type="button" className="btn secondary" onClick={requestClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleAdd}
            disabled={sortedSubjects.length === 0}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
