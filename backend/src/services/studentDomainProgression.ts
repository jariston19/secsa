import { BloomLevel } from "@prisma/client";
import {
  BLOOM_LEVEL_LABELS,
  BLOOM_LEVEL_ORDER,
  BLOOM_LEVEL_SHORT_LABELS,
} from "../lib/bloomLevel.js";
import { prisma } from "../lib/prisma.js";
import { maxYearLevelForProgram, MIN_YEAR_LEVEL } from "../lib/yearLevel.js";

function pct(correct: number, total: number) {
  return total > 0 ? (correct / total) * 100 : 0;
}

export async function buildStudentDomainProgression(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { programCourse: true },
  });

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId, submittedAt: { not: null } },
    include: {
      questionSet: { select: { yearLevel: true } },
      answers: {
        where: { selectedOption: { not: null } },
        include: { question: { select: { bloomLevel: true } } },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  const latestByYear = new Map<number, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    latestByYear.set(attempt.questionSet.yearLevel, attempt);
  }

  const maxYearLevel = maxYearLevelForProgram(student?.programCourse);
  const yearLevels = Array.from(
    { length: maxYearLevel - MIN_YEAR_LEVEL + 1 },
    (_, index) => MIN_YEAR_LEVEL + index
  );

  const domains = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const points = yearLevels.map((yearLevel) => {
      const attempt = latestByYear.get(yearLevel);
      if (!attempt) {
        return { yearLevel, score: null as number | null, hasData: false };
      }

      let correct = 0;
      let total = 0;
      for (const answer of attempt.answers) {
        if (answer.question.bloomLevel !== bloomLevel) continue;
        total += 1;
        if (answer.isCorrect) correct += 1;
      }

      if (total === 0) {
        return { yearLevel, score: null, hasData: false };
      }

      return {
        yearLevel,
        score: Math.round(pct(correct, total)),
        hasData: true,
      };
    });

    return {
      bloomLevel,
      label: BLOOM_LEVEL_LABELS[bloomLevel],
      shortLabel: BLOOM_LEVEL_SHORT_LABELS[bloomLevel],
      points,
    };
  });

  const hasAnyData = domains.some((domain) => domain.points.some((point) => point.hasData));

  return { domains, hasAnyData };
}

export type StudentDomainProgression = Awaited<ReturnType<typeof buildStudentDomainProgression>>;
