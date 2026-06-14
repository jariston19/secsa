import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const defaultPrograms = [
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

  console.log("Seed complete.");
  console.log({
    superadmin: superadmin.email,
    teacher: teacher.email,
    student: student.email,
    qaStudent: qaStudent.email,
  });
  console.log("Default password: password123");
  console.log("No subjects, topics, questions, or exam data — start fresh from Saved.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
