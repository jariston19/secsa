import bcrypt from "bcryptjs";
import { Difficulty, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const superadmin = await prisma.user.upsert({
    where: { email: "admin@secsa.local" },
    update: {},
    create: {
      email: "admin@secsa.local",
      passwordHash,
      name: "Super Admin",
      role: Role.SUPERADMIN,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@secsa.local" },
    update: {},
    create: {
      email: "teacher@secsa.local",
      passwordHash,
      name: "Demo Teacher",
      role: Role.TEACHER,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@secsa.local" },
    update: {},
    create: {
      email: "student@secsa.local",
      passwordHash,
      name: "Demo Student",
      role: Role.STUDENT,
      yearLevel: 2,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { courseCode_yearLevel: { courseCode: "ACEE 106", yearLevel: 1 } },
    update: {},
    create: {
      courseCode: "ACEE 106",
      courseTitle: "Electromagnetics",
      yearLevel: 1,
      createdById: teacher.id,
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

  console.log("Seed complete.");
  console.log({ superadmin: superadmin.email, teacher: teacher.email, student: student.email });
  console.log("Default password: password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
