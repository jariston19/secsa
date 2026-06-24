import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import {
  Difficulty,
  PrismaClient,
  QuestionSetStatus,
  QuestionSetType,
  Role,
  type User,
} from "@prisma/client";
import { ensureDemoImage } from "./seed-demo-images.js";
import { bloomLevelForSeed } from "../src/lib/bloomLevel.js";

const prisma = new PrismaClient();

const DEMO_PROGRAM_COURSES = [
  "INFORMATION_TECHNOLOGY",
  "CIVIL_ENGINEERING",
  "MECHANICAL_ENGINEERING",
  "ELECTRICAL_ENGINEERING",
  "ARCHITECTURE",
] as const;

const TRIG_QUESTIONS = [
  {
    text: "[Demo] On the unit circle shown, cos(θ) at the marked angle equals:",
    optionA: "0",
    optionB: "1",
    optionC: "√2/2",
    optionD: "-1",
    correctOption: "C",
    difficulty: Difficulty.EASY,
    imageKey: "unit-circle",
  },
  {
    text: "What is sin(90°)?",
    optionA: "0",
    optionB: "1",
    optionC: "-1",
    optionD: "0.5",
    correctOption: "B",
    difficulty: Difficulty.EASY,
  },
  {
    text: "What is cos(0°)?",
    optionA: "1",
    optionB: "0",
    optionC: "-1",
    optionD: "0.5",
    correctOption: "A",
    difficulty: Difficulty.EASY,
  },
  {
    text: "What is tan(45°)?",
    optionA: "0",
    optionB: "1",
    optionC: "√3",
    optionD: "1/2",
    correctOption: "B",
    difficulty: Difficulty.EASY,
  },
  {
    text: "On the unit circle, the x-coordinate of a point equals which function?",
    optionA: "sin θ",
    optionB: "cos θ",
    optionC: "tan θ",
    optionD: "sec θ",
    correctOption: "B",
    difficulty: Difficulty.EASY,
  },
  {
    text: "How many degrees are in π radians?",
    optionA: "90°",
    optionB: "180°",
    optionC: "360°",
    optionD: "270°",
    correctOption: "B",
    difficulty: Difficulty.EASY,
  },
  {
    text: "What is sin(30°)?",
    optionA: "1/2",
    optionB: "√3/2",
    optionC: "1",
    optionD: "0",
    correctOption: "A",
    difficulty: Difficulty.EASY,
  },
  {
    text: "What is cos(60°)?",
    optionA: "1/2",
    optionB: "√3/2",
    optionC: "0",
    optionD: "1",
    correctOption: "A",
    difficulty: Difficulty.EASY,
  },
  {
    text: "In a 30-60-90 triangle, if the side opposite 30° is 1, what is the hypotenuse?",
    optionA: "1",
    optionB: "2",
    optionC: "√3",
    optionD: "4",
    correctOption: "B",
    difficulty: Difficulty.EASY,
  },
  {
    text: "Which identity is always true for any angle θ?",
    optionA: "sin²θ + cos²θ = 0",
    optionB: "sin²θ + cos²θ = 1",
    optionC: "sin²θ + cos²θ = 2",
    optionD: "sin²θ - cos²θ = 1",
    correctOption: "B",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "What is sin(150°)?",
    optionA: "-1/2",
    optionB: "1/2",
    optionC: "-√3/2",
    optionD: "√3/2",
    correctOption: "B",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "What is the period of y = sin(x)?",
    optionA: "π",
    optionB: "2π",
    optionC: "π/2",
    optionD: "4π",
    correctOption: "B",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "What is arcsin(1/2)?",
    optionA: "30°",
    optionB: "60°",
    optionC: "45°",
    optionD: "90°",
    correctOption: "A",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "cot(θ) is equal to which expression?",
    optionA: "1 / sin θ",
    optionB: "1 / cos θ",
    optionC: "1 / tan θ",
    optionD: "tan θ",
    correctOption: "C",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "Which statement about cosine is correct?",
    optionA: "cos(-θ) = -cos θ",
    optionB: "cos(-θ) = cos θ",
    optionC: "cos(-θ) = sin θ",
    optionD: "cos(-θ) = -sin θ",
    correctOption: "B",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "Which is the correct double-angle formula for sine?",
    optionA: "sin(2θ) = 2 sin θ",
    optionB: "sin(2θ) = 2 sin θ cos θ",
    optionC: "sin(2θ) = sin²θ",
    optionD: "sin(2θ) = cos²θ",
    correctOption: "B",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "What is 5π/6 radians in degrees?",
    optionA: "150°",
    optionB: "120°",
    optionC: "210°",
    optionD: "300°",
    correctOption: "A",
    difficulty: Difficulty.MEDIUM,
  },
  {
    text: "If sin θ = 3/5 and θ is in Quadrant II, what is cos θ?",
    optionA: "-4/5",
    optionB: "4/5",
    optionC: "-3/5",
    optionD: "3/4",
    correctOption: "A",
    difficulty: Difficulty.HARD,
  },
  {
    text: "In the Law of Sines for triangle ABC, a / sin A equals which expression?",
    optionA: "b / sin B",
    optionB: "c cos A",
    optionC: "a cos B",
    optionD: "b / c",
    correctOption: "A",
    difficulty: Difficulty.HARD,
  },
  {
    text: "What is the exact value of cos(π/3)?",
    optionA: "1/2",
    optionB: "√3/2",
    optionC: "1",
    optionD: "0",
    correctOption: "A",
    difficulty: Difficulty.HARD,
  },
  {
    text: "What is the maximum value of y = 3 sin(x) + 1?",
    optionA: "1",
    optionB: "3",
    optionC: "4",
    optionD: "-2",
    correctOption: "C",
    difficulty: Difficulty.HARD,
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

async function ensureStudent() {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
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
}

async function resetStudentExamState(studentId: string) {
  await prisma.retakeApproval.deleteMany({ where: { studentId } });
  await prisma.examAttempt.deleteMany({ where: { studentId } });
}

async function upsertQuestionSet({
  name,
  type,
  yearLevel,
  programCourse,
  teacherId,
  subjectId,
  topicId,
}: {
  name: string;
  type: QuestionSetType;
  yearLevel: number;
  programCourse: "INFORMATION_TECHNOLOGY";
  teacherId: string;
  subjectId: string;
  topicId: string;
}) {
  const existing = await prisma.questionSet.findFirst({
    where: { name, yearLevel, programCourse, type },
    include: { configs: true },
  });

  const configData = {
    subjectId,
    topicId,
    easyCount: 8,
    mediumCount: 8,
    hardCount: 4,
  };

  if (existing) {
    await prisma.questionSetConfig.deleteMany({ where: { questionSetId: existing.id } });
    return prisma.questionSet.update({
      where: { id: existing.id },
      data: {
        totalItems: 20,
        passThreshold: 75,
        status: QuestionSetStatus.DEPLOYED,
        deployedAt: new Date(),
        configs: { create: [configData] },
      },
    });
  }

  await prisma.questionSet.updateMany({
    where: {
      yearLevel,
      programCourse,
      type,
      status: QuestionSetStatus.DEPLOYED,
    },
    data: { status: QuestionSetStatus.ARCHIVED },
  });

  return prisma.questionSet.create({
    data: {
      name,
      yearLevel,
      programCourse,
      type,
      status: QuestionSetStatus.DEPLOYED,
      totalItems: 20,
      passThreshold: 75,
      deployedAt: new Date(),
      createdById: teacherId,
      configs: { create: [configData] },
    },
  });
}

export async function seedTrigonometryDemo({
  teacher,
  student,
  resetStudentAttempts = true,
  skipQuestionSets = false,
}: {
  teacher: Pick<User, "id">;
  student?: Pick<User, "id">;
  resetStudentAttempts?: boolean;
  skipQuestionSets?: boolean;
}) {
  const subject = await prisma.subject.upsert({
    where: {
      courseCode: "MATH 105",
    },
    update: {
      courseTitle: "Trigonometry",
    },
    create: {
      courseCode: "MATH 105",
      courseTitle: "Trigonometry",
      yearLevel: 1,
      createdById: teacher.id,
    },
  });

  for (const programCourse of DEMO_PROGRAM_COURSES) {
    await prisma.subjectProgramCourse.upsert({
      where: {
        subjectId_programCourse: {
          subjectId: subject.id,
          programCourse,
        },
      },
      update: {},
      create: {
        subjectId: subject.id,
        programCourse,
      },
    });
  }

  const topic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: subject.id, name: "Trigonometry" } },
    update: {},
    create: {
      name: "Trigonometry",
      subjectId: subject.id,
    },
  });

  let createdQuestions = 0;
  for (const [index, q] of TRIG_QUESTIONS.entries()) {
    const { imageKey, ...questionData } = q as (typeof TRIG_QUESTIONS)[number] & {
      imageKey?: string;
    };
    const imagePath = imageKey ? await ensureDemoImage(imageKey) : undefined;
    const bloomLevel = bloomLevelForSeed(questionData.difficulty, index);

    const existing = await prisma.question.findFirst({
      where: { subjectId: subject.id, text: q.text },
    });
    if (!existing) {
      await prisma.question.create({
        data: {
          ...questionData,
          bloomLevel,
          imagePath,
          subjectId: subject.id,
          topicId: topic.id,
          createdById: teacher.id,
        },
      });
      createdQuestions += 1;
    } else if (imagePath && existing.imagePath !== imagePath) {
      await prisma.question.update({
        where: { id: existing.id },
        data: { imagePath, bloomLevel },
      });
    } else if (existing.bloomLevel !== bloomLevel) {
      await prisma.question.update({
        where: { id: existing.id },
        data: { bloomLevel },
      });
    }
  }

  let diagnostic = null;
  let retake = null;

  if (!skipQuestionSets) {
    diagnostic = await upsertQuestionSet({
      name: "IT Y2 Trigonometry Diagnostic",
      type: QuestionSetType.COMPREHENSIVE,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
    });

    retake = await upsertQuestionSet({
      name: "IT Y2 Trigonometry Retake 1",
      type: QuestionSetType.RETAKE,
      yearLevel: 2,
      programCourse: "INFORMATION_TECHNOLOGY",
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
    });
  }

  if (resetStudentAttempts && student) {
    await resetStudentExamState(student.id);
  }

  const questionCount = await prisma.question.count({
    where: { subjectId: subject.id, topicId: topic.id },
  });

  return {
    subject: `${subject.courseCode} - ${subject.courseTitle} (curriculum year ${subject.yearLevel})`,
    topic: topic.name,
    questionsInTopic: questionCount,
    newQuestionsAdded: createdQuestions,
    diagnosticSet: diagnostic?.name ?? null,
    retakeSet: retake?.name ?? null,
    student: student?.id ?? null,
  };
}

async function main() {
  const teacher = await ensureTeacher();
  const student = await ensureStudent();
  const result = await seedTrigonometryDemo({ teacher, student });

  console.log("Trigonometry demo seed complete.");
  console.log(result);
  console.log("");
  console.log("Test flow:");
  console.log("1. Log in as student@secsa.local / password123");
  console.log("2. Start the comprehensive exam (20 trig questions, 75% to pass)");
  console.log("3. Submit with failing score — you should appear in Retake Approvals");
  console.log("4. Log in as teacher@secsa.local and approve from Retake Approvals tab");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
