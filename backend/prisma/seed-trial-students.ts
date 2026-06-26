import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import {
  TRIAL_STUDENT_COUNT,
  TRIAL_STUDENT_PASSWORD,
  TRIAL_STUDENT_PROGRAM,
  TRIAL_STUDENT_YEAR_LEVEL,
  trialStudentEmail,
} from "./trial-students.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(TRIAL_STUDENT_PASSWORD, 10);

  const program = await prisma.program.findUnique({
    where: { slug: TRIAL_STUDENT_PROGRAM },
    select: { slug: true, label: true },
  });
  if (!program) {
    throw new Error(`Program ${TRIAL_STUDENT_PROGRAM} not found. Run the main seed first.`);
  }

  const created: string[] = [];
  const updated: string[] = [];

  for (let index = 1; index <= TRIAL_STUDENT_COUNT; index += 1) {
    const email = trialStudentEmail(index);
    const label = String(index).padStart(2, "0");
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName: "Trial",
        lastName: `ME ${label}`,
        role: Role.STUDENT,
        yearLevel: TRIAL_STUDENT_YEAR_LEVEL,
        programCourse: TRIAL_STUDENT_PROGRAM,
        isActive: true,
        qaUnlimited: false,
      },
      create: {
        email,
        passwordHash,
        firstName: "Trial",
        lastName: `ME ${label}`,
        role: Role.STUDENT,
        yearLevel: TRIAL_STUDENT_YEAR_LEVEL,
        programCourse: TRIAL_STUDENT_PROGRAM,
      },
    });

    if (existing) updated.push(email);
    else created.push(email);
  }

  console.log("Trial ME year-1 students ready.");
  console.log({
    program: program.label,
    yearLevel: TRIAL_STUDENT_YEAR_LEVEL,
    count: TRIAL_STUDENT_COUNT,
    created: created.length,
    updated: updated.length,
    emailRange: `${trialStudentEmail(1)} … ${trialStudentEmail(TRIAL_STUDENT_COUNT)}`,
    password: TRIAL_STUDENT_PASSWORD,
  });
  console.log("Remove later with: npm run db:remove-trial-students");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
