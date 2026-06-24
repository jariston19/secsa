import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export function formatCourseCode(courseCode: string) {
  return courseCode.trim().replace(/\s+/g, " ");
}

export function normalizeCourseCode(courseCode: string) {
  return formatCourseCode(courseCode).toLowerCase();
}

export async function findDuplicateCourseCode(
  prisma: PrismaClientLike,
  courseCode: string,
  excludeId?: string
) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) return null;

  const candidates = await prisma.subject.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: {
      id: true,
      courseCode: true,
      courseTitle: true,
      yearLevel: true,
    },
  });

  return (
    candidates.find((subject) => normalizeCourseCode(subject.courseCode) === normalizedCode) ?? null
  );
}
