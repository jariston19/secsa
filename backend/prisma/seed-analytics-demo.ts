import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import {
  ApprovalStatus,
  AttemptType,
  Difficulty,
  PrismaClient,
  QuestionSetType,
  Role,
  type Question,
  type User,
} from "@prisma/client";

import {
  ANALYTICS_DEMO_PROGRAMS,
  buildComprehensiveExamQuestions,
  comprehensiveSetName,
  diagnosticSetName,
  ensureAnalyticsSubjects,
} from "./seed-analytics-subjects.js";
import { seedTrigonometryDemo } from "./seed-trigonometry-demo.js";

const prisma = new PrismaClient();

async function ensurePrerequisites(teacher: Pick<User, "id">) {
  const mathSubject = await prisma.subject.findFirst({
    where: { courseCode: "MATH 105" },
  });

  if (!mathSubject) {
    const student = await prisma.user.findFirst({
      where: { email: "student@secsa.local" },
      select: { id: true },
    });
    if (!student) {
      throw new Error("Base users not found. Run npm run db:seed first.");
    }

    console.log("Bootstrapping MATH 105 subject, questions, and deployed exam sets…");
    await seedTrigonometryDemo({ teacher, student, resetStudentAttempts: false });
  }

  console.log("Ensuring comprehensive demo subjects and exam sets…");
  await ensureAnalyticsSubjects(teacher);
}

const DEMO_EMAIL_DOMAIN = "@analytics.demo.secsa.local";
const PASS_THRESHOLD = 75;

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

type Scenario =
  | "passed"
  | "failed_pending"
  | "failed_no_retake"
  | "retake_passed"
  | "retake_exhausted"
  | "retake_two_step";

interface StudentPlan {
  firstName: string;
  lastName: string;
  yearLevel: number;
  programCourse?: string;
  scenario: Scenario;
  firstScore: number;
  retakeScores?: number[];
  daysAgoFirst: number;
  daysAgoRetakes?: number[];
}

const STUDENT_PLANS: StudentPlan[] = [
  { firstName: "Ana", lastName: "Reyes", yearLevel: 1, programCourse: "CIVIL_ENGINEERING", scenario: "passed", firstScore: 96, daysAgoFirst: 2 },
  { firstName: "Ben", lastName: "Cruz", yearLevel: 1, scenario: "passed", firstScore: 88, daysAgoFirst: 3 },
  { firstName: "Cara", lastName: "Lim", yearLevel: 1, programCourse: "MECHANICAL_ENGINEERING", scenario: "passed", firstScore: 72, daysAgoFirst: 18 },
  { firstName: "Diego", lastName: "Santos", yearLevel: 1, scenario: "failed_pending", firstScore: 58, daysAgoFirst: 1 },
  { firstName: "Ella", lastName: "Garcia", yearLevel: 1, programCourse: "ARCHITECTURE", scenario: "failed_no_retake", firstScore: 42, daysAgoFirst: 5 },
  { firstName: "Finn", lastName: "Torres", yearLevel: 1, scenario: "retake_passed", firstScore: 52, retakeScores: [81], daysAgoFirst: 22, daysAgoRetakes: [8] },

  { firstName: "Gina", lastName: "Mendoza", yearLevel: 2, scenario: "passed", firstScore: 94, daysAgoFirst: 1 },
  { firstName: "Maria", lastName: "Reyes", yearLevel: 2, scenario: "passed", firstScore: 68, daysAgoFirst: 1 },
  { firstName: "Hugo", lastName: "Ramos", yearLevel: 2, programCourse: "ELECTRICAL_ENGINEERING", scenario: "passed", firstScore: 80, daysAgoFirst: 4 },
  { firstName: "Ivy", lastName: "Castro", yearLevel: 2, programCourse: "CIVIL_ENGINEERING", scenario: "passed", firstScore: 68, daysAgoFirst: 12 },
  { firstName: "Jake", lastName: "Flores", yearLevel: 2, scenario: "failed_pending", firstScore: 55, daysAgoFirst: 2 },
  { firstName: "Kira", lastName: "Navarro", yearLevel: 2, programCourse: "MECHANICAL_ENGINEERING", scenario: "failed_no_retake", firstScore: 38, daysAgoFirst: 6 },
  { firstName: "Leo", lastName: "Aquino", yearLevel: 2, programCourse: "ARCHITECTURE", scenario: "retake_two_step", firstScore: 48, retakeScores: [62, 84], daysAgoFirst: 40, daysAgoRetakes: [25, 9] },

  { firstName: "Maya", lastName: "Dizon", yearLevel: 3, programCourse: "ELECTRICAL_ENGINEERING", scenario: "passed", firstScore: 91, daysAgoFirst: 3 },
  { firstName: "Noah", lastName: "Perez", yearLevel: 3, scenario: "passed", firstScore: 77, daysAgoFirst: 10 },
  { firstName: "Olive", lastName: "Chua", yearLevel: 3, programCourse: "CIVIL_ENGINEERING", scenario: "passed", firstScore: 63, daysAgoFirst: 20 },
  { firstName: "Pia", lastName: "Villanueva", yearLevel: 3, scenario: "failed_pending", firstScore: 51, daysAgoFirst: 1 },
  { firstName: "Quinn", lastName: "Bautista", yearLevel: 3, programCourse: "MECHANICAL_ENGINEERING", scenario: "failed_no_retake", firstScore: 44, daysAgoFirst: 7 },
  { firstName: "Rafa", lastName: "Ong", yearLevel: 3, scenario: "retake_exhausted", firstScore: 49, retakeScores: [58, 61], daysAgoFirst: 45, daysAgoRetakes: [30, 14] },

  { firstName: "Sara", lastName: "Yu", yearLevel: 4, programCourse: "ARCHITECTURE", scenario: "passed", firstScore: 98, daysAgoFirst: 2 },
  { firstName: "Toby", lastName: "Tan", yearLevel: 4, scenario: "passed", firstScore: 86, daysAgoFirst: 11 },
  { firstName: "Uma", lastName: "Go", yearLevel: 4, programCourse: "ELECTRICAL_ENGINEERING", scenario: "passed", firstScore: 74, daysAgoFirst: 16 },
  { firstName: "Vic", lastName: "Sy", yearLevel: 4, programCourse: "CIVIL_ENGINEERING", scenario: "failed_no_retake", firstScore: 57, daysAgoFirst: 4 },
  { firstName: "Wren", lastName: "Ho", yearLevel: 4, scenario: "retake_passed", firstScore: 46, retakeScores: [79], daysAgoFirst: 35, daysAgoRetakes: [15] },
  { firstName: "Xena", lastName: "Koh", yearLevel: 4, programCourse: "MECHANICAL_ENGINEERING", scenario: "retake_exhausted", firstScore: 41, retakeScores: [53, 59], daysAgoFirst: 50, daysAgoRetakes: [32, 18] },
];

/** Ensures every program has at least one student per year level in the cohort browser. */
const COHORT_FILLER: StudentPlan[] = [
  { firstName: "Eli", lastName: "Park", yearLevel: 1, programCourse: "ELECTRICAL_ENGINEERING", scenario: "passed", firstScore: 84, daysAgoFirst: 6 },
  { firstName: "Nina", lastName: "Lopez", yearLevel: 3, programCourse: "ARCHITECTURE", scenario: "passed", firstScore: 71, daysAgoFirst: 8 },
  { firstName: "Owen", lastName: "Santos", yearLevel: 2, programCourse: "INFORMATION_TECHNOLOGY", scenario: "passed", firstScore: 76, daysAgoFirst: 5 },
  { firstName: "Iris", lastName: "Wong", yearLevel: 3, programCourse: "INFORMATION_TECHNOLOGY", scenario: "passed", firstScore: 69, daysAgoFirst: 9 },
  { firstName: "Jude", lastName: "Miles", yearLevel: 4, programCourse: "INFORMATION_TECHNOLOGY", scenario: "passed", firstScore: 82, daysAgoFirst: 7 },
];

const MISCONCEPTION_TARGETS = new Map<string, string>([
  ["What is sin(90°)?", "A"],
  ["What is cos(0°)?", "C"],
  ["What is tan(45°)?", "A"],
  ["Which identity is always true for any angle θ?", "A"],
]);

function daysAgo(days: number, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function pickWrongOption(question: Question, index: number, forceMisconception = false) {
  const override = MISCONCEPTION_TARGETS.get(question.text);
  if (override && override !== question.correctOption && (forceMisconception || index % 2 === 0)) {
    return override;
  }
  const options = ["A", "B", "C", "D"].filter((option) => option !== question.correctOption);
  return options[index % options.length];
}

function timeForQuestion(difficulty: Difficulty, correct: boolean, seed: number) {
  const base = difficulty === Difficulty.EASY ? 18 : difficulty === Difficulty.MEDIUM ? 35 : 55;
  const jitter = (seed % 17) - 8;
  const guessPenalty = correct ? 0 : -12;
  return Math.max(5, base + jitter + guessPenalty);
}

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

async function cleanupDemoData() {
  const demoStudents = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });

  for (const student of demoStudents) {
    await prisma.retakeApproval.deleteMany({ where: { studentId: student.id } });
    await prisma.examAttempt.deleteMany({ where: { studentId: student.id } });
  }

  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });
}

async function ensureExtraTopics(teacherId: string, subjectId: string) {
  for (const topicPlan of EXTRA_TOPICS) {
    const topic = await prisma.topic.upsert({
      where: { subjectId_name: { subjectId, name: topicPlan.name } },
      update: {},
      create: { name: topicPlan.name, subjectId },
    });

    for (const question of topicPlan.questions) {
      const existing = await prisma.question.findFirst({
        where: { subjectId, text: question.text },
      });
      if (!existing) {
        await prisma.question.create({
          data: {
            ...question,
            subjectId,
            topicId: topic.id,
            createdById: teacherId,
          },
        });
      }
    }
  }
}

async function createAttempt({
  studentId,
  questionSetId,
  questions,
  targetPct,
  submittedAt,
  attemptType,
  attemptNumber,
  seed,
}: {
  studentId: string;
  questionSetId: string;
  questions: Question[];
  targetPct: number;
  submittedAt: Date;
  attemptType: AttemptType;
  attemptNumber: number;
  seed: number;
}) {
  const totalItems = questions.length;
  const correctCount = Math.min(totalItems, Math.max(0, Math.round((targetPct / 100) * totalItems)));
  const percentage = (correctCount / totalItems) * 100;
  const passed = percentage >= PASS_THRESHOLD;

  const correctness = questions.map((_, index) => index < correctCount);
  for (let i = correctness.length - 1; i > 0; i -= 1) {
    const j = (seed + i * 7) % (i + 1);
    [correctness[i], correctness[j]] = [correctness[j], correctness[i]];
  }

  const attempt = await prisma.examAttempt.create({
    data: {
      studentId,
      questionSetId,
      attemptType,
      attemptNumber,
      questionIds: JSON.stringify(questions.map((question) => question.id)),
      score: correctCount,
      totalItems,
      percentage,
      passed,
      startedAt: new Date(submittedAt.getTime() - 45 * 60 * 1000),
      submittedAt,
    },
  });

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const isCorrect = correctness[index];
    await prisma.examAnswer.create({
      data: {
        examAttemptId: attempt.id,
        questionId: question.id,
        selectedOption: isCorrect
          ? question.correctOption
          : pickWrongOption(question, seed + index, targetPct < PASS_THRESHOLD),
        isCorrect,
        timeSpentSeconds: timeForQuestion(question.difficulty, isCorrect, seed + index),
        answerChangeCount: (seed + index) % 4 === 0 ? 2 : (seed + index) % 3 === 0 ? 1 : 0,
      },
    });
  }

  return attempt;
}

type ProgramExamSets = {
  firstExamId: string;
  retakeId: string;
  totalItems: number;
};

function examSetKey(programCourse: string, yearLevel: number) {
  return `${programCourse}:${yearLevel}`;
}

async function loadProgramExamSets() {
  const sets = new Map<string, ProgramExamSets>();

  for (const programCourse of ANALYTICS_DEMO_PROGRAMS) {
    const diagnostic = await prisma.questionSet.findFirst({
      where: {
        name: diagnosticSetName(programCourse),
        yearLevel: 1,
        programCourse,
        type: QuestionSetType.DIAGNOSTIC,
        status: "DEPLOYED",
      },
      orderBy: { deployedAt: "desc" },
    });

    if (!diagnostic) {
      throw new Error(`Missing Y1 diagnostic for ${programCourse}.`);
    }

    sets.set(examSetKey(programCourse, 1), {
      firstExamId: diagnostic.id,
      retakeId: diagnostic.id,
      totalItems: diagnostic.totalItems,
    });

    for (const yearLevel of [2, 3, 4] as const) {
      const comprehensive = await prisma.questionSet.findFirst({
        where: {
          name: comprehensiveSetName(programCourse, QuestionSetType.COMPREHENSIVE, yearLevel),
          yearLevel,
          programCourse,
          type: QuestionSetType.COMPREHENSIVE,
          status: "DEPLOYED",
        },
        orderBy: { deployedAt: "desc" },
      });
      const retake = await prisma.questionSet.findFirst({
        where: {
          name: comprehensiveSetName(programCourse, QuestionSetType.RETAKE, yearLevel),
          yearLevel,
          programCourse,
          type: QuestionSetType.RETAKE,
          status: "DEPLOYED",
        },
        orderBy: { deployedAt: "desc" },
      });

      if (!comprehensive || !retake) {
        throw new Error(`Missing Y${yearLevel} exam sets for ${programCourse}.`);
      }

      sets.set(examSetKey(programCourse, yearLevel), {
        firstExamId: comprehensive.id,
        retakeId: retake.id,
        totalItems: comprehensive.totalItems,
      });
    }
  }

  return sets;
}

export async function seedAnalyticsDemo(teacher: Pick<User, "id">) {
  await cleanupDemoData();

  const mathSubject = await prisma.subject.findFirst({
    where: { courseCode: "MATH 105" },
    select: { id: true },
  });
  if (!mathSubject) {
    throw new Error("MATH 105 subject not found after bootstrap.");
  }

  await ensureExtraTopics(teacher.id, mathSubject.id);

  await ensureAnalyticsSubjects(teacher);

  const programExamSets = await loadProgramExamSets();
  const referenceSet = programExamSets.get(examSetKey("INFORMATION_TECHNOLOGY", 2));
  if (!referenceSet) {
    throw new Error("IT Y2 exam sets missing after bootstrap.");
  }

  const questionPoolCache = new Map<number, Question[]>();

  async function getExamQuestions(totalItems: number) {
    const cached = questionPoolCache.get(totalItems);
    if (cached) return cached;

    const questions = await buildComprehensiveExamQuestions(totalItems);
    if (questions.length < 24) {
      throw new Error(`Need at least 24 questions across demo subjects; got ${questions.length}.`);
    }

    questionPoolCache.set(totalItems, questions);
    return questions;
  }

  const referenceQuestions = await getExamQuestions(referenceSet.totalItems);
  const subjectCount = new Set(referenceQuestions.map((question) => question.subjectId)).size;

  const passwordHash = await bcrypt.hash("password123", 10);
  let attemptCount = 0;
  let pendingApprovals = 0;

  const allPlans = [...STUDENT_PLANS, ...COHORT_FILLER];

  for (let index = 0; index < allPlans.length; index += 1) {
    const plan = allPlans[index];
    const email = `analytics.demo.${plan.firstName.toLowerCase()}${DEMO_EMAIL_DOMAIN}`;
    const programCourse = plan.programCourse ?? "INFORMATION_TECHNOLOGY";
    const examSets = programExamSets.get(examSetKey(programCourse, plan.yearLevel));
    if (!examSets) {
      throw new Error(`No exam sets configured for ${programCourse} year ${plan.yearLevel}.`);
    }

    const examQuestions = await getExamQuestions(examSets.totalItems);

    const student = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: plan.firstName,
        lastName: plan.lastName,
        role: Role.STUDENT,
        yearLevel: plan.yearLevel,
        programCourse,
      },
    });

    const firstAttempt = await createAttempt({
      studentId: student.id,
      questionSetId: examSets.firstExamId,
      questions: examQuestions,
      targetPct: plan.firstScore,
      submittedAt: daysAgo(plan.daysAgoFirst, 9 + (index % 6)),
      attemptType: AttemptType.FIRST,
      attemptNumber: 1,
      seed: index * 13,
    });
    attemptCount += 1;

    if (plan.scenario === "failed_pending") {
      await prisma.retakeApproval.create({
        data: {
          studentId: student.id,
          examAttemptId: firstAttempt.id,
          yearLevel: plan.yearLevel,
          status: ApprovalStatus.PENDING,
        },
      });
      pendingApprovals += 1;
      continue;
    }

    if (plan.scenario === "failed_no_retake") {
      continue;
    }

    const retakeScores = plan.retakeScores ?? [];
    const retakeDates = plan.daysAgoRetakes ?? [];

    for (let retakeIndex = 0; retakeIndex < retakeScores.length; retakeIndex += 1) {
      const retakeAttempt = await createAttempt({
        studentId: student.id,
        questionSetId: examSets.retakeId,
        questions: examQuestions,
        targetPct: retakeScores[retakeIndex],
        submittedAt: daysAgo(retakeDates[retakeIndex] ?? 5, 14 + retakeIndex),
        attemptType: AttemptType.RETAKE,
        attemptNumber: retakeIndex + 2,
        seed: index * 17 + retakeIndex,
      });
      attemptCount += 1;

      if (retakeIndex === 0 && plan.scenario !== "retake_exhausted") {
        await prisma.retakeApproval.create({
          data: {
            studentId: student.id,
            examAttemptId: firstAttempt.id,
            yearLevel: plan.yearLevel,
            status: ApprovalStatus.APPROVED,
            approvedById: teacher.id,
          },
        });
      }

      if (retakeIndex === 1 && plan.scenario === "retake_two_step") {
        await prisma.retakeApproval.create({
          data: {
            studentId: student.id,
            examAttemptId: retakeAttempt.id,
            yearLevel: plan.yearLevel,
            status: ApprovalStatus.APPROVED,
            approvedById: teacher.id,
          },
        });
      }
    }
  }

  // Older cohort for week-over-week trend (lower pass rate last week)
  const trendStudents = [
    { firstName: "Trend", lastName: "Alpha", programCourse: "CIVIL_ENGINEERING", score: 62, daysAgo: 9 },
    { firstName: "Trend", lastName: "Beta", programCourse: "MECHANICAL_ENGINEERING", score: 58, daysAgo: 10 },
    { firstName: "Trend", lastName: "Gamma", programCourse: "ELECTRICAL_ENGINEERING", score: 66, daysAgo: 11 },
    { firstName: "Trend", lastName: "Delta", programCourse: "ARCHITECTURE", score: 54, daysAgo: 12 },
  ];

  for (let index = 0; index < trendStudents.length; index += 1) {
    const plan = trendStudents[index];
    const examSets = programExamSets.get(examSetKey(plan.programCourse, 2));
    if (!examSets) continue;

    const student = await prisma.user.create({
      data: {
        email: `analytics.demo.trend${index + 1}${DEMO_EMAIL_DOMAIN}`,
        passwordHash,
        firstName: plan.firstName,
        lastName: plan.lastName,
        role: Role.STUDENT,
        yearLevel: 2,
        programCourse: plan.programCourse,
      },
    });

    const trendQuestions = await getExamQuestions(examSets.totalItems);

    await createAttempt({
      studentId: student.id,
      questionSetId: examSets.firstExamId,
      questions: trendQuestions,
      targetPct: plan.score,
      submittedAt: daysAgo(plan.daysAgo, 8),
      attemptType: AttemptType.FIRST,
      attemptNumber: 1,
      seed: 900 + index,
    });
    attemptCount += 1;
  }

  return {
    students: allPlans.length + trendStudents.length,
    attempts: attemptCount,
    pendingApprovals,
    questionsUsed: referenceQuestions.length,
    subjectsInExam: subjectCount,
    programs: ANALYTICS_DEMO_PROGRAMS.length,
    topics: EXTRA_TOPICS.length + 1,
  };
}

async function main() {
  const teacher = await ensureTeacher();
  await ensurePrerequisites(teacher);
  const result = await seedAnalyticsDemo(teacher);

  console.log("Analytics demo seed complete.");
  console.log(result);
  console.log("");
  console.log("Log in as admin@secsa.local / password123");
  console.log("Open Analytics → Group to drill down by all programs (CE, ME, EE, IT, ARCH)");
  console.log("Demo students use emails ending with @analytics.demo.secsa.local");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
