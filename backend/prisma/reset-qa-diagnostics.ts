import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { ensureAnalyticsSubjects } from "./seed-analytics-subjects.js";
import { seedTrigonometryDemo } from "./seed-trigonometry-demo.js";

const prisma = new PrismaClient();

const QA_EMAIL = "qa@secsa.local";
const TEACHER_EMAIL = "teacher@secsa.local";

async function ensureQaAccount() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: {},
    create: {
      email: TEACHER_EMAIL,
      passwordHash,
      firstName: "Demo",
      lastName: "Teacher",
      role: Role.TEACHER,
    },
  });

  const qaStudent = await prisma.user.upsert({
    where: { email: QA_EMAIL },
    update: {
      qaUnlimited: true,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      isActive: true,
    },
    create: {
      email: QA_EMAIL,
      passwordHash,
      firstName: "QA",
      lastName: "Student",
      role: Role.STUDENT,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      qaUnlimited: true,
    },
  });

  return { teacher, qaStudent };
}

async function resetQaExamState(studentId: string) {
  const retakeApprovals = await prisma.retakeApproval.deleteMany({ where: { studentId } });
  const examAttempts = await prisma.examAttempt.deleteMany({ where: { studentId } });

  return {
    retakeApprovals: retakeApprovals.count,
    examAttempts: examAttempts.count,
  };
}

export async function resetQaDiagnosticsDeploy() {
  const { teacher, qaStudent } = await ensureQaAccount();
  const cleared = await resetQaExamState(qaStudent.id);

  await seedTrigonometryDemo({
    teacher,
    student: qaStudent,
    resetStudentAttempts: false,
    skipQuestionSets: true,
  });

  const demoContent = await ensureAnalyticsSubjects(teacher);

  return {
    qaEmail: qaStudent.email,
    cleared,
    demoContent,
  };
}

async function main() {
  const result = await resetQaDiagnosticsDeploy();

  console.log("QA diagnostics reset complete.");
  console.log({
    qaAccount: result.qaEmail,
    clearedAttempts: result.cleared.examAttempts,
    clearedRetakeApprovals: result.cleared.retakeApprovals,
    diagnosticSet: result.demoContent.diagnostic,
    itemsPerDiagnosticExam: result.demoContent.itemsPerDiagnosticExam,
    repairedSets: result.demoContent.repairedSets,
  });
  console.log("");
  console.log("QA account restored to year 2 / IT with unlimited takes.");
  console.log("Login: qa@secsa.local / password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
