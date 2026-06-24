import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findDuplicateUserEmail(
  prisma: PrismaClientLike,
  email: string,
  excludeId?: string
) {
  const normalizedEmail = normalizeUserEmail(email);

  const exact = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (exact && exact.id !== excludeId) return exact;

  const candidates = await prisma.user.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  return candidates.find((user) => normalizeUserEmail(user.email) === normalizedEmail) ?? null;
}

