import { fileURLToPath } from "node:url";
import { PrismaClient, QuestionSetType, Role } from "@prisma/client";
import { DEFAULT_PROGRAM_SLUGS } from "../src/lib/programCourse.js";

const prisma = new PrismaClient();

const EXAM_SET_TYPES: QuestionSetType[] = [
  QuestionSetType.COMPREHENSIVE,
  QuestionSetType.RETAKE,
  QuestionSetType.DIAGNOSTIC,
  QuestionSetType.PREBOARD,
];

export type ResetProgramYearOptions = {
  programCourse: string;
  yearLevel: number;
  dryRun?: boolean;
  includeQa?: boolean;
};

export type ResetProgramYearPreview = {
  programCourse: string;
  yearLevel: number;
  dryRun: boolean;
  includeQa: boolean;
  questionSets: Array<{
    id: string;
    name: string;
    type: QuestionSetType;
    status: string;
    deployedAt: Date | null;
  }>;
  students: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    qaUnlimited: boolean;
  }>;
  attemptsToRemove: Array<{
    id: string;
    studentEmail: string;
    questionSetName: string;
    questionSetType: QuestionSetType;
    questionSetStatus: string;
    submittedAt: Date | null;
    startedAt: Date;
  }>;
  retakeApprovalsToRemove: number;
  examAnswersToRemove: number;
  inProgressCount: number;
  submittedCount: number;
  otherProgramsInProgress: number;
};

function parseArgs(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const includeQa = argv.includes("--include-qa");
  const positional = argv.filter((arg) => !arg.startsWith("--"));

  const programCourse = positional[0]?.trim().toUpperCase();
  const yearLevel = Number(positional[1]);

  if (!programCourse || !Number.isFinite(yearLevel) || yearLevel < 1) {
    throw new Error(
      "Usage: tsx prisma/reset-program-year.ts <PROGRAM_COURSE> <YEAR_LEVEL> [--dry-run] [--include-qa]\n" +
        "Example: tsx prisma/reset-program-year.ts INFORMATION_TECHNOLOGY 2 --dry-run"
    );
  }

  if (!DEFAULT_PROGRAM_SLUGS.includes(programCourse as (typeof DEFAULT_PROGRAM_SLUGS)[number])) {
    console.warn(
      `Warning: "${programCourse}" is not in the default program list (${DEFAULT_PROGRAM_SLUGS.join(", ")}). Continuing anyway.`
    );
  }

  return { programCourse, yearLevel, dryRun, includeQa };
}

export async function previewResetProgramYear(
  options: ResetProgramYearOptions
): Promise<ResetProgramYearPreview> {
  const { programCourse, yearLevel, dryRun = false, includeQa = false } = options;

  const questionSets = await prisma.questionSet.findMany({
    where: {
      programCourse,
      yearLevel,
      type: { in: EXAM_SET_TYPES },
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      deployedAt: true,
    },
    orderBy: [{ type: "asc" }, { status: "asc" }, { deployedAt: "desc" }],
  });

  const students = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      programCourse,
      yearLevel,
      ...(includeQa ? {} : { qaUnlimited: false }),
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      qaUnlimited: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const studentIds = students.map((student) => student.id);
  const questionSetIds = questionSets.map((set) => set.id);

  const attemptsToRemove =
    studentIds.length === 0 || questionSetIds.length === 0
      ? []
      : await prisma.examAttempt.findMany({
          where: {
            studentId: { in: studentIds },
            questionSetId: { in: questionSetIds },
          },
          select: {
            id: true,
            submittedAt: true,
            startedAt: true,
            student: { select: { email: true } },
            questionSet: {
              select: { name: true, type: true, status: true },
            },
          },
          orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
        });

  const attemptIds = attemptsToRemove.map((attempt) => attempt.id);

  const [retakeApprovalsToRemove, examAnswersToRemove, otherProgramsInProgress] =
    await Promise.all([
      attemptIds.length === 0
        ? Promise.resolve(0)
        : prisma.retakeApproval
            .count({ where: { examAttemptId: { in: attemptIds } } })
            .then((count) => count),
      attemptIds.length === 0
        ? Promise.resolve(0)
        : prisma.examAnswer.count({ where: { examAttemptId: { in: attemptIds } } }),
      prisma.examAttempt.count({
        where: {
          submittedAt: null,
          student: {
            role: Role.STUDENT,
            isActive: true,
            qaUnlimited: false,
            NOT: {
              AND: [{ programCourse }, { yearLevel }],
            },
          },
        },
      }),
    ]);

  const inProgressCount = attemptsToRemove.filter((attempt) => !attempt.submittedAt).length;
  const submittedCount = attemptsToRemove.length - inProgressCount;

  return {
    programCourse,
    yearLevel,
    dryRun,
    includeQa,
    questionSets,
    students,
    attemptsToRemove: attemptsToRemove.map((attempt) => ({
      id: attempt.id,
      studentEmail: attempt.student.email,
      questionSetName: attempt.questionSet.name,
      questionSetType: attempt.questionSet.type,
      questionSetStatus: attempt.questionSet.status,
      submittedAt: attempt.submittedAt,
      startedAt: attempt.startedAt,
    })),
    retakeApprovalsToRemove,
    examAnswersToRemove,
    inProgressCount,
    submittedCount,
    otherProgramsInProgress,
  };
}

export async function resetProgramYearExamState(options: ResetProgramYearOptions) {
  const preview = await previewResetProgramYear(options);

  if (preview.attemptsToRemove.length === 0) {
    return { preview, removed: { examAttempts: 0, retakeApprovals: 0, examAnswers: 0 } };
  }

  const attemptIds = preview.attemptsToRemove.map((attempt) => attempt.id);

  const retakeApprovals = await prisma.retakeApproval.deleteMany({
    where: { examAttemptId: { in: attemptIds } },
  });
  const examAttempts = await prisma.examAttempt.deleteMany({
    where: { id: { in: attemptIds } },
  });

  return {
    preview,
    removed: {
      examAttempts: examAttempts.count,
      retakeApprovals: retakeApprovals.count,
      examAnswers: preview.examAnswersToRemove,
    },
  };
}

function printPreview(preview: ResetProgramYearPreview) {
  console.log(
    `${preview.dryRun ? "Dry run" : "Reset"}: ${preview.programCourse} year ${preview.yearLevel}` +
      (preview.includeQa ? " (including QA accounts)" : " (QA accounts excluded)")
  );
  console.log("");

  console.log(`Question sets in slot (${preview.questionSets.length}):`);
  if (preview.questionSets.length === 0) {
    console.log("  (none)");
  } else {
    for (const set of preview.questionSets) {
      const deployed = set.deployedAt ? `, deployed ${set.deployedAt.toISOString()}` : "";
      console.log(`  - [${set.status}] ${set.type}: ${set.name}${deployed}`);
    }
  }

  console.log("");
  console.log(`Students in scope (${preview.students.length}):`);
  if (preview.students.length === 0) {
    console.log("  (none)");
  } else if (preview.students.length <= 20) {
    for (const student of preview.students) {
      const qa = student.qaUnlimited ? " [QA]" : "";
      console.log(`  - ${student.email}${qa}`);
    }
  } else {
    console.log(`  ${preview.students.length} active students (list omitted)`);
  }

  console.log("");
  console.log("Exam attempts that would be removed:");
  console.log(`  Total: ${preview.attemptsToRemove.length}`);
  console.log(`  In progress: ${preview.inProgressCount}`);
  console.log(`  Submitted: ${preview.submittedCount}`);
  console.log(`  Retake approvals: ${preview.retakeApprovalsToRemove}`);
  console.log(`  Exam answers: ${preview.examAnswersToRemove}`);

  if (preview.inProgressCount > 0) {
    console.log("");
    console.log("In-progress sessions (would lose current progress):");
    for (const attempt of preview.attemptsToRemove.filter((row) => !row.submittedAt)) {
      console.log(
        `  - ${attempt.studentEmail}: ${attempt.questionSetName} [${attempt.questionSetType}, ${attempt.questionSetStatus}]`
      );
    }
  }

  if (preview.attemptsToRemove.length > 0 && preview.attemptsToRemove.length <= 30) {
    console.log("");
    console.log("All matching attempts:");
    for (const attempt of preview.attemptsToRemove) {
      const status = attempt.submittedAt ? "submitted" : "in progress";
      console.log(
        `  - ${attempt.studentEmail}: ${attempt.questionSetName} [${attempt.questionSetType}, ${status}]`
      );
    }
  }

  console.log("");
  console.log(
    `Other programs currently in progress (untouched): ${preview.otherProgramsInProgress}`
  );

  if (preview.dryRun) {
    console.log("");
    console.log("Dry run only — no data was changed.");
    console.log(
      "To apply: tsx prisma/reset-program-year.ts",
      preview.programCourse,
      String(preview.yearLevel)
    );
  }
}

async function main() {
  const args = parseArgs();
  const preview = await previewResetProgramYear(args);
  printPreview(preview);

  if (args.dryRun) {
    return;
  }

  if (preview.inProgressCount > 0) {
    console.log("");
    console.log(
      `Warning: ${preview.inProgressCount} in-progress attempt(s) will be deleted. Re-run with --dry-run to review first.`
    );
  }

  const result = await resetProgramYearExamState(args);
  console.log("");
  console.log("Reset complete.");
  console.log("Removed:", result.removed);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
