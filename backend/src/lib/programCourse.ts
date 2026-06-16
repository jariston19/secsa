import { z } from "zod";
import { prisma } from "./prisma.js";

export const DEFAULT_PROGRAM_SLUGS = [
  "CIVIL_ENGINEERING",
  "MECHANICAL_ENGINEERING",
  "ELECTRICAL_ENGINEERING",
  "INFORMATION_TECHNOLOGY",
  "ARCHITECTURE",
] as const;

export { SHARED_DIAGNOSTIC_PROGRAM } from "./incomingDiagnostic.js";

export const DEFAULT_PROGRAM_COURSE = "INFORMATION_TECHNOLOGY";

export const programCourseSlugSchema = z
  .string()
  .trim()
  .min(1, "Program course is required.")
  .max(80);

export const programCoursesSchema = z
  .array(programCourseSlugSchema)
  .min(1, "Select at least one program course.");

export function toProgramSlug(label: string) {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug;
}

export async function resolveProgramSlug(label: string, abbr: string, excludeId?: string) {
  const normalizedAbbr = abbr.trim().toUpperCase();
  let slug = toProgramSlug(label);

  if (!slug) {
    throw Object.assign(new Error("Could not derive a program code from the name."), {
      statusCode: 400,
    });
  }

  const existingSlug = await prisma.program.findUnique({ where: { slug } });
  if (existingSlug && existingSlug.id !== excludeId) {
    slug = `${slug}_${normalizedAbbr}`;
  }

  const collision = await prisma.program.findUnique({ where: { slug } });
  if (collision && collision.id !== excludeId) {
    throw Object.assign(new Error("A program with this code already exists."), {
      statusCode: 409,
    });
  }

  return slug;
}

export async function findActiveProgram(slug: string) {
  return prisma.program.findFirst({
    where: { slug, isActive: true },
  });
}

export async function assertActiveProgramSlug(slug: string) {
  const program = await findActiveProgram(slug);
  if (!program) {
    throw Object.assign(new Error("Invalid or inactive program course."), { statusCode: 400 });
  }
  return program;
}

export async function assertActiveProgramSlugs(slugs: string[]) {
  const unique = [...new Set(slugs)];
  const programs = await prisma.program.findMany({
    where: { slug: { in: unique }, isActive: true },
  });
  if (programs.length !== unique.length) {
    throw Object.assign(new Error("One or more program courses are invalid."), { statusCode: 400 });
  }
  return programs;
}

export async function parseProgramCourseQuery(value?: string) {
  if (!value) return undefined;
  const slug = programCourseSlugSchema.parse(value);
  await assertActiveProgramSlug(slug);
  return slug;
}
