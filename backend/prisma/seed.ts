import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { ensureAnalyticsSubjects } from "./seed-analytics-subjects.js";
import { ensureAllQuestionBloomLevels } from "./ensure-question-bloom-levels.js";
import { ensureDeployedExamPools } from "./ensure-deployed-exam-pools.js";
import { removeSeedStudents } from "./seed-cleanup-students.js";
import { seedTrigonometryDemo } from "./seed-trigonometry-demo.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const defaultPrograms = [
    { id: "prog_all", slug: "ALL_PROGRAMS", label: "All Programs", abbr: "ALL" },
    { id: "prog_ce", slug: "CIVIL_ENGINEERING", label: "Civil Engineering", abbr: "CE" },
    { id: "prog_me", slug: "MECHANICAL_ENGINEERING", label: "Mechanical Engineering", abbr: "ME" },
    { id: "prog_ee", slug: "ELECTRICAL_ENGINEERING", label: "Electrical Engineering", abbr: "EE" },
    { id: "prog_it", slug: "INFORMATION_TECHNOLOGY", label: "Information Technology", abbr: "IT" },
    { id: "prog_arch", slug: "ARCHITECTURE", label: "Architecture", abbr: "ARCH" },
  ];

  for (const program of defaultPrograms) {
    await prisma.program.upsert({
      where: { slug: program.slug },
      update: { label: program.label, abbr: program.abbr, isActive: true },
      create: program,
    });
  }

  const superadmin = await prisma.user.upsert({
    where: { email: "admin@secsa.local" },
    update: {},
    create: {
      email: "admin@secsa.local",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: Role.SUPERADMIN,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@secsa.local" },
    update: {},
    create: {
      email: "teacher@secsa.local",
      passwordHash,
      firstName: "Demo",
      lastName: "Teacher",
      role: Role.TEACHER,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@secsa.local" },
    update: {
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      isActive: true,
    },
    create: {
      email: "student@secsa.local",
      passwordHash,
      firstName: "Demo",
      lastName: "Student",
      role: Role.STUDENT,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
    },
  });

  const qaStudent = await prisma.user.upsert({
    where: { email: "qa@secsa.local" },
    update: {
      qaUnlimited: true,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      isActive: true,
    },
    create: {
      email: "qa@secsa.local",
      passwordHash,
      firstName: "QA",
      lastName: "Student",
      role: Role.STUDENT,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      qaUnlimited: true,
    },
  });

  const removedStudents = await removeSeedStudents(prisma);

  await seedTrigonometryDemo({
    teacher,
    student,
    resetStudentAttempts: false,
    skipQuestionSets: true,
  });

  const demoContent = await ensureAnalyticsSubjects(teacher);
  const bloomLevelsUpdated = await ensureAllQuestionBloomLevels(prisma);
  const examPoolsUpdated = await ensureDeployedExamPools(prisma);

  console.log("Seed complete.");
  console.log({
    superadmin: superadmin.email,
    teacher: teacher.email,
    student: student.email,
    qaStudent: qaStudent.email,
    removedAnalyticsDemoStudents: removedStudents.users,
  });
  console.log("Default password: password123");
  console.log("Demo content:", { ...demoContent, bloomLevelsUpdated, examPoolsUpdated });
  console.log("Real accounts such as @southlandcollege.edu.ph are kept.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
