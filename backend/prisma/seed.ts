import bcrypt from "bcryptjs";
import { Difficulty, PrismaClient, Role } from "@prisma/client";
import { seedTrigonometryDemo } from "./seed-trigonometry-demo.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

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
    update: {},
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

  const subject = await prisma.subject.upsert({
    where: {
      courseCode_yearLevel: {
        courseCode: "ACEE 106",
        yearLevel: 1,
      },
    },
    update: {},
    create: {
      courseCode: "ACEE 106",
      courseTitle: "Electromagnetics",
      yearLevel: 1,
      createdById: teacher.id,
    },
  });

  await prisma.subjectProgramCourse.upsert({
    where: {
      subjectId_programCourse: {
        subjectId: subject.id,
        programCourse: "INFORMATION_TECHNOLOGY",
      },
    },
    update: {},
    create: {
      subjectId: subject.id,
      programCourse: "INFORMATION_TECHNOLOGY",
    },
  });

  const topic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: subject.id, name: "Magnetic Fields" } },
    update: {},
    create: {
      name: "Magnetic Fields",
      subjectId: subject.id,
    },
  });

  const questions = [
    {
      text: "What is the SI unit of magnetic flux?",
      optionA: "Tesla",
      optionB: "Weber",
      optionC: "Henry",
      optionD: "Gauss",
      correctOption: "B",
      difficulty: Difficulty.EASY,
    },
    {
      text: "Which law relates induced EMF to changing magnetic flux?",
      optionA: "Ampere's Law",
      optionB: "Faraday's Law",
      optionC: "Gauss's Law",
      optionD: "Coulomb's Law",
      correctOption: "B",
      difficulty: Difficulty.MEDIUM,
    },
    {
      text: "What is the curl of B in free space with current density J?",
      optionA: "μ0 J",
      optionB: "ε0 E",
      optionC: "μ0 ε0 ∂E/∂t",
      optionD: "0",
      correctOption: "A",
      difficulty: Difficulty.HARD,
    },
  ];

  for (const q of questions) {
    const existing = await prisma.question.findFirst({
      where: { subjectId: subject.id, text: q.text },
    });
    if (!existing) {
      await prisma.question.create({
        data: {
          ...q,
          subjectId: subject.id,
          topicId: topic.id,
          createdById: teacher.id,
        },
      });
    }
  }

  const trigDemo = await seedTrigonometryDemo({
    teacher,
    student,
    resetStudentAttempts: false,
  });

  console.log("Seed complete.");
  console.log({
    superadmin: superadmin.email,
    teacher: teacher.email,
    student: student.email,
    qaStudent: qaStudent.email,
    trigonometryDemo: trigDemo,
  });
  console.log("Default password: password123");
  console.log("QA student (unlimited exam takes): qa@secsa.local / password123 (year level 2)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
