import { PrismaClient, Role } from "@prisma/client";

export const TRIAL_STUDENT_PROGRAM = "MECHANICAL_ENGINEERING" as const;
export const TRIAL_STUDENT_YEAR_LEVEL = 1;
export const TRIAL_STUDENT_COUNT = 30;
export const TRIAL_STUDENT_PASSWORD = "password123";

export function trialStudentEmail(index: number) {
  if (!Number.isInteger(index) || index < 1 || index > TRIAL_STUDENT_COUNT) {
    throw new Error(`Trial student index must be 1–${TRIAL_STUDENT_COUNT}.`);
  }
  return `student${String(index).padStart(2, "0")}@secsa.local`;
}

export function trialStudentEmails() {
  return Array.from({ length: TRIAL_STUDENT_COUNT }, (_, i) => trialStudentEmail(i + 1));
}

export async function removeTrialStudents(prisma: PrismaClient) {
  const emails = trialStudentEmails();
  const students = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });

  for (const student of students) {
    await prisma.retakeApproval.deleteMany({ where: { studentId: student.id } });
    await prisma.examAttempt.deleteMany({ where: { studentId: student.id } });
  }

  const removed = await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });

  return { users: removed.count, emails: students.map((row) => row.email) };
}
