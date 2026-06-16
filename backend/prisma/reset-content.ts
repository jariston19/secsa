import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL_SUFFIX = "@analytics.demo.secsa.local";

async function clearUploads() {
  const uploadDir =
    process.env.UPLOAD_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "../uploads");

  try {
    const files = await readdir(uploadDir);
    await Promise.all(
      files
        .filter((file) => file !== ".gitkeep")
        .map((file) => unlink(path.join(uploadDir, file)).catch(() => {}))
    );
  } catch {
    // uploads folder may not exist yet
  }
}

export async function resetContentData() {
  const [
    retakeApprovals,
    examAnswers,
    examAttempts,
    questionSetConfigs,
    questionSets,
    questions,
    topics,
    subjectProgramCourses,
    subjects,
    demoStudents,
  ] = await prisma.$transaction([
    prisma.retakeApproval.deleteMany(),
    prisma.examAnswer.deleteMany(),
    prisma.examAttempt.deleteMany(),
    prisma.questionSetConfig.deleteMany(),
    prisma.questionSet.deleteMany(),
    prisma.question.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.subjectProgramCourse.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_SUFFIX } } }),
  ]);

  await clearUploads();

  return {
    retakeApprovals: retakeApprovals.count,
    examAnswers: examAnswers.count,
    examAttempts: examAttempts.count,
    questionSetConfigs: questionSetConfigs.count,
    questionSets: questionSets.count,
    questions: questions.count,
    topics: topics.count,
    subjectProgramCourses: subjectProgramCourses.count,
    subjects: subjects.count,
    demoStudents: demoStudents.count,
  };
}

async function main() {
  const removed = await resetContentData();

  console.log("Content reset complete.");
  console.log("Removed:", removed);
  console.log("");
  console.log("Kept: staff accounts and @southlandcollege.edu.ph users.");
  console.log("Cleared: subjects, topics, questions, question sets, exams, analytics.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
