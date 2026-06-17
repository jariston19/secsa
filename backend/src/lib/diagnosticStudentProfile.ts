import { BloomLevel } from "@prisma/client";
import {
  BLOOM_LEVEL_LABELS,
  BLOOM_LEVEL_ORDER,
  buildBloomCognitiveProfile,
  type BloomScoreRow,
} from "./bloomLevel.js";
import { prisma } from "./prisma.js";

const STRONG_THRESHOLD = 75;
const WEAK_THRESHOLD = 50;

export type DiagnosticAreaInsight = {
  label: string;
  type: "subject" | "topic";
  tone: "strong" | "weak";
  message: string;
};

export type StudentExamProfile = {
  strongAreas: DiagnosticAreaInsight[];
  weakAreas: DiagnosticAreaInsight[];
  qualities: string[];
  bloomLevels: Array<{
    bloomLevel: BloomLevel;
    label: string;
    tone: "strong" | "moderate" | "weak";
  }>;
};

/** @deprecated Use StudentExamProfile */
export type DiagnosticStudentProfile = StudentExamProfile;

export type ExamProfileVariant = "diagnostic" | "comprehensive";

export async function buildStudentExamProfile(
  attemptId: string,
  variant: ExamProfileVariant = "diagnostic"
): Promise<StudentExamProfile> {
  const answers = await prisma.examAnswer.findMany({
    where: { examAttemptId: attemptId, selectedOption: { not: null } },
    include: {
      question: {
        include: {
          subject: { select: { id: true, courseCode: true, courseTitle: true } },
          topic: { select: { id: true, name: true } },
        },
      },
    },
  });

  const topicStats = new Map<string, { label: string; correct: number; total: number }>();
  const subjectStats = new Map<string, { label: string; correct: number; total: number }>();
  const bloomStats = new Map<BloomLevel, { correct: number; total: number }>();

  for (const answer of answers) {
    const subjectLabel = `${answer.question.subject.courseCode} — ${answer.question.subject.courseTitle}`;
    const topicKey = answer.question.topic?.id ?? `${answer.question.subject.id}-general`;
    const topicLabel = answer.question.topic?.name ?? subjectLabel;

    if (!topicStats.has(topicKey)) {
      topicStats.set(topicKey, { label: topicLabel, correct: 0, total: 0 });
    }
    if (!subjectStats.has(answer.question.subject.id)) {
      subjectStats.set(answer.question.subject.id, {
        label: subjectLabel,
        correct: 0,
        total: 0,
      });
    }
    if (!bloomStats.has(answer.question.bloomLevel)) {
      bloomStats.set(answer.question.bloomLevel, { correct: 0, total: 0 });
    }

    const topicRow = topicStats.get(topicKey)!;
    const subjectRow = subjectStats.get(answer.question.subject.id)!;
    const bloomRow = bloomStats.get(answer.question.bloomLevel)!;

    topicRow.total += 1;
    subjectRow.total += 1;
    bloomRow.total += 1;
    if (answer.isCorrect) {
      topicRow.correct += 1;
      subjectRow.correct += 1;
      bloomRow.correct += 1;
    }
  }

  const topicRows = [...topicStats.values()]
    .filter((row) => row.total > 0)
    .map((row) => ({ ...row, score: pct(row.correct, row.total) }))
    .sort((a, b) => b.score - a.score);

  const subjectRows = [...subjectStats.values()]
    .filter((row) => row.total > 0)
    .map((row) => ({ ...row, score: pct(row.correct, row.total) }))
    .sort((a, b) => b.score - a.score);

  const strongAreas: DiagnosticAreaInsight[] = [];
  const weakAreas: DiagnosticAreaInsight[] = [];

  for (const row of topicRows) {
    const tone = scoreTone(row.score);
    if (tone === "strong") {
      strongAreas.push({
        label: row.label,
        type: "topic",
        tone,
        message: areaMessage(row.label, "strong"),
      });
    } else if (tone === "weak") {
      weakAreas.push({
        label: row.label,
        type: "topic",
        tone,
        message: areaMessage(row.label, "weak"),
      });
    }
  }

  if (strongAreas.length === 0) {
    for (const row of subjectRows.filter((item) => scoreTone(item.score) === "strong").slice(0, 3)) {
      strongAreas.push({
        label: row.label,
        type: "subject",
        tone: "strong",
        message: areaMessage(row.label, "strong"),
      });
    }
  }

  if (weakAreas.length === 0) {
    for (const row of subjectRows.filter((item) => scoreTone(item.score) === "weak").slice(0, 3)) {
      weakAreas.push({
        label: row.label,
        type: "subject",
        tone: "weak",
        message: areaMessage(row.label, "weak"),
      });
    }
  }

  const bloomLevels = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const stats = bloomStats.get(bloomLevel);
    const score = stats ? pct(stats.correct, stats.total) : 0;
    return {
      bloomLevel,
      label: BLOOM_LEVEL_LABELS[bloomLevel],
      tone: stats ? scoreTone(score) : ("moderate" as const),
    };
  }).filter((row) => bloomStats.has(row.bloomLevel));

  const bloomScoreRows: BloomScoreRow[] = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const stats = bloomStats.get(bloomLevel);
    return {
      bloomLevel,
      score: stats ? pct(stats.correct, stats.total) : 0,
      total: stats?.total ?? 0,
    };
  });

  const cognitiveProfile = buildBloomCognitiveProfile(bloomScoreRows);
  const qualities: string[] = [];

  if (cognitiveProfile) {
    qualities.push(cognitiveProfile.message);
  }

  if (strongAreas.length > 0) {
    qualities.push(
      `Strengths cluster around ${strongAreas
        .slice(0, 3)
        .map((area) => area.label)
        .join(", ")}.`
    );
  }

  if (weakAreas.length > 0) {
    qualities.push(
      `Focus areas for growth include ${weakAreas
        .slice(0, 3)
        .map((area) => area.label)
        .join(", ")}.`
    );
  }

  if (qualities.length === 0) {
    qualities.push(
      variant === "diagnostic"
        ? "Your diagnostic is complete. Teachers will use this profile to guide early support."
        : "Your comprehensive exam is complete. Use this evaluation to see where you are strong and what to review next."
    );
  }

  return {
    strongAreas: strongAreas.slice(0, 5),
    weakAreas: weakAreas.slice(0, 5),
    qualities,
    bloomLevels,
  };
}

export async function buildDiagnosticStudentProfile(attemptId: string) {
  return buildStudentExamProfile(attemptId, "diagnostic");
}

function pct(correct: number, total: number) {
  return total > 0 ? (correct / total) * 100 : 0;
}

function scoreTone(score: number): "strong" | "moderate" | "weak" {
  if (score >= STRONG_THRESHOLD) return "strong";
  if (score >= WEAK_THRESHOLD) return "moderate";
  return "weak";
}

function areaMessage(label: string, tone: "strong" | "weak") {
  if (tone === "strong") {
    return `You showed solid understanding in ${label}.`;
  }
  return `${label} may need more practice and review.`;
}
