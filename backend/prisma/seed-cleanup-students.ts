import { PrismaClient } from "@prisma/client";

export const ANALYTICS_DEMO_EMAIL_SUFFIX = "@analytics.demo.secsa.local";

export async function removeSeedStudents(prisma: PrismaClient) {
  const seedStudents = await prisma.user.findMany({
    where: {
      email: { endsWith: ANALYTICS_DEMO_EMAIL_SUFFIX },
    },
    select: { id: true, email: true },
  });

  for (const student of seedStudents) {
    await prisma.retakeApproval.deleteMany({ where: { studentId: student.id } });
    await prisma.examAttempt.deleteMany({ where: { studentId: student.id } });
  }

  const removed = await prisma.user.deleteMany({
    where: {
      email: { endsWith: ANALYTICS_DEMO_EMAIL_SUFFIX },
    },
  });

  return { users: removed.count, emails: seedStudents.map((row) => row.email) };
}
