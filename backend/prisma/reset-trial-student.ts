import { PrismaClient } from "@prisma/client";
import { trialStudentEmail } from "./trial-students.js";

const prisma = new PrismaClient();
const index = Number(process.argv[2] ?? 1);
const email = trialStudentEmail(index);

async function main() {
  const student = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, yearLevel: true, programCourse: true },
  });

  if (!student) {
    console.log(`No account found for ${email}.`);
    return;
  }

  const retakeApprovals = await prisma.retakeApproval.deleteMany({
    where: { studentId: student.id },
  });
  const examAttempts = await prisma.examAttempt.deleteMany({
    where: { studentId: student.id },
  });

  const updated = await prisma.user.update({
    where: { id: student.id },
    data: {
      yearLevel: 1,
      programCourse: "MECHANICAL_ENGINEERING",
      isActive: true,
    },
    select: { email: true, yearLevel: true, programCourse: true },
  });

  console.log(`Reset complete for ${email}.`);
  console.log({
    email: updated.email,
    yearLevel: updated.yearLevel,
    programCourse: updated.programCourse,
    removedExamAttempts: examAttempts.count,
    removedRetakeApprovals: retakeApprovals.count,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
