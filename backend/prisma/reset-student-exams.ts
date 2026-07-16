import { fileURLToPath } from "node:url";
import { PrismaClient, QuestionSetType } from "@prisma/client";

const prisma = new PrismaClient();

const SET_TYPES = new Set<string>(Object.values(QuestionSetType));

function parseArgs(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const yearLevelArg = argv.find((arg) => arg.startsWith("--year-level="));
  const yearLevel = yearLevelArg ? Number(yearLevelArg.split("=")[1]) : undefined;
  const typeArg = argv.find((arg) => arg.startsWith("--type="));
  const setType = typeArg?.split("=")[1]?.toUpperCase();
  const email = argv.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      "Usage: tsx prisma/reset-student-exams.ts <email> [--year-level=N] [--type=COMPREHENSIVE|RETAKE|DIAGNOSTIC|PREBOARD] [--dry-run]\n" +
        "Example: tsx prisma/reset-student-exams.ts student@school.edu --year-level=3 --type=RETAKE --dry-run"
    );
  }

  if (setType && !SET_TYPES.has(setType)) {
    throw new Error(`Invalid --type=${setType}. Use one of: ${[...SET_TYPES].join(", ")}`);
  }

  return { email, dryRun, yearLevel, setType: setType as QuestionSetType | undefined };
}

export async function resetStudentExams(options: {
  email: string;
  dryRun?: boolean;
  yearLevel?: number;
  setType?: QuestionSetType;
}) {
  const student = await prisma.user.findUnique({
    where: { email: options.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      yearLevel: true,
      programCourse: true,
    },
  });

  if (!student) {
    throw new Error(`No account found for ${options.email}.`);
  }

  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId: student.id,
      ...(Number.isFinite(options.yearLevel) || options.setType
        ? {
            questionSet: {
              ...(Number.isFinite(options.yearLevel) ? { yearLevel: options.yearLevel } : {}),
              ...(options.setType ? { type: options.setType } : {}),
            },
          }
        : {}),
    },
    include: {
      questionSet: { select: { name: true, type: true, yearLevel: true, status: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  const attemptIds = attempts.map((attempt) => attempt.id);
  const answerCount =
    attemptIds.length === 0
      ? 0
      : await prisma.examAnswer.count({ where: { examAttemptId: { in: attemptIds } } });

  if (!options.dryRun && attemptIds.length > 0) {
    await prisma.retakeApproval.deleteMany({ where: { examAttemptId: { in: attemptIds } } });
    await prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } });
  }

  return { student, attempts, answerCount, dryRun: Boolean(options.dryRun) };
}

function printResult(result: Awaited<ReturnType<typeof resetStudentExams>>) {
  const { student, attempts, answerCount, dryRun } = result;

  console.log(`${dryRun ? "Dry run" : "Reset"}: ${student.email}`);
  console.log(
    `Profile: ${student.firstName} ${student.lastName}, year ${student.yearLevel ?? "?"}, ${student.programCourse ?? "?"}`
  );
  console.log("");
  console.log(`Attempts to remove (${attempts.length}):`);

  if (attempts.length === 0) {
    console.log("  (none)");
  } else {
    for (const attempt of attempts) {
      const status = attempt.submittedAt ? "submitted" : "in progress";
      console.log(
        `  - [Y${attempt.questionSet.yearLevel} ${attempt.questionSet.type}] ${attempt.questionSet.name} (${status})`
      );
    }
    console.log(`Exam answers: ${answerCount}`);
  }

  if (dryRun) {
    console.log("");
    console.log("Dry run only — no data was changed.");
  } else if (attempts.length > 0) {
    console.log("");
    console.log("Reset complete.");
    console.log({ removedExamAttempts: attempts.length, removedExamAnswers: answerCount });
  }
}

async function main() {
  const args = parseArgs();
  const result = await resetStudentExams(args);
  printResult(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
