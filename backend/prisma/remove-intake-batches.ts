import { PrismaClient, Role } from "@prisma/client";
import { inferIntakeYear, type MilestoneAttemptRow } from "../src/lib/studentMilestones.js";

const prisma = new PrismaClient();

/** Intake cohort years to clear before starting a new exam season. */
const TARGET_INTAKE_YEARS = [2024, 2025] as const;

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  return { dryRun };
}

async function listStudentsByIntakeYear() {
  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT, qaUnlimited: false },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      yearLevel: true,
    },
  });

  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId: { in: students.map((student) => student.id) },
      submittedAt: { not: null },
    },
    select: {
      id: true,
      studentId: true,
      percentage: true,
      passed: true,
      submittedAt: true,
      attemptType: true,
      questionSet: { select: { yearLevel: true, type: true } },
    },
  });

  const attemptsByStudent = new Map<string, MilestoneAttemptRow[]>();
  for (const attempt of attempts) {
    if (!attempt.submittedAt) continue;
    const row: MilestoneAttemptRow = {
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      attemptType: attempt.attemptType,
      questionSet: attempt.questionSet,
    };
    const list = attemptsByStudent.get(attempt.studentId) ?? [];
    list.push(row);
    attemptsByStudent.set(attempt.studentId, list);
  }

  const byIntake = new Map<number, typeof students>();
  for (const student of students) {
    const intakeYear = inferIntakeYear(attemptsByStudent.get(student.id) ?? [], student);
    if (intakeYear == null || !TARGET_INTAKE_YEARS.includes(intakeYear as (typeof TARGET_INTAKE_YEARS)[number])) {
      continue;
    }
    const list = byIntake.get(intakeYear) ?? [];
    list.push(student);
    byIntake.set(intakeYear, list);
  }

  return { byIntake, attempts, students, attemptsByStudent };
}

async function removeAttemptsForStudents(studentIds: string[]) {
  if (studentIds.length === 0) {
    return { attempts: 0, retakeApprovals: 0 };
  }

  const retakeApprovals = await prisma.retakeApproval.deleteMany({
    where: { studentId: { in: studentIds } },
  });
  const examAttempts = await prisma.examAttempt.deleteMany({
    where: { studentId: { in: studentIds } },
  });

  return {
    attempts: examAttempts.count,
    retakeApprovals: retakeApprovals.count,
  };
}

async function main() {
  const { dryRun } = parseArgs();
  const { byIntake, attempts } = await listStudentsByIntakeYear();

  const studentsInTargetBatches = [...byIntake.values()].flat();
  const studentIds = studentsInTargetBatches.map((student) => student.id);
  const attemptCount = attempts.filter((attempt) => studentIds.includes(attempt.studentId)).length;

  for (const year of TARGET_INTAKE_YEARS) {
    const group = byIntake.get(year) ?? [];
    console.log(`Batch ${year}: ${group.length} student(s)`);
    for (const student of group) {
      console.log(`  - ${student.email} (year ${student.yearLevel ?? "?"})`);
    }
  }

  const withoutAttempts = studentsInTargetBatches.filter(
    (student) => !attempts.some((attempt) => attempt.studentId === student.id)
  );

  console.log("");
  if (dryRun) {
    console.log(`Dry run: would delete ${attemptCount} exam attempt(s).`);
    console.log(
      `Dry run: would move ${withoutAttempts.length} student(s) without exam history to year level 1 (2026 intake).`
    );
    return;
  }

  if (studentIds.length === 0) {
    console.log("No students in intake batches 2024 or 2025.");
    return;
  }

  const removed = await removeAttemptsForStudents(studentIds);
  console.log("Removed exam history:", removed);

  if (withoutAttempts.length > 0) {
    const updated = await prisma.user.updateMany({
      where: { id: { in: withoutAttempts.map((student) => student.id) } },
      data: { yearLevel: 1 },
    });
    console.log(`Moved ${updated.count} student(s) to year level 1 for 2026 intake.`);
    for (const student of withoutAttempts) {
      console.log(`  - ${student.email}`);
    }
  }

  console.log("Intake batches 2024 and 2025 are cleared. Trends should now show Batch 2026 only.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
