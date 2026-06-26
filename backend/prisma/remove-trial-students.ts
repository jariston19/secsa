import { PrismaClient } from "@prisma/client";
import { removeTrialStudents, trialStudentEmail, TRIAL_STUDENT_COUNT } from "./trial-students.js";

const prisma = new PrismaClient();

async function main() {
  const result = await removeTrialStudents(prisma);

  console.log("Removed trial ME year-1 students.");
  console.log({
    deleted: result.users,
    emailRange: `${trialStudentEmail(1)} … ${trialStudentEmail(TRIAL_STUDENT_COUNT)}`,
    foundBeforeDelete: result.emails.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
