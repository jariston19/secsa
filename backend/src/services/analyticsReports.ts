import { Role } from "@prisma/client";
import { formatFullName } from "../lib/names.js";
import { nonQaStudentWhere, nonQaSubmittedExamWhere } from "../lib/studentFilters.js";
import { prisma } from "../lib/prisma.js";

const PASS_THRESHOLD = 75;
const STRONG_THRESHOLD = 80;
const WEAK_THRESHOLD = 50;
const AT_RISK_THRESHOLD = 60;
const TOO_EASY_THRESHOLD = 90;
const TOO_HARD_THRESHOLD = 20;
const MIN_AREA_ATTEMPTS = 3;

type YearFilter = number | undefined;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function readinessLevel(score: number, threshold = PASS_THRESHOLD) {
  if (score >= threshold) return "Ready";
  if (score >= threshold - 15) return "Needs Improvement";
  return "At Risk";
}

function scoreTone(score: number) {
  if (score >= STRONG_THRESHOLD) return "strong";
  if (score >= WEAK_THRESHOLD) return "moderate";
  return "weak";
}

function pct(correct: number, total: number) {
  return total > 0 ? (correct / total) * 100 : 0;
}

export async function buildAnalyticsReports(yearLevel?: YearFilter) {
  const studentFilter = nonQaStudentWhere(yearLevel);

  const [answers, attempts, questions, students] = await Promise.all([
    prisma.examAnswer.findMany({
      where: {
        examAttempt: nonQaSubmittedExamWhere(yearLevel),
      },
      include: {
        question: {
          include: {
            subject: { select: { id: true, courseCode: true, courseTitle: true } },
            topic: { select: { id: true, name: true } },
          },
        },
        examAttempt: {
          select: {
            id: true,
            studentId: true,
            percentage: true,
            questionSet: { select: { passThreshold: true } },
          },
        },
      },
    }),
    prisma.examAttempt.findMany({
      where: nonQaSubmittedExamWhere(yearLevel),
      include: {
        student: { select: { id: true, firstName: true, lastName: true, yearLevel: true } },
        questionSet: { select: { passThreshold: true } },
      },
      orderBy: [{ studentId: "asc" }, { submittedAt: "desc" }],
    }),
    prisma.question.findMany({
      include: {
        subject: { select: { id: true, courseCode: true, courseTitle: true } },
        topic: { select: { id: true, name: true } },
        _count: { select: { answers: true } },
      },
    }),
    prisma.user.findMany({
      where: studentFilter,
      select: { id: true, firstName: true, lastName: true, yearLevel: true },
    }),
  ]);

  const attemptPercentages = attempts
    .map((attempt) => attempt.percentage)
    .filter((value): value is number => value !== null);
  const scoreMedian = median(attemptPercentages);
  const overallScore =
    attemptPercentages.length > 0
      ? attemptPercentages.reduce((sum, value) => sum + value, 0) / attemptPercentages.length
      : 0;

  const avgThreshold =
    attempts.length > 0
      ? attempts.reduce((sum, attempt) => sum + attempt.questionSet.passThreshold, 0) /
        attempts.length
      : PASS_THRESHOLD;

  const subjectStats = new Map<
    string,
    { subjectId: string; subject: string; total: number; correct: number }
  >();
  const topicStats = new Map<
    string,
    {
      topicId: string;
      topic: string;
      subject: string;
      total: number;
      correct: number;
      timeTotal: number;
      timeCount: number;
    }
  >();
  const difficultyStats = new Map<string, { total: number; correct: number }>([
    ["EASY", { total: 0, correct: 0 }],
    ["MEDIUM", { total: 0, correct: 0 }],
    ["HARD", { total: 0, correct: 0 }],
  ]);
  const questionStats = new Map<
    string,
    {
      questionId: string;
      text: string;
      subject: string;
      topic: string | null;
      difficulty: string;
      correctOption: string;
      total: number;
      correct: number;
      incorrect: number;
      skipped: number;
      optionCounts: Record<string, number>;
      timeTotal: number;
      timeCount: number;
      highTotal: number;
      highCorrect: number;
      lowTotal: number;
      lowCorrect: number;
    }
  >();
  const studentSubjectStats = new Map<string, Map<string, { total: number; correct: number }>>();
  const studentTopicStats = new Map<string, Map<string, { total: number; correct: number }>>();

  for (const answer of answers) {
    const subjectId = answer.question.subject.id;
    const subjectLabel = `${answer.question.subject.courseCode} ${answer.question.subject.courseTitle}`;
    const topicId = answer.question.topic?.id ?? `${subjectId}-general`;
    const topicLabel = answer.question.topic?.name ?? "General";
    const difficulty = answer.question.difficulty;

    if (!subjectStats.has(subjectId)) {
      subjectStats.set(subjectId, { subjectId, subject: subjectLabel, total: 0, correct: 0 });
    }
    const subjectRow = subjectStats.get(subjectId)!;
    subjectRow.total += 1;
    if (answer.isCorrect) subjectRow.correct += 1;

    if (!topicStats.has(topicId)) {
      topicStats.set(topicId, {
        topicId,
        topic: topicLabel,
        subject: subjectLabel,
        total: 0,
        correct: 0,
        timeTotal: 0,
        timeCount: 0,
      });
    }
    const topicRow = topicStats.get(topicId)!;
    topicRow.total += 1;
    if (answer.isCorrect) topicRow.correct += 1;
    if (answer.timeSpentSeconds != null) {
      topicRow.timeTotal += answer.timeSpentSeconds;
      topicRow.timeCount += 1;
    }

    const diffRow = difficultyStats.get(difficulty)!;
    diffRow.total += 1;
    if (answer.isCorrect) diffRow.correct += 1;

    const studentId = answer.examAttempt.studentId;
    if (!studentSubjectStats.has(studentId)) studentSubjectStats.set(studentId, new Map());
    if (!studentSubjectStats.get(studentId)!.has(subjectId)) {
      studentSubjectStats.get(studentId)!.set(subjectId, { total: 0, correct: 0 });
    }
    const studentSubject = studentSubjectStats.get(studentId)!.get(subjectId)!;
    studentSubject.total += 1;
    if (answer.isCorrect) studentSubject.correct += 1;

    if (!studentTopicStats.has(studentId)) studentTopicStats.set(studentId, new Map());
    if (!studentTopicStats.get(studentId)!.has(topicId)) {
      studentTopicStats.get(studentId)!.set(topicId, { total: 0, correct: 0 });
    }
    const studentTopic = studentTopicStats.get(studentId)!.get(topicId)!;
    studentTopic.total += 1;
    if (answer.isCorrect) studentTopic.correct += 1;

    const questionId = answer.questionId;
    if (!questionStats.has(questionId)) {
      questionStats.set(questionId, {
        questionId,
        text: answer.question.text,
        subject: subjectLabel,
        topic: answer.question.topic?.name ?? null,
        difficulty,
        correctOption: answer.question.correctOption,
        total: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        optionCounts: { A: 0, B: 0, C: 0, D: 0 },
        timeTotal: 0,
        timeCount: 0,
        highTotal: 0,
        highCorrect: 0,
        lowTotal: 0,
        lowCorrect: 0,
      });
    }
    const questionRow = questionStats.get(questionId)!;
    questionRow.total += 1;

    if (!answer.selectedOption) {
      questionRow.skipped += 1;
    } else {
      questionRow.optionCounts[answer.selectedOption] += 1;
      if (answer.isCorrect) questionRow.correct += 1;
      else questionRow.incorrect += 1;

      const attemptPct = answer.examAttempt.percentage ?? 0;
      if (attemptPct >= scoreMedian) {
        questionRow.highTotal += 1;
        if (answer.isCorrect) questionRow.highCorrect += 1;
      } else {
        questionRow.lowTotal += 1;
        if (answer.isCorrect) questionRow.lowCorrect += 1;
      }
    }

    if (answer.timeSpentSeconds != null) {
      questionRow.timeTotal += answer.timeSpentSeconds;
      questionRow.timeCount += 1;
    }
  }

  const bySubject = [...subjectStats.values()]
    .map((row) => ({
      ...row,
      score: pct(row.correct, row.total),
      tone: scoreTone(pct(row.correct, row.total)),
    }))
    .sort((a, b) => a.score - b.score);

  const byTopic = [...topicStats.values()]
    .map((row) => ({
      topicId: row.topicId,
      topic: row.topic,
      subject: row.subject,
      total: row.total,
      correct: row.correct,
      score: pct(row.correct, row.total),
      avgTimeSeconds: row.timeCount > 0 ? row.timeTotal / row.timeCount : null,
      tone: scoreTone(pct(row.correct, row.total)),
    }))
    .sort((a, b) => a.score - b.score);

  const byDifficulty = [...difficultyStats.entries()].map(([difficulty, row]) => ({
    difficulty,
    total: row.total,
    correct: row.correct,
    score: pct(row.correct, row.total),
    tone: scoreTone(pct(row.correct, row.total)),
  }));

  const strongAreas = byTopic
    .filter((row) => row.total >= MIN_AREA_ATTEMPTS && row.score >= STRONG_THRESHOLD)
    .map((row) => ({
      label: `${row.topic} (${row.subject})`,
      score: row.score,
      type: "topic" as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const weakAreas = [...byTopic]
    .filter((row) => row.total >= MIN_AREA_ATTEMPTS && row.score <= WEAK_THRESHOLD)
    .map((row) => ({
      label: `${row.topic} (${row.subject})`,
      score: row.score,
      type: "topic" as const,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  const timeByTopic = byTopic
    .filter((row) => row.avgTimeSeconds != null)
    .map((row) => ({
      topic: row.topic,
      subject: row.subject,
      avgTimeSeconds: Math.round(row.avgTimeSeconds!),
    }))
    .sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds);

  const questionTimeRows = [...questionStats.values()]
    .filter((row) => row.timeCount > 0)
    .map((row) => ({
      questionId: row.questionId,
      text: row.text,
      subject: row.subject,
      topic: row.topic,
      avgTimeSeconds: Math.round(row.timeTotal / row.timeCount),
      correctRate: pct(row.correct, row.total),
    }));

  const questionAnalysis = [...questionStats.values()]
    .map((row) => {
      const correctRate = pct(row.correct, row.total);
      let flag: "too_easy" | "too_hard" | null = null;
      if (correctRate >= TOO_EASY_THRESHOLD) flag = "too_easy";
      else if (correctRate <= TOO_HARD_THRESHOLD && row.total >= 5) flag = "too_hard";

      return {
        questionId: row.questionId,
        text: row.text,
        subject: row.subject,
        topic: row.topic,
        difficulty: row.difficulty,
        correctRate,
        attempts: row.total,
        flag,
      };
    })
    .sort((a, b) => a.correctRate - b.correctRate);

  const distractorAnalysis = [...questionStats.values()]
    .filter((row) => row.incorrect > 0 && row.total >= 5)
    .map((row) => {
      const options = (["A", "B", "C", "D"] as const).map((option) => ({
        option,
        count: row.optionCounts[option],
        rate: pct(row.optionCounts[option], row.total),
        isCorrect: option === row.correctOption,
      }));
      const topWrong = [...options]
        .filter((option) => !option.isCorrect)
        .sort((a, b) => b.count - a.count)[0];

      return {
        questionId: row.questionId,
        text: row.text,
        subject: row.subject,
        correctOption: row.correctOption,
        correctRate: pct(row.correct, row.total),
        options,
        topWrongOption: topWrong?.option ?? null,
        topWrongRate: topWrong?.rate ?? 0,
      };
    })
    .filter((row) => row.topWrongRate >= 30)
    .sort((a, b) => b.topWrongRate - a.topWrongRate)
    .slice(0, 10);

  const latestAttemptByStudent = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttemptByStudent.has(attempt.studentId)) {
      latestAttemptByStudent.set(attempt.studentId, attempt);
    }
  }

  const readinessBuckets = [
    { label: "90–100%", min: 90, max: 100 },
    { label: "80–89%", min: 80, max: 89.99 },
    { label: "70–79%", min: 70, max: 79.99 },
    { label: "60–69%", min: 60, max: 69.99 },
    { label: "Below 60%", min: 0, max: 59.99 },
  ].map((bucket) => {
    const count = [...latestAttemptByStudent.values()].filter((attempt) => {
      const score = attempt.percentage ?? 0;
      return score >= bucket.min && score <= bucket.max;
    }).length;

    return { ...bucket, students: count };
  });

  const atRiskStudents = students
    .map((student) => {
      const latest = latestAttemptByStudent.get(student.id);
      const overall = latest?.percentage ?? null;
      const reasons: string[] = [];

      if (overall != null && overall < AT_RISK_THRESHOLD) {
        reasons.push(`Overall score ${overall.toFixed(1)}%`);
      }

      const subjectMap = studentSubjectStats.get(student.id);
      if (subjectMap) {
        for (const [subjectId, row] of subjectMap) {
          if (row.total >= 5) {
            const subjectScore = pct(row.correct, row.total);
            if (subjectScore < WEAK_THRESHOLD) {
              const subjectLabel = subjectStats.get(subjectId)?.subject ?? "Subject";
              reasons.push(`Failed ${subjectLabel} (${subjectScore.toFixed(0)}%)`);
            }
          }
        }
      }

      const topicMap = studentTopicStats.get(student.id);
      let weakTopicCount = 0;
      if (topicMap) {
        for (const [, row] of topicMap) {
          if (row.total >= MIN_AREA_ATTEMPTS && pct(row.correct, row.total) < WEAK_THRESHOLD) {
            weakTopicCount += 1;
          }
        }
        if (weakTopicCount >= 2) {
          reasons.push(`Failed ${weakTopicCount} topics`);
        }
      }

      if (reasons.length === 0) return null;

      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        yearLevel: student.yearLevel,
        overallScore: overall,
        reasons,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0));

  const batchStats = new Map<number, { total: number; sum: number; count: number }>();
  for (const attempt of latestAttemptByStudent.values()) {
    const year = attempt.student.yearLevel;
    if (!year) continue;
    if (!batchStats.has(year)) batchStats.set(year, { total: 0, sum: 0, count: 0 });
    const row = batchStats.get(year)!;
    row.sum += attempt.percentage ?? 0;
    row.count += 1;
    row.total += 1;
  }

  const batchComparison = [...batchStats.entries()]
    .map(([yearLevel, row]) => ({
      yearLevel,
      average: row.count > 0 ? row.sum / row.count : 0,
      students: row.total,
    }))
    .sort((a, b) => a.yearLevel - b.yearLevel);

  const inventoryMap = new Map<
    string,
    { subject: string; easy: number; medium: number; hard: number }
  >();
  for (const question of questions) {
    const subjectId = question.subject.id;
    const subjectLabel = `${question.subject.courseCode} ${question.subject.courseTitle}`;
    if (!inventoryMap.has(subjectId)) {
      inventoryMap.set(subjectId, { subject: subjectLabel, easy: 0, medium: 0, hard: 0 });
    }
    const row = inventoryMap.get(subjectId)!;
    if (question.difficulty === "EASY") row.easy += 1;
    else if (question.difficulty === "MEDIUM") row.medium += 1;
    else row.hard += 1;
  }

  const questionInventory = [...inventoryMap.values()].sort((a, b) =>
    a.subject.localeCompare(b.subject)
  );

  const usageFrequency = [...questionStats.values()]
    .map((row) => ({
      questionId: row.questionId,
      text: row.text,
      subject: row.subject,
      topic: row.topic,
      timesUsed: row.total,
    }))
    .sort((a, b) => b.timesUsed - a.timesUsed);

  const questionReliability = [...questionStats.values()]
    .filter((row) => row.total >= 5)
    .map((row) => {
      const highRate = row.highTotal > 0 ? row.highCorrect / row.highTotal : 0;
      const lowRate = row.lowTotal > 0 ? row.lowCorrect / row.lowTotal : 0;
      const discriminationIndex =
        row.highTotal > 0 && row.lowTotal > 0 ? highRate - lowRate : null;

      return {
        questionId: row.questionId,
        text: row.text,
        subject: row.subject,
        topic: row.topic,
        correctRate: pct(row.correct, row.total),
        avgTimeSeconds: row.timeCount > 0 ? Math.round(row.timeTotal / row.timeCount) : null,
        discriminationIndex,
        attempts: row.total,
      };
    })
    .sort((a, b) => (a.discriminationIndex ?? 0) - (b.discriminationIndex ?? 0));

  return {
    readiness: {
      overallScore,
      passingThreshold: avgThreshold,
      readinessLevel: readinessLevel(overallScore, avgThreshold),
      studentsAssessed: latestAttemptByStudent.size,
      examsTaken: attempts.length,
    },
    bySubject,
    byTopic,
    byDifficulty,
    knowledgeGaps: {
      strongAreas,
      weakAreas,
    },
    timeAnalytics: {
      byTopic: timeByTopic,
      fastestQuestions: [...questionTimeRows].sort((a, b) => a.avgTimeSeconds - b.avgTimeSeconds).slice(0, 8),
      slowestQuestions: [...questionTimeRows].sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds).slice(0, 8),
      hasTimedData: questionTimeRows.length > 0,
    },
    questionAnalysis,
    distractorAnalysis,
    readinessDistribution: readinessBuckets,
    atRiskStudents,
    batchComparison,
    questionInventory,
    usageFrequency: usageFrequency.slice(0, 20),
    questionReliability,
  };
}

export async function buildStudentAnalyticsReport(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, firstName: true, lastName: true, yearLevel: true, role: true },
  });

  if (!student || student.role !== Role.STUDENT) {
    return null;
  }

  const fullReport = await buildAnalyticsReports(student.yearLevel ?? undefined);

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: 1,
    include: { questionSet: { select: { passThreshold: true } } },
  });

  const latest = attempts[0];
  const overallScore = latest?.percentage ?? 0;
  const threshold = latest?.questionSet.passThreshold ?? PASS_THRESHOLD;

  return {
    student: {
      ...student,
      name: formatFullName(student.firstName, student.lastName),
    },
    readiness: {
      overallScore,
      passingThreshold: threshold,
      readinessLevel: readinessLevel(overallScore, threshold),
    },
    bySubject: fullReport.bySubject,
    byTopic: fullReport.byTopic,
    byDifficulty: fullReport.byDifficulty,
    knowledgeGaps: fullReport.knowledgeGaps,
    timeAnalytics: fullReport.timeAnalytics,
  };
}
