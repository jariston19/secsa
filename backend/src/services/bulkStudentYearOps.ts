import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { assertActiveProgramSlug } from "../lib/programCourse.js";
import { MIN_YEAR_LEVEL, maxYearLevelForProgram } from "../lib/yearLevel.js";

const activeStudentWhere = (programCourse: string, yearLevel: number) => ({
  role: Role.STUDENT,
  programCourse,
  yearLevel,
  isActive: true,
  qaUnlimited: false,
});

async function countActiveStudents(programCourse: string, yearLevel: number) {
  return prisma.user.count({
    where: activeStudentWhere(programCourse, yearLevel),
  });
}

export async function previewBulkPromote(programCourse: string, fromYearLevel: number) {
  await assertActiveProgramSlug(programCourse);

  const maxYearLevel = maxYearLevelForProgram(programCourse);
  if (fromYearLevel < MIN_YEAR_LEVEL || fromYearLevel >= maxYearLevel) {
    throw new Error(
      `Promote only applies to incoming years ${MIN_YEAR_LEVEL}–${maxYearLevel - 1}. Use graduate for incoming year ${maxYearLevel}.`
    );
  }

  const matchCount = await countActiveStudents(programCourse, fromYearLevel);
  const inactiveAtLevel = await prisma.user.count({
    where: {
      role: Role.STUDENT,
      programCourse,
      yearLevel: fromYearLevel,
      isActive: false,
      qaUnlimited: false,
    },
  });

  return {
    action: "promote" as const,
    programCourse,
    fromYearLevel,
    toYearLevel: fromYearLevel + 1,
    matchCount,
    inactiveAtLevel,
    message: `Move ${matchCount} active student${matchCount === 1 ? "" : "s"} from incoming year ${fromYearLevel} to ${fromYearLevel + 1}.`,
  };
}

export async function executeBulkPromote(programCourse: string, fromYearLevel: number) {
  const preview = await previewBulkPromote(programCourse, fromYearLevel);
  if (preview.matchCount === 0) {
    return { ...preview, updatedCount: 0, dryRun: false };
  }

  const result = await prisma.user.updateMany({
    where: activeStudentWhere(programCourse, fromYearLevel),
    data: { yearLevel: fromYearLevel + 1 },
  });

  return { ...preview, updatedCount: result.count, dryRun: false };
}

export async function previewBulkGraduate(programCourse: string) {
  await assertActiveProgramSlug(programCourse);

  const maxYearLevel = maxYearLevelForProgram(programCourse);
  const matchCount = await countActiveStudents(programCourse, maxYearLevel);
  const inactiveAtLevel = await prisma.user.count({
    where: {
      role: Role.STUDENT,
      programCourse,
      yearLevel: maxYearLevel,
      isActive: false,
      qaUnlimited: false,
    },
  });

  return {
    action: "graduate" as const,
    programCourse,
    matchCount,
    inactiveAtLevel,
    message: `Archive ${matchCount} active incoming year ${maxYearLevel} student${matchCount === 1 ? "" : "s"} (disable login, keep exam history).`,
  };
}

export async function executeBulkGraduate(programCourse: string) {
  const preview = await previewBulkGraduate(programCourse);
  if (preview.matchCount === 0) {
    return { ...preview, updatedCount: 0, dryRun: false };
  }

  const maxYearLevel = maxYearLevelForProgram(programCourse);
  const result = await prisma.user.updateMany({
    where: activeStudentWhere(programCourse, maxYearLevel),
    data: { isActive: false },
  });

  return { ...preview, updatedCount: result.count, dryRun: false };
}

function buildPromoteChain(maxYearLevel: number) {
  const parts = [];
  for (let fromYear = maxYearLevel - 1; fromYear >= MIN_YEAR_LEVEL; fromYear -= 1) {
    parts.push(`Y${fromYear}→Y${fromYear + 1}`);
  }
  return parts.join(", ");
}

export async function previewSchoolYearRollover(programCourse: string) {
  await assertActiveProgramSlug(programCourse);

  const maxYearLevel = maxYearLevelForProgram(programCourse);
  const graduatePreview = await previewBulkGraduate(programCourse);
  const promoteSteps = [];

  for (let fromYear = maxYearLevel - 1; fromYear >= MIN_YEAR_LEVEL; fromYear -= 1) {
    const matchCount = await countActiveStudents(programCourse, fromYear);
    promoteSteps.push({
      fromYearLevel: fromYear,
      toYearLevel: fromYear + 1,
      matchCount,
    });
  }

  const totalPromoted = promoteSteps.reduce((sum, step) => sum + step.matchCount, 0);

  return {
    action: "rollover" as const,
    programCourse,
    graduate: graduatePreview,
    promoteSteps,
    totalPromoted,
    message:
      `School-year rollover for ${programCourse}: archive ${graduatePreview.matchCount} incoming Y${maxYearLevel}, then promote ${totalPromoted} student${totalPromoted === 1 ? "" : "s"} (${buildPromoteChain(maxYearLevel)}) in one step.`,
  };
}

export async function executeSchoolYearRollover(programCourse: string) {
  const preview = await previewSchoolYearRollover(programCourse);
  const maxYearLevel = maxYearLevelForProgram(programCourse);

  const updated = await prisma.$transaction(async (tx) => {
    const graduated = await tx.user.updateMany({
      where: activeStudentWhere(programCourse, maxYearLevel),
      data: { isActive: false },
    });

    let promoted = 0;
    for (let fromYear = maxYearLevel - 1; fromYear >= MIN_YEAR_LEVEL; fromYear -= 1) {
      const result = await tx.user.updateMany({
        where: activeStudentWhere(programCourse, fromYear),
        data: { yearLevel: fromYear + 1 },
      });
      promoted += result.count;
    }

    return { graduated: graduated.count, promoted };
  });

  return {
    ...preview,
    dryRun: false,
    graduatedCount: updated.graduated,
    promotedCount: updated.promoted,
  };
}
