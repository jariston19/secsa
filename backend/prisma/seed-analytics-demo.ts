import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { Difficulty, PrismaClient, Role, type User } from "@prisma/client";

import { bloomLevelForSeed } from "../src/lib/bloomLevel.js";
import { ensureAnalyticsSubjects } from "./seed-analytics-subjects.js";
import { removeSeedStudents } from "./seed-cleanup-students.js";
import { seedTrigonometryDemo } from "./seed-trigonometry-demo.js";

const prisma = new PrismaClient();

const EXTRA_TOPICS = [
  {
    name: "Unit Circle",
    questions: [
      {
        text: "[Demo] Which quadrant is 120° in?",
        optionA: "I",
        optionB: "II",
        optionC: "III",
        optionD: "IV",
        correctOption: "B",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] What is the reference angle for 210°?",
        optionA: "30°",
        optionB: "210°",
        optionC: "150°",
        optionD: "60°",
        correctOption: "A",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] On the unit circle, sin(π/2) equals?",
        optionA: "0",
        optionB: "1",
        optionC: "-1",
        optionD: "1/2",
        correctOption: "B",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] Which angle is coterminal with -45°?",
        optionA: "45°",
        optionB: "135°",
        optionC: "315°",
        optionD: "225°",
        correctOption: "C",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] Convert 7π/4 radians to degrees.",
        optionA: "225°",
        optionB: "315°",
        optionC: "135°",
        optionD: "270°",
        correctOption: "B",
        difficulty: Difficulty.HARD,
      },
      {
        text: "[Demo] If terminal side passes through (-1, 0), which function is 0?",
        optionA: "sin θ",
        optionB: "cos θ",
        optionC: "tan θ",
        optionD: "sec θ",
        correctOption: "A",
        difficulty: Difficulty.HARD,
      },
    ],
  },
  {
    name: "Identities",
    questions: [
      {
        text: "[Demo] Simplify sin²θ + cos²θ.",
        optionA: "0",
        optionB: "1",
        optionC: "2",
        optionD: "tan θ",
        correctOption: "B",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] Which is equivalent to tan θ?",
        optionA: "sin θ / cos θ",
        optionB: "cos θ / sin θ",
        optionC: "1 / sin θ",
        optionD: "sin θ cos θ",
        correctOption: "A",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] cos(2θ) in terms of cos θ only?",
        optionA: "2 cos²θ - 1",
        optionB: "1 - 2 sin θ",
        optionC: "2 sin θ cos θ",
        optionD: "cos²θ + sin²θ",
        correctOption: "A",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] sin(α + β) expands to?",
        optionA: "sin α + sin β",
        optionB: "sin α cos β + cos α sin β",
        optionC: "cos α cos β - sin α sin β",
        optionD: "sin α cos β - cos α sin β",
        correctOption: "B",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] Which identity helps integrate sin²x?",
        optionA: "(1 - cos 2x) / 2",
        optionB: "(1 + cos 2x) / 2",
        optionC: "sin x cos x",
        optionD: "1 - sin x",
        correctOption: "A",
        difficulty: Difficulty.HARD,
      },
      {
        text: "[Demo] sec²θ - tan²θ equals?",
        optionA: "0",
        optionB: "1",
        optionC: "2",
        optionD: "-1",
        correctOption: "B",
        difficulty: Difficulty.HARD,
      },
    ],
  },
  {
    name: "Applications",
    questions: [
      {
        text: "[Demo] A 10 m ladder leans at 60°. Height reached?",
        optionA: "5 m",
        optionB: "8.66 m",
        optionC: "10 m",
        optionD: "7.5 m",
        correctOption: "B",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] From 50 m away, angle of elevation is 30°. Height?",
        optionA: "25 m",
        optionB: "28.9 m",
        optionC: "43.3 m",
        optionD: "50 m",
        correctOption: "B",
        difficulty: Difficulty.EASY,
      },
      {
        text: "[Demo] Ship bearing N30°E means?",
        optionA: "30° east of north",
        optionB: "30° north of east",
        optionC: "60° east of south",
        optionD: "30° west of north",
        correctOption: "A",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] Simple harmonic motion x = 4 cos(2t). Amplitude?",
        optionA: "2",
        optionB: "4",
        optionC: "8",
        optionD: "1",
        correctOption: "B",
        difficulty: Difficulty.MEDIUM,
      },
      {
        text: "[Demo] Two sides 7 and 9 with included angle 40°. Use?",
        optionA: "Law of Sines only",
        optionB: "Law of Cosines",
        optionC: "Pythagorean theorem",
        optionD: "Unit circle",
        correctOption: "B",
        difficulty: Difficulty.HARD,
      },
      {
        text: "[Demo] Ferris wheel radius 12 m, 3 rpm. Linear speed at rim?",
        optionA: "1.2π m/s",
        optionB: "2.4π m/s",
        optionC: "12 m/s",
        optionD: "36π m/s",
        correctOption: "A",
        difficulty: Difficulty.HARD,
      },
    ],
  },
] as const;

async function ensureTeacher() {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
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
}

async function ensureExtraTopics(teacherId: string, subjectId: string) {
  for (const topicPlan of EXTRA_TOPICS) {
    const topic = await prisma.topic.upsert({
      where: { subjectId_name: { subjectId, name: topicPlan.name } },
      update: {},
      create: { name: topicPlan.name, subjectId },
    });

    for (const [index, question] of topicPlan.questions.entries()) {
      const existing = await prisma.question.findFirst({
        where: { subjectId, text: question.text },
      });
      if (!existing) {
        await prisma.question.create({
          data: {
            ...question,
            bloomLevel: bloomLevelForSeed(question.difficulty, index),
            subjectId,
            topicId: topic.id,
            createdById: teacherId,
          },
        });
      }
    }
  }
}

async function ensurePrerequisites(teacher: Pick<User, "id">) {
  const mathSubject = await prisma.subject.findFirst({
    where: { courseCode: "MATH 105" },
  });

  if (!mathSubject) {
    console.log("Bootstrapping MATH 105 subject and questions…");
    await seedTrigonometryDemo({
      teacher,
      resetStudentAttempts: false,
      skipQuestionSets: true,
    });
  }

  console.log("Ensuring diagnostic, comprehensive, and retake exam sets…");
  return ensureAnalyticsSubjects(teacher);
}

export async function seedAnalyticsContent(teacher: Pick<User, "id">) {
  const removedStudents = await removeSeedStudents(prisma);

  const mathSubject = await prisma.subject.findFirst({
    where: { courseCode: "MATH 105" },
    select: { id: true },
  });
  if (!mathSubject) {
    throw new Error("MATH 105 subject not found after bootstrap.");
  }

  await ensureExtraTopics(teacher.id, mathSubject.id);
  const demoContent = await ensurePrerequisites(teacher);

  return {
    removedStudents,
    demoContent,
  };
}

async function main() {
  const teacher = await ensureTeacher();
  const result = await seedAnalyticsContent(teacher);

  console.log("Exam content seed complete.");
  console.log(result);
  console.log("");
  console.log("Removed seed/demo students:", result.removedStudents.users);
  console.log("Kept real accounts such as @southlandcollege.edu.ph");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
