import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";
import { api } from "../lib/api";
import { curriculumYearForStudentYear, formatExamType, parseYearLevel, sanitizeYearInput } from "../lib/constants";
import { difficultyCountsForTotal, expandTopicConfigsWithSubjectDifficulty, type ExamDifficultyCounts } from "../lib/examDifficultyDistribution";
import { buildExamAllocations, type TopicAllocation } from "../lib/examItemDistribution";
import { toastCreated, toastUpdated } from "../lib/toastMessages";
import {
  abbreviateProgramCourse,
  formatProgramCourse,
  SHARED_DIAGNOSTIC_PROGRAM,
  subjectHasProgram,
  type ProgramCourseId,
} from "../lib/programCourse";
import { useProgramCourseOptions } from "../lib/programs";

interface Subject {
  id: string;
  courseCode: string;
  courseTitle: string;
  yearLevel: number;
  programCourses: Array<{ programCourse: ProgramCourseId }>;
}

interface Topic {
  id: string;
  name: string;
  subjectId: string;
}

interface Question {
  id: string;
  subjectId: string;
  topicId: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

interface Props {
  subjects: Subject[];
  topics: Topic[];
  programCourse: ProgramCourseId;
  token: string | null;
  setId?: string | null;
  inline?: boolean;
  onClose?: () => void;
  onCreated: (message: string) => void;
}

function countNum(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function sanitizeCountInput(value: string) {
  return value.replace(/\D/g, "");
}

function topicAllocationKey(subjectId: string, topicId: string | null) {
  return `${subjectId}:${topicId ?? "all"}`;
}

type DifficultyField = "easy" | "medium" | "hard";

const DIFFICULTY_COUNT_KEY: Record<DifficultyField, keyof ExamDifficultyCounts> = {
  easy: "easyCount",
  medium: "mediumCount",
  hard: "hardCount",
};

function difficultyDraftKey(topicKey: string, field: DifficultyField) {
  return `${topicKey}:${field}`;
}

function computeExcludedTopicKeys(
  configs: Array<{ subjectId: string; topicId: string | null }>,
  allTopics: Topic[]
) {
  const includedKeys = new Set(
    configs.map((config) => topicAllocationKey(config.subjectId, config.topicId))
  );
  const subjectIds = [...new Set(configs.map((config) => config.subjectId))];
  const excluded: string[] = [];

  for (const subjectId of subjectIds) {
    const namedTopics = allTopics.filter((topic) => topic.subjectId === subjectId);
    if (namedTopics.length === 0) continue;

    const wholeSubjectIncluded = includedKeys.has(topicAllocationKey(subjectId, null));
    for (const topic of namedTopics) {
      const key = topicAllocationKey(subjectId, topic.id);
      if (wholeSubjectIncluded || !includedKeys.has(key)) {
        excluded.push(key);
      }
    }
  }

  return excluded;
}

export default function BuildQuestionSetModal({
  subjects,
  topics,
  programCourse,
  token,
  setId = null,
  inline = false,
  onClose,
  onCreated,
}: Props) {
  const programCourseOptions = useProgramCourseOptions({ includeSharedDiagnostic: true });
  const isEditing = Boolean(setId);
  const [name, setName] = useState("");
  const [yearLevel, setYearLevel] = useState("2");
  const [setProgramCourse, setSetProgramCourse] = useState<ProgramCourseId>(programCourse);
  const [type, setType] = useState<"COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE">("COMPREHENSIVE");
  const [setStatus, setSetStatus] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [examTotalItems, setExamTotalItems] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addSubjectId, setAddSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(setId));
  const [timeLimitHours, setTimeLimitHours] = useState("1");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("0");
  const [passThreshold, setPassThreshold] = useState("75");
  const [topicItemOverrides, setTopicItemOverrides] = useState<Record<string, number>>({});
  const [topicDifficultyOverrides, setTopicDifficultyOverrides] = useState<
    Record<string, ExamDifficultyCounts>
  >({});
  const [excludedTopicKeys, setExcludedTopicKeys] = useState<string[]>([]);
  const [adjustingSubjectIds, setAdjustingSubjectIds] = useState<string[]>([]);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [difficultyDrafts, setDifficultyDrafts] = useState<Record<string, string>>({});
  const allocationSeedRef = useRef<string | null>(null);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(
    onClose ?? (() => {}),
    !inline
  );

  function handleCancel() {
    requestClose();
  }

  useEffect(() => {
    if (isEditing) return;
    setSetProgramCourse(programCourse);
  }, [programCourse, isEditing]);

  useEffect(() => {
    api<{ questions: Question[] }>("/questions", {}, token)
      .then((data) => setQuestions(data.questions))
      .catch(() => setQuestions([]));
  }, [token]);

  useEffect(() => {
    if (!setId) return;

    setLoading(true);
    setError("");

    api<{
      questionSet: {
        id: string;
        name: string;
        yearLevel: number;
        programCourse: ProgramCourseId;
        type: "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE";
        status: string;
        timeLimitMinutes: number;
        passThreshold: number;
        totalItems: number;
        configs: Array<{
          subjectId: string;
          topicId: string | null;
          easyCount: number;
          mediumCount: number;
          hardCount: number;
          subject: { courseCode: string; courseTitle: string };
          topic: { name: string } | null;
        }>;
      };
    }>(`/question-sets/${setId}/preview`, {}, token)
      .then((data) => {
        const set = data.questionSet;
        setName(set.name);
        setYearLevel(String(set.yearLevel));
        setSetProgramCourse(set.programCourse);
        setType(set.type);
        setSetStatus(set.status);
        setTimeLimitHours(String(Math.floor(set.timeLimitMinutes / 60)));
        setTimeLimitMinutes(String(set.timeLimitMinutes % 60));
        setPassThreshold(String(set.passThreshold));
        setExamTotalItems(String(set.totalItems));
        setSelectedSubjectIds([...new Set(set.configs.map((config) => config.subjectId))]);
        const savedOverrides: Record<string, number> = {};
        const savedDifficultyOverrides: Record<string, ExamDifficultyCounts> = {};
        for (const config of set.configs) {
          const key = topicAllocationKey(config.subjectId, config.topicId);
          savedOverrides[key] = config.easyCount + config.mediumCount + config.hardCount;
          savedDifficultyOverrides[key] = {
            easyCount: config.easyCount,
            mediumCount: config.mediumCount,
            hardCount: config.hardCount,
          };
        }
        setTopicItemOverrides(savedOverrides);
        setTopicDifficultyOverrides(savedDifficultyOverrides);
        setExcludedTopicKeys(computeExcludedTopicKeys(set.configs, topics));
        setAdjustingSubjectIds([]);
        setTopicDrafts({});
        setDifficultyDrafts({});
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load question set");
      })
      .finally(() => setLoading(false));
  }, [setId, token]);

  useEffect(() => {
    allocationSeedRef.current = null;
  }, [setId]);

  const parsedStudentYear = parseYearLevel(yearLevel);
  const curriculumYear = curriculumYearForStudentYear(parsedStudentYear);
  const isIncomingDiagnosticYear = parsedStudentYear === 1;
  const isSharedDiagnostic = type === "DIAGNOSTIC";

  useEffect(() => {
    if (isEditing) return;
    if (isIncomingDiagnosticYear) {
      setType("DIAGNOSTIC");
      return;
    }
    setType((current) => (current === "DIAGNOSTIC" ? "COMPREHENSIVE" : current));
  }, [isIncomingDiagnosticYear, isEditing]);

  useEffect(() => {
    if (isEditing || !isSharedDiagnostic) return;
    setSetProgramCourse(SHARED_DIAGNOSTIC_PROGRAM);
  }, [isSharedDiagnostic, isEditing]);

  function updateYearLevel(value: string) {
    setYearLevel(value);
  }

  function commitYearLevel() {
    const nextYear = String(parseYearLevel(yearLevel));
    setYearLevel(nextYear);
  }

  const curriculumSubjects = useMemo(
    () =>
      subjects.filter(
        (s) =>
          s.yearLevel === curriculumYear && subjectHasProgram(s.programCourses, setProgramCourse)
      ),
    [subjects, curriculumYear, setProgramCourse]
  );

  useEffect(() => {
    if (isEditing || !yearLevel.trim()) return;

    const allowedSubjectIds = new Set(curriculumSubjects.map((s) => s.id));
    setSelectedSubjectIds((prev) => prev.filter((id) => allowedSubjectIds.has(id)));
    setAddSubjectId("");
  }, [curriculumYear, curriculumSubjects, yearLevel, isEditing, setProgramCourse]);

  const groupedSubjects = selectedSubjectIds
    .map((id) => subjects.find((s) => s.id === id))
    .filter(Boolean) as Subject[];

  const parsedTotalItems = countNum(examTotalItems);

  const baseSubjectAllocations = useMemo(
    () =>
      buildExamAllocations(
        parsedTotalItems,
        groupedSubjects.map((subject) => ({
          subjectId: subject.id,
          sortKey: subject.courseCode,
          topics: topics
            .filter((topic) => topic.subjectId === subject.id)
            .filter(
              (topic) =>
                !excludedTopicKeys.includes(topicAllocationKey(subject.id, topic.id))
            )
            .map((topic) => ({ topicId: topic.id, label: topic.name })),
        }))
      ),
    [parsedTotalItems, groupedSubjects, topics, excludedTopicKeys]
  );

  function autoTopicItemCount(topicKey: string, autoCount: number) {
    return topicItemOverrides[topicKey] ?? autoCount;
  }

  const subjectAllocations = useMemo(
    () =>
      baseSubjectAllocations.map((allocation) => {
        const topicsWithCounts = allocation.topics.map((topic) => ({
          ...topic,
          itemCount: autoTopicItemCount(topic.key, topic.itemCount),
        }));
        return {
          ...allocation,
          topics: topicsWithCounts,
          itemCount: topicsWithCounts.reduce((sum, topic) => sum + topic.itemCount, 0),
        };
      }),
    [baseSubjectAllocations, topicItemOverrides]
  );

  useEffect(() => {
    if (loading) return;

    const seed = `${parsedTotalItems}|${selectedSubjectIds.join(",")}`;
    if (allocationSeedRef.current === null) {
      allocationSeedRef.current = seed;
      return;
    }

    if (allocationSeedRef.current !== seed) {
      allocationSeedRef.current = seed;
      setTopicItemOverrides({});
      setTopicDifficultyOverrides({});
      setExcludedTopicKeys((prev) =>
        prev.filter((key) => selectedSubjectIds.some((id) => key.startsWith(`${id}:`)))
      );
      setAdjustingSubjectIds([]);
      setTopicDrafts({});
      setDifficultyDrafts({});
    }
  }, [loading, parsedTotalItems, selectedSubjectIds]);

  const subjectDifficultyByKey = useMemo(() => {
    const map = new Map<
      string,
      { easyCount: number; mediumCount: number; hardCount: number }
    >();
    for (const allocation of subjectAllocations) {
      const expanded = expandTopicConfigsWithSubjectDifficulty(
        allocation.topics.map((topic) => ({
          key: topic.key,
          itemCount: topic.itemCount,
          sortKey: topic.label,
        }))
      );
      for (const topic of expanded) {
        map.set(topic.key, {
          easyCount: topic.easyCount,
          mediumCount: topic.mediumCount,
          hardCount: topic.hardCount,
        });
      }
    }
    return map;
  }, [subjectAllocations]);

  const allocatedRows = useMemo(
    () => subjectAllocations.flatMap((allocation) => allocation.topics),
    [subjectAllocations]
  );

  function autoDifficultyForRow(row: TopicAllocation): ExamDifficultyCounts {
    return (
      subjectDifficultyByKey.get(row.key) ?? {
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
      }
    );
  }

  function difficultyForRow(row: TopicAllocation): ExamDifficultyCounts {
    return topicDifficultyOverrides[row.key] ?? autoDifficultyForRow(row);
  }

  function poolCount(subjectId: string, topicId: string | null, difficulty: string) {
    return questions.filter((q) => {
      if (q.subjectId !== subjectId || q.difficulty !== difficulty) return false;
      if (topicId) return q.topicId === topicId;
      return true;
    }).length;
  }

  function poolValidationError(row: TopicAllocation): string | null {
    if (row.itemCount === 0) return null;

    const { easyCount, mediumCount, hardCount } = difficultyForRow(row);
    const availEasy = poolCount(row.subjectId, row.topicId, "EASY");
    const availMedium = poolCount(row.subjectId, row.topicId, "MEDIUM");
    const availHard = poolCount(row.subjectId, row.topicId, "HARD");

    if (easyCount > availEasy) {
      return `${row.label}: easy count (${easyCount}) exceeds available pool (${availEasy}).`;
    }
    if (mediumCount > availMedium) {
      return `${row.label}: medium count (${mediumCount}) exceeds available pool (${availMedium}).`;
    }
    if (hardCount > availHard) {
      return `${row.label}: hard count (${hardCount}) exceeds available pool (${availHard}).`;
    }

    return null;
  }

  function addSubject() {
    if (!addSubjectId || selectedSubjectIds.includes(addSubjectId)) return;

    const subject = subjects.find((s) => s.id === addSubjectId);
    if (!subject) return;

    if (subject.yearLevel !== curriculumYear) {
      setError(
        `Only curriculum year ${curriculumYear} subjects can be added for student year ${parsedStudentYear}.`
      );
      return;
    }

    if (!subjectHasProgram(subject.programCourses, setProgramCourse)) {
      setError(
        `${subject.courseCode} is not linked to ${formatProgramCourse(setProgramCourse)}.`
      );
      return;
    }

    setSelectedSubjectIds((prev) => [...prev, addSubjectId]);
    setAddSubjectId("");
    setError("");
  }

  function removeSubject(subjectId: string) {
    setSelectedSubjectIds((prev) => prev.filter((id) => id !== subjectId));
    setAdjustingSubjectIds((prev) => prev.filter((id) => id !== subjectId));
    setTopicItemOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setTopicDifficultyOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setTopicDrafts((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setDifficultyDrafts((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setExcludedTopicKeys((prev) => prev.filter((key) => !key.startsWith(`${subjectId}:`)));
  }

  function clearSubjectTopicState(subjectId: string) {
    setTopicItemOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setTopicDifficultyOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setTopicDrafts((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
    setDifficultyDrafts((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${subjectId}:`)) delete next[key];
      }
      return next;
    });
  }

  function excludedTopicsForSubject(subjectId: string) {
    return topics.filter(
      (topic) =>
        topic.subjectId === subjectId &&
        excludedTopicKeys.includes(topicAllocationKey(subjectId, topic.id))
    );
  }

  function removeTopicFromBuild(
    subjectId: string,
    topicId: string,
    activeTopicRowCount: number
  ) {
    if (activeTopicRowCount <= 1) {
      setError("Keep at least one topic row, or remove the subject instead.");
      return;
    }

    const key = topicAllocationKey(subjectId, topicId);
    setExcludedTopicKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    clearSubjectTopicState(subjectId);
    setError("");
  }

  function restoreTopicToBuild(subjectId: string, topicId: string) {
    const key = topicAllocationKey(subjectId, topicId);
    setExcludedTopicKeys((prev) => prev.filter((entry) => entry !== key));
    clearSubjectTopicState(subjectId);
    setError("");
  }

  function toggleAdjustSubject(subjectId: string) {
    setAdjustingSubjectIds((prev) => {
      if (prev.includes(subjectId)) {
        return prev.filter((id) => id !== subjectId);
      }

      const allocation = baseSubjectAllocations.find((row) => row.subjectId === subjectId);
      if (allocation) {
        setTopicItemOverrides((current) => {
          const next = { ...current };
          for (const topic of allocation.topics) {
            if (next[topic.key] === undefined) {
              next[topic.key] = topic.itemCount;
            }
          }
          return next;
        });
        setTopicDifficultyOverrides((current) => {
          const next = { ...current };
          for (const topic of allocation.topics) {
            if (next[topic.key] === undefined) {
              const auto = subjectDifficultyByKey.get(topic.key);
              if (auto) next[topic.key] = auto;
            }
          }
          return next;
        });
      }

      return [...prev, subjectId];
    });
    setError("");
  }

  function resetSubjectTopics(subjectId: string) {
    setExcludedTopicKeys((prev) => prev.filter((key) => !key.startsWith(`${subjectId}:`)));
    clearSubjectTopicState(subjectId);
    setError("");
  }

  function updateTopicDraft(topicKey: string, value: string) {
    setTopicDrafts((prev) => ({ ...prev, [topicKey]: sanitizeCountInput(value) }));
  }

  function commitTopicDraft(topicKey: string) {
    const draft = topicDrafts[topicKey];
    setTopicDrafts((prev) => {
      const next = { ...prev };
      delete next[topicKey];
      return next;
    });
    if (draft === undefined) return;

    setTopicItemOverrides((prev) => ({
      ...prev,
      [topicKey]: countNum(draft),
    }));
    setError("");
  }

  function updateDifficultyDraft(topicKey: string, field: DifficultyField, value: string) {
    setDifficultyDrafts((prev) => ({
      ...prev,
      [difficultyDraftKey(topicKey, field)]: sanitizeCountInput(value),
    }));
  }

  function commitDifficultyDraft(row: TopicAllocation, field: DifficultyField) {
    const draftKey = difficultyDraftKey(row.key, field);
    const draft = difficultyDrafts[draftKey];
    setDifficultyDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
    if (draft === undefined) return;

    const countKey = DIFFICULTY_COUNT_KEY[field];
    setTopicDifficultyOverrides((prev) => {
      const current = prev[row.key] ?? autoDifficultyForRow(row);
      return {
        ...prev,
        [row.key]: {
          ...current,
          [countKey]: countNum(draft),
        },
      };
    });
    setError("");
  }

  function difficultyDisplayValue(row: TopicAllocation, field: DifficultyField) {
    const draft = difficultyDrafts[difficultyDraftKey(row.key, field)];
    if (draft !== undefined) return draft;
    if (row.itemCount <= 0) return "0";
    return String(difficultyForRow(row)[DIFFICULTY_COUNT_KEY[field]]);
  }

  function renderDifficultyCell(
    row: TopicAllocation,
    field: DifficultyField,
    label: string,
    isAdjusting: boolean
  ) {
    if (!isAdjusting || row.itemCount <= 0) {
      const value = difficultyForRow(row)[DIFFICULTY_COUNT_KEY[field]];
      return (
        <span className="build-set-num-readout">{row.itemCount > 0 ? value : "—"}</span>
      );
    }

    return (
      <input
        type="text"
        inputMode="numeric"
        className="table-input table-input-narrow build-set-topic-items-input"
        value={difficultyDisplayValue(row, field)}
        aria-label={`${label} items for ${row.label}`}
        onChange={(e) => updateDifficultyDraft(row.key, field, e.target.value)}
        onBlur={() => commitDifficultyDraft(row, field)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDifficultyDraft(row, field);
          }
        }}
      />
    );
  }

  function subjectAllocationStatus(subjectId: string) {
    const base = baseSubjectAllocations.find((row) => row.subjectId === subjectId);
    const current = subjectAllocations.find((row) => row.subjectId === subjectId);
    if (!base || !current) {
      return { target: 0, assigned: 0, remaining: 0 };
    }
    const target = base.itemCount;
    const assigned = current.itemCount;
    return { target, assigned, remaining: target - assigned };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Set name is required.");
      return;
    }

    if (groupedSubjects.length === 0) {
      setError("Add at least one subject.");
      return;
    }

    if (parsedTotalItems <= 0) {
      setError("Enter the total number of exam items.");
      return;
    }

    const mismatchedSubject = groupedSubjects.find((s) => s.yearLevel !== curriculumYear);
    if (mismatchedSubject) {
      setError(
        `${mismatchedSubject.courseCode} belongs to curriculum year ${mismatchedSubject.yearLevel}, not year ${curriculumYear}. Remove it or change student year level.`
      );
      return;
    }

    const mismatchedCourse = groupedSubjects.find(
      (s) => !subjectHasProgram(s.programCourses, setProgramCourse)
    );
    if (mismatchedCourse) {
      setError(
        `${mismatchedCourse.courseCode} is not linked to ${formatProgramCourse(setProgramCourse)}.`
      );
      return;
    }

    const allocationMismatch = baseSubjectAllocations.find((base) => {
      const current = subjectAllocations.find((row) => row.subjectId === base.subjectId);
      return (current?.itemCount ?? 0) !== base.itemCount;
    });
    if (allocationMismatch) {
      const subject = groupedSubjects.find((row) => row.id === allocationMismatch.subjectId);
      const { target, assigned } = subjectAllocationStatus(allocationMismatch.subjectId);
      setError(
        `${subject?.courseCode ?? "Subject"}: topic items must add up to ${target} (currently ${assigned}). Adjust or reset topics.`
      );
      return;
    }

    const poolError = allocatedRows.map(poolValidationError).find(Boolean);
    if (poolError) {
      setError(poolError);
      return;
    }

    const difficultyMismatch = allocatedRows.find((row) => {
      if (row.itemCount === 0) return false;
      const { easyCount, mediumCount, hardCount } = difficultyForRow(row);
      return easyCount + mediumCount + hardCount !== row.itemCount;
    });
    if (difficultyMismatch) {
      const { easyCount, mediumCount, hardCount } = difficultyForRow(difficultyMismatch);
      setError(
        `${difficultyMismatch.label}: easy, medium, and hard must add up to ${difficultyMismatch.itemCount} (currently ${easyCount + mediumCount + hardCount}).`
      );
      return;
    }

    const configs = allocatedRows
      .filter((row) => row.itemCount > 0)
      .map((row) => {
        const { easyCount, mediumCount, hardCount } = difficultyForRow(row);
        return {
          subjectId: row.subjectId,
          topicId: row.topicId,
          easyCount,
          mediumCount,
          hardCount,
        };
      });

    if (configs.length === 0) {
      setError("Could not allocate items across subjects and topics.");
      return;
    }

    const hours = Math.max(0, Number(timeLimitHours) || 0);
    const minutes = Math.max(0, Number(timeLimitMinutes) || 0);
    const timeLimitTotal = hours * 60 + minutes;
    if (timeLimitTotal < 1) {
      setError("Set a time limit of at least 1 minute.");
      return;
    }
    if (timeLimitTotal > 480) {
      setError("Time limit cannot exceed 8 hours.");
      return;
    }

    const parsedPassThreshold = Number(passThreshold);
    if (!Number.isFinite(parsedPassThreshold) || parsedPassThreshold < 0 || parsedPassThreshold > 100) {
      setError("Passing rate must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        totalItems: parsedTotalItems,
        timeLimitMinutes: timeLimitTotal,
        passThreshold: parsedPassThreshold,
        configs,
      };

      if (isEditing && setId) {
        await api(`/question-sets/${setId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }, token);
        onCreated(toastUpdated("question set", name.trim()));
      } else {
        await api(
          "/question-sets",
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              yearLevel: parsedStudentYear,
              programCourse: setProgramCourse,
              type,
            }),
          },
          token
        );
        onCreated(toastCreated("question set", name.trim()));
      }
      requestClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "Failed to update question set"
            : "Failed to create question set"
      );
    } finally {
      setSaving(false);
    }
  }

  const difficultyTotals = useMemo(() => {
    return allocatedRows.reduce(
      (acc, row) => {
        const { easyCount, mediumCount, hardCount } = difficultyForRow(row);
        return {
          easyCount: acc.easyCount + easyCount,
          mediumCount: acc.mediumCount + mediumCount,
          hardCount: acc.hardCount + hardCount,
        };
      },
      { easyCount: 0, mediumCount: 0, hardCount: 0 }
    );
  }, [allocatedRows, topicDifficultyOverrides, subjectDifficultyByKey]);

  const autoDifficultyTotals = difficultyCountsForTotal(parsedTotalItems);

  const panel = (
    <>
      <div className={inline ? "sets-header build-set-inline-header" : "modal-header"}>
        <div>
          <h2>{isEditing ? "Edit Question Set" : "Build Question Set"}</h2>
          <p className="muted">
            {isEditing
              ? "Adjust total items, subjects, topics, or difficulty counts per topic."
              : "Set total exam items, add subjects, and adjust topics as needed."}
          </p>
          {isEditing && setStatus === "DEPLOYED" && (
            <span className="build-set-deployed-badge">Deployed</span>
          )}
        </div>
        {!inline ? (
          <button type="button" className="btn secondary" onClick={handleCancel}>
            Close
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">Loading question set...</p>
      ) : (
        <form className="build-set-form" onSubmit={handleSubmit}>
          <div className="build-set-form-body">
          <section className="build-set-details">
            <h3 className="build-set-section-title">Set details</h3>
            <div className="build-set-meta">
              <label className="build-set-meta-name">
                <span className="build-set-field-label">Set name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Incoming 2nd Year Comprehensive 2026"
                  required
                />
              </label>
              <label className="build-set-meta-year">
                <span className="build-set-field-label">Year level</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  value={yearLevel}
                  onChange={(e) => updateYearLevel(sanitizeYearInput(e.target.value))}
                  onBlur={commitYearLevel}
                  disabled={isEditing}
                  required
                />
              </label>
              <label className="build-set-meta-course">
                <span className="build-set-field-label">Program course</span>
                <select
                  value={setProgramCourse}
                  onChange={(e) => setSetProgramCourse(e.target.value as ProgramCourseId)}
                  disabled={isEditing || isSharedDiagnostic}
                  required
                >
                  {programCourseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="build-set-meta-type">
                <span className="build-set-field-label">Exam type</span>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "COMPREHENSIVE" | "DIAGNOSTIC" | "RETAKE")
                  }
                  disabled={isEditing || isIncomingDiagnosticYear}
                >
                  {isIncomingDiagnosticYear ? (
                    <option value="DIAGNOSTIC">Diagnostic</option>
                  ) : (
                    <>
                      <option value="COMPREHENSIVE">Comprehensive</option>
                      <option value="RETAKE">Retake</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            <div className="build-set-meta-exam">
              <label className="build-set-meta-total">
                <span className="build-set-field-label">Total items</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="100"
                  value={examTotalItems}
                  onChange={(e) => setExamTotalItems(sanitizeCountInput(e.target.value))}
                  required
                />
              </label>
              <div className="build-set-meta-time">
                <span className="build-set-field-label">Time limit</span>
                <div className="build-set-time-inputs">
                  <input
                    type="number"
                    min={0}
                    max={8}
                    inputMode="numeric"
                    aria-label="Hours"
                    value={timeLimitHours}
                    onChange={(e) => setTimeLimitHours(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                  <span className="build-set-time-unit">hrs</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    aria-label="Minutes"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                  <span className="build-set-time-unit">min</span>
                </div>
              </div>
              <div className="build-set-meta-pass">
                <span className="build-set-field-label">Passing rate</span>
                <div className="build-set-pass-input">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(e.target.value.replace(/[^\d.]/g, ""))}
                    required
                  />
                  <span className="build-set-pass-suffix">%</span>
                </div>
              </div>
            </div>
            <p className="field-hint build-set-total-hint">
              Items divide evenly across subjects by course code. Use Edit on each subject to
              transfer items between its topics, set easy, medium, and hard counts, or remove
              topics from the exam. Defaults use 30% easy, 50% medium, and 20% hard per subject.
            </p>
            <div className="build-set-details-bar">
              <span className={`build-set-exam-badge build-set-exam-badge-${type.toLowerCase()}`}>
                {formatExamType(type)}
              </span>
              <span className="build-set-details-bar-copy">
                {isIncomingDiagnosticYear
                  ? "Shared incoming diagnostic for all programs."
                  : "Comprehensive or retake exam for year levels 2–4."}
              </span>
              <span
                className="build-set-details-bar-meta"
                title={`Uses curriculum year ${curriculumYear} subjects for ${formatProgramCourse(setProgramCourse)} when available.`}
              >
                Curriculum yr {curriculumYear} · {abbreviateProgramCourse(setProgramCourse)}
              </span>
            </div>
          </section>

          <section className="build-set-subjects">
            <div className="build-set-subjects-header">
              <h3 className="build-set-section-title">Subjects</h3>
              {groupedSubjects.length > 0 && parsedTotalItems > 0 ? (
                <span className="build-set-subjects-count">
                  {groupedSubjects.length} subject{groupedSubjects.length === 1 ? "" : "s"} ·{" "}
                  {parsedTotalItems} items total
                </span>
              ) : groupedSubjects.length > 0 ? (
                <span className="build-set-subjects-count">
                  {groupedSubjects.length} subject{groupedSubjects.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

          <div className="build-set-add-subject">
            <label>
              <span className="build-set-field-label">Add subject</span>
              <select
                value={addSubjectId}
                onChange={(e) => setAddSubjectId(e.target.value)}
              >
                <option value="">Select a subject</option>
                {curriculumSubjects
                  .filter((s) => !selectedSubjectIds.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.courseCode} — {s.courseTitle}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="btn secondary"
              onClick={addSubject}
              disabled={curriculumSubjects.length === 0}
            >
              Add subject
            </button>
          </div>

          {groupedSubjects.length === 0 ? (
            <p className="build-set-empty muted">
              {curriculumSubjects.length === 0
                ? `No ${abbreviateProgramCourse(setProgramCourse)} yr ${curriculumYear} subjects in Setup.`
                : "Add subjects above. Item counts auto-fill from the total."}
            </p>
          ) : parsedTotalItems <= 0 ? (
            <p className="build-set-empty muted">Enter total items above to preview the split.</p>
          ) : (
            subjectAllocations.map((allocation) => {
              const subject = groupedSubjects.find((row) => row.id === allocation.subjectId);
              const baseAllocation = baseSubjectAllocations.find(
                (row) => row.subjectId === allocation.subjectId
              );
              if (!subject || !baseAllocation) return null;

              const isAdjusting = adjustingSubjectIds.includes(subject.id);
              const { target, assigned, remaining } = subjectAllocationStatus(subject.id);
              const subjectBalanced = remaining === 0;
              const removedTopics = excludedTopicsForSubject(subject.id);

              return (
                <div
                  key={subject.id}
                  className={`build-set-subject${isAdjusting ? " build-set-subject-adjusting" : ""}`}
                >
                  <div className="build-set-subject-header">
                    <div className="build-set-subject-title">
                      <span className="build-set-subject-code">{subject.courseCode}</span>
                      <span className="build-set-subject-name">{subject.courseTitle}</span>
                      <span className="build-set-subject-items-badge">
                        {assigned} / {target} item{target === 1 ? "" : "s"}
                      </span>
                      {isAdjusting && !subjectBalanced ? (
                        <span className="build-set-subject-remaining">
                          {remaining > 0
                            ? `${remaining} to assign`
                            : `${Math.abs(remaining)} over limit`}
                        </span>
                      ) : null}
                    </div>
                    <div className="build-set-subject-actions">
                      <button
                        type="button"
                        className={`btn secondary btn-sm${isAdjusting ? " active" : ""}`}
                        onClick={() => toggleAdjustSubject(subject.id)}
                      >
                        {isAdjusting ? "Done" : "Edit"}
                      </button>
                      {isAdjusting ? (
                        <button
                          type="button"
                          className="btn secondary btn-sm"
                          onClick={() => resetSubjectTopics(subject.id)}
                        >
                          Reset
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn secondary btn-sm"
                        onClick={() => removeSubject(subject.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="build-set-subject-table-wrap modal-table-wrap">
                  <table className="build-set-subject-table">
                    <thead>
                      <tr>
                        <th className="build-set-topic-col">Topic</th>
                        <th className="build-set-num-col">Items</th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge easy">Easy</span>
                          {isAdjusting ? null : (
                            <span className="build-set-auto-label">30%</span>
                          )}
                        </th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge medium">Medium</span>
                          {isAdjusting ? null : (
                            <span className="build-set-auto-label">50%</span>
                          )}
                        </th>
                        <th className="build-set-num-col">
                          <span className="difficulty-badge hard">Hard</span>
                          {isAdjusting ? null : (
                            <span className="build-set-auto-label">20%</span>
                          )}
                        </th>
                        <th className="build-set-num-col build-set-avail-col">Available</th>
                        {isAdjusting ? <th className="build-set-action-col" aria-label="Actions" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {allocation.topics.map((row) => {
                        const { easyCount, mediumCount, hardCount } = difficultyForRow(row);
                        const availEasy = poolCount(row.subjectId, row.topicId, "EASY");
                        const availMedium = poolCount(row.subjectId, row.topicId, "MEDIUM");
                        const availHard = poolCount(row.subjectId, row.topicId, "HARD");
                        const poolShort =
                          row.itemCount > 0 &&
                          (easyCount > availEasy ||
                            mediumCount > availMedium ||
                            hardCount > availHard);
                        const difficultyMismatch =
                          row.itemCount > 0 &&
                          easyCount + mediumCount + hardCount !== row.itemCount;
                        const draftValue = topicDrafts[row.key];
                        const displayValue =
                          draftValue !== undefined ? draftValue : String(row.itemCount);

                        return (
                          <tr
                            key={row.key}
                            className={
                              poolShort || difficultyMismatch
                                ? "build-set-row-pool-short"
                                : undefined
                            }
                          >
                            <td className="build-set-topic-col">{row.label}</td>
                            <td className="build-set-num-col">
                              {isAdjusting ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="table-input table-input-narrow build-set-topic-items-input"
                                  value={displayValue}
                                  aria-label={`Items for ${row.label}`}
                                  onChange={(e) => updateTopicDraft(row.key, e.target.value)}
                                  onBlur={() => commitTopicDraft(row.key)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitTopicDraft(row.key);
                                    }
                                  }}
                                />
                              ) : (
                                <span className="build-set-num-readout">
                                  {row.itemCount > 0 ? row.itemCount : "—"}
                                </span>
                              )}
                            </td>
                            <td className="build-set-num-col">
                              {renderDifficultyCell(row, "easy", "Easy", isAdjusting)}
                            </td>
                            <td className="build-set-num-col">
                              {renderDifficultyCell(row, "medium", "Medium", isAdjusting)}
                            </td>
                            <td className="build-set-num-col">
                              {renderDifficultyCell(row, "hard", "Hard", isAdjusting)}
                            </td>
                            <td className="build-set-num-col build-set-avail-col muted">
                              {availEasy} / {availMedium} / {availHard}
                            </td>
                            {isAdjusting ? (
                              <td className="build-set-action-col">
                                {row.topicId && allocation.topics.length > 1 ? (
                                  <button
                                    type="button"
                                    className="btn secondary btn-sm build-set-topic-remove"
                                    onClick={() =>
                                      removeTopicFromBuild(
                                        subject.id,
                                        row.topicId!,
                                        allocation.topics.length
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                  {isAdjusting && removedTopics.length > 0 ? (
                    <div className="build-set-removed-topics">
                      <span className="build-set-removed-topics-label">Removed topics</span>
                      <ul className="build-set-removed-topics-list">
                        {removedTopics.map((topic) => (
                          <li key={topic.id}>
                            <span>{topic.name}</span>
                            <button
                              type="button"
                              className="btn secondary btn-sm"
                              onClick={() => restoreTopicToBuild(subject.id, topic.id)}
                            >
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          </section>
          </div>

          <div className="build-set-form-footer">
          <div className="build-set-summary">
            <div className="build-set-summary-stats">
              <div className="build-set-stat">
                <span className="build-set-stat-label">Total items</span>
                <span className="build-set-stat-value">
                  {parsedTotalItems > 0 ? parsedTotalItems : "—"}
                </span>
              </div>
              <div className="build-set-stat">
                <span className="build-set-stat-label">Easy</span>
                <span className="build-set-stat-value">
                  {parsedTotalItems > 0 ? difficultyTotals.easyCount : "—"}
                </span>
              </div>
              <div className="build-set-stat">
                <span className="build-set-stat-label">Medium</span>
                <span className="build-set-stat-value">
                  {parsedTotalItems > 0 ? difficultyTotals.mediumCount : "—"}
                </span>
              </div>
              <div className="build-set-stat">
                <span className="build-set-stat-label">Hard</span>
                <span className="build-set-stat-value">
                  {parsedTotalItems > 0 ? difficultyTotals.hardCount : "—"}
                </span>
              </div>
            </div>
            <p className="field-hint build-set-summary-hint">
              Subject totals stay fixed from the exam total. Use Edit to move items, difficulty
              counts, or remove topics within a subject. Reset restores all topics.
              {parsedTotalItems > 0
                ? ` Default exam split is ${autoDifficultyTotals.easyCount}/${autoDifficultyTotals.mediumCount}/${autoDifficultyTotals.hardCount} (30/50/20) before overrides.`
                : null}
            </p>
          </div>

          {error && <p className="error build-set-form-error">{error}</p>}

          <div className="modal-footer build-set-form-actions">
            {inline && isEditing ? (
              <button type="button" className="btn secondary" onClick={handleCancel}>
                Back to Deploy
              </button>
            ) : !inline ? (
              <button type="button" className="btn secondary" onClick={handleCancel}>
                Cancel
              </button>
            ) : null}
            <button type="submit" className="btn" disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          </div>
        </form>
      )}
    </>
  );

  if (inline) {
    return <section className="card build-sets-panel build-set-panel">{panel}</section>;
  }

  return portal(
    <div className={overlayClass} onClick={requestClose}>
      <div className={panelClass("build-set-modal")} onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
