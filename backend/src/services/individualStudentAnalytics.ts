import { BloomLevel, Role } from "@prisma/client";
import { BLOOM_LEVEL_ORDER, buildBloomCognitiveProfile, buildDifficultyDomainScores } from "../lib/bloomLevel.js";
import { formatFullName } from "../lib/names.js";
import { prisma } from "../lib/prisma.js";
import { nonQaStudentWhere, nonQaSubmittedExamWhere } from "../lib/studentFilters.js";

const WEAK_THRESHOLD = 50;
const WATCH_THRESHOLD = 60;
const STRONG_THRESHOLD = 80;

function pct(correct: number, total: number) {
  return total > 0 ? (correct / total) * 100 : 0;
}

function scoreTone(score: number) {
  if (score >= STRONG_THRESHOLD) return "strong" as const;
  if (score >= WEAK_THRESHOLD) return "moderate" as const;
  return "weak" as const;
}

type BucketKey = string;

function bucketKey(parts: string[]) {
  return parts.join("::");
}

export interface StudentAnalyticsSearchFilters {
  yearLevel?: number;
  programCourse?: string;
}

export async function searchStudentsForAnalytics(
  query: string,
  filters: StudentAnalyticsSearchFilters = {}
) {
  const trimmed = query.trim();
  const hasYearFilter = Number.isFinite(filters.yearLevel);
  const hasProgramFilter = Boolean(filters.programCourse);

  const tokens =
    trimmed.length >= 2 ? trimmed.toLowerCase().split(/\s+/).filter(Boolean) : [];

  const students = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      qaUnlimited: false,
      isActive: true,
      ...(hasYearFilter ? { yearLevel: filters.yearLevel } : {}),
      ...(hasProgramFilter ? { programCourse: filters.programCourse } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      yearLevel: true,
      programCourse: true,
      email: true,
      examAttempts: {
        where: { submittedAt: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 150,
  });

  return students
    .filter((student) => {
      if (tokens.length === 0) return true;
      const haystack = `${student.firstName} ${student.lastName} ${student.email}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .filter((student) => student.examAttempts.length > 0)
    .slice(0, tokens.length === 0 ? 150 : 50)
    .map((student) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      name: formatFullName(student.firstName, student.lastName),
      yearLevel: student.yearLevel,
      programCourse: student.programCourse,
      email: student.email,
    }));
}

export async function buildIndividualStudentAnalytics(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      yearLevel: true,
      email: true,
      programCourse: true,
      role: true,
      qaUnlimited: true,
    },
  });

  if (!student || student.role !== Role.STUDENT || student.qaUnlimited) {
    return null;
  }

  const latestAttempt = await prisma.examAttempt.findFirst({
    where: { studentId, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    include: {
      questionSet: { select: { name: true, passThreshold: true, yearLevel: true } },
      answers: {
        include: {
          question: {
            include: {
              subject: { select: { id: true, courseCode: true, courseTitle: true } },
              topic: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!latestAttempt || !latestAttempt.submittedAt) {
    return {
      student: {
        ...student,
        name: formatFullName(student.firstName, student.lastName),
      },
      hasExamData: false,
    };
  }

  const yearLevel = student.yearLevel ?? undefined;
  const cohortFilter = nonQaSubmittedExamWhere(yearLevel);

  const cohortAnswers = await prisma.examAnswer.findMany({
    where: {
      selectedOption: { not: null },
      examAttempt: cohortFilter,
    },
    include: {
      question: {
        include: {
          subject: { select: { id: true, courseCode: true, courseTitle: true } },
          topic: { select: { id: true, name: true } },
        },
      },
      examAttempt: { select: { studentId: true, submittedAt: true } },
    },
  });

  const latestCohortAttemptIds = new Set<string>();
  const cohortLatestScores = new Map<string, number>();

  const cohortAttempts = await prisma.examAttempt.findMany({
    where: cohortFilter,
    select: {
      id: true,
      studentId: true,
      percentage: true,
      submittedAt: true,
      focusWarningCount: true,
    },
    orderBy: [{ studentId: "asc" }, { submittedAt: "desc" }],
  });

  let cohortFocusWarningTotal = 0;
  let cohortFocusWarningCount = 0;

  for (const attempt of cohortAttempts) {
    if (!cohortLatestScores.has(attempt.studentId)) {
      cohortLatestScores.set(attempt.studentId, attempt.percentage ?? 0);
      latestCohortAttemptIds.add(attempt.id);
      cohortFocusWarningTotal += attempt.focusWarningCount;
      cohortFocusWarningCount += 1;
    }
  }

  const classTopicStats = new Map<BucketKey, { correct: number; total: number; label: string }>();
  const classSubjectStats = new Map<BucketKey, { correct: number; total: number; label: string }>();
  const classDifficultyStats = new Map<string, { correct: number; total: number; timeTotal: number; timeCount: number }>();
  const classBloomStats = new Map<BloomLevel, { correct: number; total: number }>();
  const classDifficultyBloomStats = new Map<string, { correct: number; total: number }>();
  const classTimeTotal = { seconds: 0, count: 0 };

  for (const answer of cohortAnswers) {
    if (!latestCohortAttemptIds.has(answer.examAttemptId)) continue;

    const subjectLabel = `${answer.question.subject.courseCode} ${answer.question.subject.courseTitle}`;
    const topicId = answer.question.topic?.id ?? `${answer.question.subject.id}-general`;
    const topicLabel = answer.question.topic?.name ?? "General";
    const topicKey = bucketKey([topicId]);
    const subjectKey = bucketKey([answer.question.subject.id]);

    if (!classTopicStats.has(topicKey)) {
      classTopicStats.set(topicKey, { correct: 0, total: 0, label: topicLabel });
    }
    if (!classSubjectStats.has(subjectKey)) {
      classSubjectStats.set(subjectKey, { correct: 0, total: 0, label: subjectLabel });
    }
    if (!classDifficultyStats.has(answer.question.difficulty)) {
      classDifficultyStats.set(answer.question.difficulty, {
        correct: 0,
        total: 0,
        timeTotal: 0,
        timeCount: 0,
      });
    }
    if (!classBloomStats.has(answer.question.bloomLevel)) {
      classBloomStats.set(answer.question.bloomLevel, { correct: 0, total: 0 });
    }

    const topicRow = classTopicStats.get(topicKey)!;
    const subjectRow = classSubjectStats.get(subjectKey)!;
    const difficultyRow = classDifficultyStats.get(answer.question.difficulty)!;
    const bloomRow = classBloomStats.get(answer.question.bloomLevel)!;

    topicRow.total += 1;
    subjectRow.total += 1;
    difficultyRow.total += 1;
    bloomRow.total += 1;

    const difficultyBloomKey = `${answer.question.difficulty}::${answer.question.bloomLevel}`;
    if (!classDifficultyBloomStats.has(difficultyBloomKey)) {
      classDifficultyBloomStats.set(difficultyBloomKey, { correct: 0, total: 0 });
    }
    const difficultyBloomRow = classDifficultyBloomStats.get(difficultyBloomKey)!;
    difficultyBloomRow.total += 1;

    if (answer.isCorrect) {
      topicRow.correct += 1;
      subjectRow.correct += 1;
      difficultyRow.correct += 1;
      bloomRow.correct += 1;
      difficultyBloomRow.correct += 1;
    }
    if (answer.timeSpentSeconds != null) {
      difficultyRow.timeTotal += answer.timeSpentSeconds;
      difficultyRow.timeCount += 1;
      classTimeTotal.seconds += answer.timeSpentSeconds;
      classTimeTotal.count += 1;
    }
  }

  const studentTopicStats = new Map<
    BucketKey,
    { topicId: string; topic: string; subject: string; correct: number; total: number }
  >();
  const studentSubjectStats = new Map<
    BucketKey,
    { subjectId: string; subject: string; correct: number; total: number }
  >();
  const studentDifficultyStats = new Map<
    string,
    { correct: number; total: number; timeTotal: number; timeCount: number }
  >();
  const studentBloomStats = new Map<BloomLevel, { correct: number; total: number }>();
  const studentDifficultyBloomStats = new Map<string, { correct: number; total: number }>();

  let studentTimeTotal = 0;
  let studentTimeCount = 0;

  for (const answer of latestAttempt.answers) {
    if (!answer.selectedOption) continue;

    const subjectLabel = `${answer.question.subject.courseCode} ${answer.question.subject.courseTitle}`;
    const topicId = answer.question.topic?.id ?? `${answer.question.subject.id}-general`;
    const topicLabel = answer.question.topic?.name ?? "General";
    const topicKey = bucketKey([topicId]);
    const subjectKey = bucketKey([answer.question.subject.id]);

    if (!studentTopicStats.has(topicKey)) {
      studentTopicStats.set(topicKey, {
        topicId,
        topic: topicLabel,
        subject: subjectLabel,
        correct: 0,
        total: 0,
      });
    }
    if (!studentSubjectStats.has(subjectKey)) {
      studentSubjectStats.set(subjectKey, {
        subjectId: answer.question.subject.id,
        subject: subjectLabel,
        correct: 0,
        total: 0,
      });
    }
    if (!studentDifficultyStats.has(answer.question.difficulty)) {
      studentDifficultyStats.set(answer.question.difficulty, {
        correct: 0,
        total: 0,
        timeTotal: 0,
        timeCount: 0,
      });
    }
    if (!studentBloomStats.has(answer.question.bloomLevel)) {
      studentBloomStats.set(answer.question.bloomLevel, { correct: 0, total: 0 });
    }

    const topicRow = studentTopicStats.get(topicKey)!;
    const subjectRow = studentSubjectStats.get(subjectKey)!;
    const difficultyRow = studentDifficultyStats.get(answer.question.difficulty)!;
    const bloomRow = studentBloomStats.get(answer.question.bloomLevel)!;

    topicRow.total += 1;
    subjectRow.total += 1;
    difficultyRow.total += 1;
    bloomRow.total += 1;

    const studentDifficultyBloomKey = `${answer.question.difficulty}::${answer.question.bloomLevel}`;
    if (!studentDifficultyBloomStats.has(studentDifficultyBloomKey)) {
      studentDifficultyBloomStats.set(studentDifficultyBloomKey, { correct: 0, total: 0 });
    }
    const studentDifficultyBloomRow = studentDifficultyBloomStats.get(studentDifficultyBloomKey)!;
    studentDifficultyBloomRow.total += 1;

    if (answer.isCorrect) {
      topicRow.correct += 1;
      subjectRow.correct += 1;
      difficultyRow.correct += 1;
      bloomRow.correct += 1;
      studentDifficultyBloomRow.correct += 1;
    }
    if (answer.timeSpentSeconds != null) {
      difficultyRow.timeTotal += answer.timeSpentSeconds;
      difficultyRow.timeCount += 1;
      studentTimeTotal += answer.timeSpentSeconds;
      studentTimeCount += 1;
    }
  }

  const byTopic = [...studentTopicStats.values()]
    .map((row) => {
      const classRow = classTopicStats.get(bucketKey([row.topicId]));
      const score = pct(row.correct, row.total);
      const classAverage = classRow ? pct(classRow.correct, classRow.total) : null;
      return {
        topicId: row.topicId,
        topic: row.topic,
        subject: row.subject,
        score,
        classAverage,
        tone: scoreTone(score),
        total: row.total,
        correct: row.correct,
      };
    })
    .sort((a, b) => a.score - b.score);

  const bySubject = [...studentSubjectStats.values()]
    .map((row) => {
      const classRow = classSubjectStats.get(bucketKey([row.subjectId]));
      const score = pct(row.correct, row.total);
      const classAverage = classRow ? pct(classRow.correct, classRow.total) : null;
      return {
        subjectId: row.subjectId,
        subject: row.subject,
        score,
        classAverage,
        tone: scoreTone(score),
        total: row.total,
        correct: row.correct,
      };
    })
    .sort((a, b) => a.score - b.score);

  const difficultyOrder = ["EASY", "MEDIUM", "HARD"] as const;
  const byDifficulty = difficultyOrder.map((difficulty) => {
    const row = studentDifficultyStats.get(difficulty) ?? {
      correct: 0,
      total: 0,
      timeTotal: 0,
      timeCount: 0,
    };
    const classRow = classDifficultyStats.get(difficulty) ?? {
      correct: 0,
      total: 0,
      timeTotal: 0,
      timeCount: 0,
    };
    const score = pct(row.correct, row.total);
    const classAverage = pct(classRow.correct, classRow.total);
    const avgTimeSeconds = row.timeCount > 0 ? Math.round(row.timeTotal / row.timeCount) : null;
    const classAvgTimeSeconds =
      classRow.timeCount > 0 ? Math.round(classRow.timeTotal / classRow.timeCount) : null;

    return {
      difficulty,
      score,
      classAverage,
      tone: scoreTone(score),
      avgTimeSeconds,
      classAvgTimeSeconds,
      total: row.total,
      correct: row.correct,
      domains: buildDifficultyDomainScores(difficulty, studentDifficultyBloomStats).map((domain) => {
        const classDomain = buildDifficultyDomainScores(difficulty, classDifficultyBloomStats).find(
          (row) => row.bloomLevel === domain.bloomLevel
        );
        return {
          bloomLevel: domain.bloomLevel,
          score: domain.score,
          classAverage: classDomain?.score ?? 0,
          tone: scoreTone(domain.score),
          total: domain.total,
          correct: domain.correct,
        };
      }),
    };
  });

  const byBloomLevel = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const row = studentBloomStats.get(bloomLevel) ?? { correct: 0, total: 0 };
    const classRow = classBloomStats.get(bloomLevel) ?? { correct: 0, total: 0 };
    const score = pct(row.correct, row.total);
    const classAverage = pct(classRow.correct, classRow.total);

    return {
      bloomLevel,
      score,
      classAverage,
      tone: scoreTone(score),
      total: row.total,
      correct: row.correct,
    };
  });

  const bloomProfile = buildBloomCognitiveProfile(
    byBloomLevel.map((row) => ({
      bloomLevel: row.bloomLevel,
      score: row.score,
      total: row.total,
    }))
  );

  const weakTopics = byTopic.filter((row) => row.score < WATCH_THRESHOLD);
  const studentScore = latestAttempt.percentage ?? 0;

  const rankedScores = [...cohortLatestScores.entries()]
    .map(([id, score]) => ({ studentId: id, score }))
    .sort((a, b) => b.score - a.score);

  const rankIndex = rankedScores.findIndex((row) => row.studentId === studentId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const batchSize = rankedScores.length;

  const studentExamMinutes =
    studentTimeCount > 0 ? Math.round(studentTimeTotal / 60) : null;
  const classAvgMinutes =
    classTimeTotal.count > 0 ? Math.round(classTimeTotal.seconds / classTimeTotal.count / 60) : null;

  const insights: Array<{ type: "weak" | "risk" | "watch" | "strength"; message: string }> = [];

  for (const topic of weakTopics) {
    insights.push({
      type: "weak",
      message: `Scored ${topic.score.toFixed(0)}% on ${topic.topic} (${topic.subject}) — below the ${WATCH_THRESHOLD}% watch threshold.`,
    });
  }

  if (bloomProfile?.type === "surface") {
    insights.push({
      type: "watch",
      message: bloomProfile.message,
    });
  } else if (bloomProfile?.type === "deep") {
    insights.push({
      type: "strength",
      message: bloomProfile.message,
    });
  } else if (bloomProfile?.type === "mixed") {
    insights.push({
      type: "watch",
      message: bloomProfile.message,
    });
  }

  const hardRow = byDifficulty.find((row) => row.difficulty === "HARD");
  if (
    hardRow &&
    hardRow.avgTimeSeconds != null &&
    hardRow.classAvgTimeSeconds != null &&
    hardRow.avgTimeSeconds < hardRow.classAvgTimeSeconds * 0.6 &&
    hardRow.score < 50
  ) {
    insights.push({
      type: "risk",
      message: `Hard questions answered in ${hardRow.avgTimeSeconds}s average vs ${hardRow.classAvgTimeSeconds}s class benchmark — pattern may suggest guessing.`,
    });
  }

  const focusWarnings = latestAttempt.focusWarningCount;
  const classAvgFocusWarnings =
    cohortFocusWarningCount > 0
      ? Math.round((cohortFocusWarningTotal / cohortFocusWarningCount) * 10) / 10
      : null;

  if (focusWarnings >= 5) {
    insights.push({
      type: "risk",
      message: `${focusWarnings} focus warnings during the exam (left fullscreen or switched tabs) — review proctoring notes before retake decisions.`,
    });
  } else if (focusWarnings >= 2) {
    insights.push({
      type: "watch",
      message: `${focusWarnings} focus warnings recorded — student left exam focus during the attempt.`,
    });
  }

  for (const subject of bySubject) {
    if (subject.classAverage != null && subject.score < subject.classAverage - 5 && subject.score >= WATCH_THRESHOLD) {
      insights.push({
        type: "watch",
        message: `${subject.subject.split(" ").slice(0, 2).join(" ")} score (${subject.score.toFixed(0)}%) is below class average (${subject.classAverage.toFixed(0)}%) — monitor before retake.`,
      });
    }
  }

  for (const topic of byTopic) {
    if (topic.score >= STRONG_THRESHOLD && topic.classAverage != null && topic.score >= topic.classAverage + 5) {
      insights.push({
        type: "strength",
        message: `${topic.topic} (${topic.score.toFixed(0)}%) is well above class average — strong retention area.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: "watch",
      message: "No critical flags on this attempt. Review topic tiles for areas to reinforce.",
    });
  }

  return {
    student: {
      ...student,
      name: formatFullName(student.firstName, student.lastName),
    },
    hasExamData: true,
    exam: {
      id: latestAttempt.id,
      questionSetName: latestAttempt.questionSet.name,
      questionSetYear: latestAttempt.questionSet.yearLevel,
      submittedAt: latestAttempt.submittedAt.toISOString(),
      attemptType: latestAttempt.attemptType,
      attemptNumber: latestAttempt.attemptNumber,
      score: latestAttempt.score,
      totalItems: latestAttempt.totalItems,
      percentage: studentScore,
      passed: latestAttempt.passed,
      passThreshold: latestAttempt.questionSet.passThreshold,
      focusWarningCount: latestAttempt.focusWarningCount,
    },
    summary: {
      overallScore: studentScore,
      correct: latestAttempt.score ?? 0,
      totalItems: latestAttempt.totalItems,
      rank,
      batchSize,
      completionMinutes: studentExamMinutes,
      classAvgMinutes,
      weakTopicsCount: weakTopics.length,
      passed: latestAttempt.passed,
      focusWarningCount: latestAttempt.focusWarningCount,
      classAvgFocusWarnings,
    },
    byTopic,
    bySubject,
    byDifficulty,
    byBloomLevel,
    bloomProfile,
    insights: insights.slice(0, 6),
  };
}
