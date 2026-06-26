import { Role } from "@prisma/client";
import { prisma } from "./prisma.js";

export function parseExamYearQuery(value?: string) {
  const year = Number(value);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return undefined;
  return year;
}

export function submittedAtFilter(examYear?: number) {
  if (!Number.isFinite(examYear)) {
    return { not: null as Date | null };
  }
  const y = examYear as number;
  return {
    not: null as Date | null,
    gte: new Date(Date.UTC(y, 0, 1)),
    lt: new Date(Date.UTC(y + 1, 0, 1)),
  };
}

export async function listAvailableExamYears() {
  const attempts = await prisma.examAttempt.findMany({
    where: {
      submittedAt: { not: null },
      student: { role: Role.STUDENT, qaUnlimited: false },
    },
    select: { submittedAt: true },
  });

  const years = new Set<number>();
  for (const attempt of attempts) {
    if (attempt.submittedAt) {
      years.add(attempt.submittedAt.getUTCFullYear());
    }
  }

  return [...years].sort((a, b) => b - a);
}
